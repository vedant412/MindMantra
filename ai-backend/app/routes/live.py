import asyncio
import base64
import hashlib
import json
import uuid
from datetime import date, datetime, timedelta
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, delete
from app.db.database import user_session
from app.models.domain import LiveTicket, User, Profile, ActivityEvent, now
from app.services.conversations import owned_conversation, store_messages
from app.services.analytics import daily_summary, game_trends
from app.services.retrieval import assemble_context, search_memory, SYSTEM_INSTRUCTION
from app.settings import get_settings

router = APIRouter()

TOOLS = [{"function_declarations": [
    {"name": "get_daily_metrics", "description": "Read structured daily measurements; unavailable values are null.", "parameters": {"type": "OBJECT", "properties": {"day": {"type": "STRING", "description": "YYYY-MM-DD"}}, "required": ["day"]}},
    {"name": "get_game_trends", "description": "Read SQL-calculated game improvement. Never calculate scores yourself.", "parameters": {"type": "OBJECT", "properties": {"game_code": {"type": "STRING", "enum": ["g1", "g2", "g3", "g4"]}, "start_date": {"type": "STRING"}, "end_date": {"type": "STRING"}}, "required": ["game_code", "start_date", "end_date"]}},
    {"name": "get_activity_history", "description": "Read a bounded activity history.", "parameters": {"type": "OBJECT", "properties": {"start_date": {"type": "STRING"}, "end_date": {"type": "STRING"}}, "required": ["start_date", "end_date"]}},
    {"name": "search_narrative_memory", "description": "Find relevant past narrative memory, optionally restricted by dates.", "parameters": {"type": "OBJECT", "properties": {"query": {"type": "STRING"}, "start_date": {"type": "STRING"}, "end_date": {"type": "STRING"}}, "required": ["query"]}},
]}]

async def call_tool(user_id, name, args):
    # No model-supplied user ID or arbitrary SQL is accepted.
    allowed = {"get_daily_metrics": {"day"}, "get_game_trends": {"game_code", "start_date", "end_date"}, "get_activity_history": {"start_date", "end_date"}, "search_narrative_memory": {"query", "start_date", "end_date"}}
    if name not in allowed or set(args) - allowed[name]:
        return {"error": "Unsupported tool arguments"}
    try:
        start = date.fromisoformat(args["start_date"]) if args.get("start_date") else None
        end = date.fromisoformat(args["end_date"]) if args.get("end_date") else None
        if start and end and not 0 < (end - start).days <= 366:
            raise ValueError("Invalid date range")
        if name == "search_narrative_memory":
            return {"memories": await search_memory(user_id, str(args["query"])[:2000], start, end)}
        with user_session(user_id) as db:
            if name == "get_daily_metrics":
                return jsonable_encoder(daily_summary(db, user_id, date.fromisoformat(args["day"])))
            if name == "get_game_trends":
                return jsonable_encoder(game_trends(db, user_id, args["game_code"], start, end))
            from app.services.analytics import day_bounds
            p = db.get(Profile, user_id)
            lower, _ = day_bounds(start, p.timezone)
            upper, _ = day_bounds(end, p.timezone)
            rows = db.scalars(select(ActivityEvent).where(ActivityEvent.user_id == user_id, ActivityEvent.occurred_at >= lower, ActivityEvent.occurred_at < upper).order_by(ActivityEvent.occurred_at.desc()).limit(20)).all()
            return {"events": [{"type": r.event_type, "activity": r.activity_code, "occurred_at": r.occurred_at.isoformat()} for r in rows]}
    except Exception:
        return {"error": "Data unavailable or invalid date range"}

@router.websocket("/live/ws")
async def live_socket(ws: WebSocket):
    await ws.accept()
    settings = get_settings()
    if not settings.live_enabled or not settings.gemini_api_key:
        await ws.close(1013)
        return
    user_id, ticket_id = None, None
    try:
        hello = await asyncio.wait_for(ws.receive_json(), 5)
        if len(json.dumps(hello)) > 2048:
            raise ValueError("Oversized authentication frame")
        user_id = uuid.UUID(hello["user_id"])
        digest = hashlib.sha256(hello["ticket"].encode()).hexdigest()
        with user_session(user_id) as db:
            ticket = db.scalar(select(LiveTicket).where(LiveTicket.user_id == user_id, LiveTicket.token_hash == digest, LiveTicket.used.is_(False), LiveTicket.expires_at > now()).with_for_update())
            if not ticket or db.get(User, user_id).status != "active":
                raise ValueError("Invalid ticket")
            conversation_id = ticket.conversation_id
            ticket_id = ticket.id
            conversation = owned_conversation(db, user_id, conversation_id)
            language = conversation.language
            profile_updated_at = db.get(Profile, user_id).updated_at
            ticket.used = True
            ticket.expires_at = now() + timedelta(seconds=settings.live_max_session_seconds)
        context = await assemble_context(user_id, conversation_id, "Relevant preferences for this conversation")
        from google import genai
        from google.genai import types
        config = types.LiveConnectConfig(response_modalities=["AUDIO"], input_audio_transcription={}, output_audio_transcription={},
            system_instruction=SYSTEM_INSTRUCTION + f"\nRespond in {language}. Initial evidence: {context}", tools=TOOLS)
        async with genai.Client(api_key=settings.gemini_api_key).aio as client:
            async with client.live.connect(model=settings.gemini_live_model, config=config) as session:
                await ws.send_json({"type": "ready", "conversation_id": str(conversation_id)})
                transcript = {"user": "", "assistant": ""}
                turn_id = uuid.uuid4().hex
                tool_count = 0
                pending_tools = {}

                async def respond_to_tool(call):
                    try:
                        result = await call_tool(user_id, call.name, call.args or {})
                        if call.id in pending_tools:
                            await session.send_tool_response(function_responses=[types.FunctionResponse(id=call.id, name=call.name, response=result)])
                    except asyncio.CancelledError:
                        raise
                    except Exception:
                        pass
                    finally:
                        pending_tools.pop(call.id, None)

                async def inbound():
                    last_check = 0.0
                    loop = asyncio.get_running_loop()
                    window_start, byte_count = loop.time(), 0
                    while True:
                        frame = await asyncio.wait_for(ws.receive(), timeout=30)
                        if frame["type"] == "websocket.disconnect":
                            return
                        if loop.time() - last_check > 3:
                            with user_session(user_id) as db:
                                if db.get(User, user_id).status != "active":
                                    return
                                profile = db.get(Profile, user_id)
                                if not profile or profile.updated_at != profile_updated_at:
                                    return
                                owned_conversation(db, user_id, conversation_id)
                            last_check = loop.time()
                        audio = frame.get("bytes")
                        if audio is not None:
                            if len(audio) > 16384 or len(audio) % 2:
                                raise ValueError("Invalid PCM frame")
                            if loop.time() - window_start >= 1:
                                window_start, byte_count = loop.time(), 0
                            byte_count += len(audio)
                            if byte_count > 96000:
                                raise ValueError("Audio rate limit exceeded")
                            await session.send_realtime_input(audio=types.Blob(data=audio, mime_type="audio/pcm;rate=16000"))
                        elif frame.get("text"):
                            if len(frame["text"]) > 5000:
                                raise ValueError("Oversized control frame")
                            control = json.loads(frame["text"])
                            if control.get("type") == "stop":
                                return
                            if control.get("type") == "audio_end":
                                await session.send_realtime_input(audio_stream_end=True)

                async def outbound():
                    nonlocal turn_id, tool_count
                    while True:
                        async for response in session.receive():
                            if response.go_away:
                                await ws.send_json({"type": "error", "message": "Voice session is ending. Tap to start a new session."})
                                return
                            if response.tool_call_cancellation:
                                for call_id in response.tool_call_cancellation.ids:
                                    task = pending_tools.pop(call_id, None)
                                    if task:
                                        task.cancel()
                            if response.tool_call:
                                for call in response.tool_call.function_calls:
                                    tool_count += 1
                                    if tool_count <= 6:
                                        pending_tools[call.id] = asyncio.create_task(respond_to_tool(call))
                                    else:
                                        await session.send_tool_response(function_responses=[types.FunctionResponse(id=call.id, name=call.name, response={"error": "Tool budget exceeded"})])
                            content = response.server_content
                            if not content:
                                continue
                            if content.input_transcription and content.input_transcription.text:
                                transcript["user"] = (transcript["user"] + content.input_transcription.text)[-8000:]
                                await ws.send_json({"type": "transcript", "role": "user", "text": transcript["user"]})
                            if content.output_transcription and content.output_transcription.text:
                                transcript["assistant"] = (transcript["assistant"] + content.output_transcription.text)[-8000:]
                                await ws.send_json({"type": "transcript", "role": "assistant", "text": transcript["assistant"]})
                            if content.model_turn:
                                for part in content.model_turn.parts:
                                    if part.inline_data and part.inline_data.data:
                                        await ws.send_json({"type": "audio", "data": base64.b64encode(part.inline_data.data).decode(), "sample_rate": 24000})
                            if content.interrupted or content.turn_complete:
                                for task in list(pending_tools.values()):
                                    task.cancel()
                                pending_tools.clear()
                                if content.interrupted:
                                    await ws.send_json({"type": "interrupted"})
                                with user_session(user_id) as db:
                                    stored = store_messages(db, user_id, conversation_id, list(transcript.items()), turn_id, bool(content.interrupted))
                                await ws.send_json({"type": "turn_complete", "event_id": turn_id, "stored": stored})
                                transcript.update(user="", assistant="")
                                turn_id, tool_count = uuid.uuid4().hex, 0
                tasks = [asyncio.create_task(inbound()), asyncio.create_task(outbound())]
                try:
                    done, _ = await asyncio.wait(tasks, timeout=settings.live_max_session_seconds, return_when=asyncio.FIRST_COMPLETED)
                    for task in done:
                        task.result()
                finally:
                    for task in tasks:
                        task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
                    tool_tasks = list(pending_tools.values())
                    for task in tool_tasks:
                        task.cancel()
                    await asyncio.gather(*tool_tasks, return_exceptions=True)
                    if any(transcript.values()):
                        with user_session(user_id) as db:
                            store_messages(db, user_id, conversation_id, list(transcript.items()), turn_id, True)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception:
        # Do not log audio, transcripts, provider exceptions or bearer credentials.
        try:
            await ws.send_json({"type": "error", "message": "Voice session ended. Please reconnect."})
        except Exception:
            pass
    finally:
        if user_id and ticket_id:
            try:
                with user_session(user_id) as db:
                    db.execute(delete(LiveTicket).where(LiveTicket.user_id == user_id, LiveTicket.id == ticket_id))
                    from app.models.domain import Conversation
                    conversation = db.get(Conversation, conversation_id)
                    if conversation:
                        conversation.status = "closed"
                        conversation.ended_at = now()
            except Exception:
                pass
        try:
            await ws.close()
        except Exception:
            pass
