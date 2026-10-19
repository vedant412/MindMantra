import asyncio
import base64
import hashlib
import json
import logging
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
from app.services.live_tools import LiveToolRunner, LOOKUP_LABELS
from app.services.activity_catalog import GAME_CODES

router = APIRouter()
logger = logging.getLogger(__name__)

def live_config(context, language):
    from google.genai import types
    return types.LiveConnectConfig(response_modalities=["AUDIO"], input_audio_transcription={}, output_audio_transcription={},
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(disabled=False, prefix_padding_ms=200, silence_duration_ms=800),
            activity_handling="START_OF_ACTIVITY_INTERRUPTS"),
        context_window_compression=types.ContextWindowCompressionConfig(sliding_window=types.SlidingWindow()),
        system_instruction=SYSTEM_INSTRUCTION + f"\nRespond in {language}. This is an ongoing hands-free conversation. "
            "Listen automatically after each reply and let the user interrupt naturally. Ask at most one follow-up question at a time. "
            "Retrieval progress appears only in the app status. Never speak lookup announcements such as checking information, "
            "getting info, let me look that up, or similar filler. Do not narrate tool calls or internal processing. "
            "Wait for actual tool results before answering factual questions about the user's records. "
            f"Initial evidence: {context}", tools=TOOLS)

def check_live_owner(user_id, conversation_id, profile_updated_at):
    with user_session(user_id) as db:
        account = db.get(User, user_id)
        profile = db.get(Profile, user_id)
        if not account or account.status != "active" or not profile or profile.updated_at != profile_updated_at:
            return False
        owned_conversation(db, user_id, conversation_id)
        return True

def save_live_turn(user_id, conversation_id, turns, turn_id, interrupted=False):
    with user_session(user_id) as db:
        return store_messages(db, user_id, conversation_id, turns, turn_id, interrupted)

TOOLS = [{"function_declarations": [
    {"name": "get_daily_metrics", "description": "Read structured daily measurements; unavailable values are null.", "parameters": {"type": "OBJECT", "properties": {"day": {"type": "STRING", "description": "YYYY-MM-DD"}}, "required": ["day"]}},
    {"name": "get_game_trends", "description": "Read SQL-calculated game improvement. Never calculate scores yourself.", "parameters": {"type": "OBJECT", "properties": {"game_code": {"type": "STRING", "enum": list(GAME_CODES)}, "start_date": {"type": "STRING"}, "end_date": {"type": "STRING"}}, "required": ["game_code", "start_date", "end_date"]}},
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
        return await asyncio.to_thread(structured_tool, user_id, name, args, start, end)
    except Exception:
        return {"error": "Data unavailable or invalid date range"}

def structured_tool(user_id, name, args, start, end):
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
            profile = db.get(Profile, user_id)
            profile_updated_at = profile.updated_at
            announce_memory = settings.rag_enabled and profile.memory_enabled
            ticket.used = True
            ticket.expires_at = now() + timedelta(seconds=settings.live_max_session_seconds)
        if announce_memory:
            await ws.send_json({"type": "lookup_status", "id": "initial-memory", "phase": "started",
                "language": language, "message": LOOKUP_LABELS.get(language, LOOKUP_LABELS["en"])})
        try:
            context = await assemble_context(user_id, conversation_id, "Relevant preferences for this conversation")
        finally:
            if announce_memory:
                await ws.send_json({"type": "lookup_status", "id": "initial-memory", "phase": "finished"})
        from google import genai
        from google.genai import types
        config = live_config(context, language)
        async with genai.Client(api_key=settings.gemini_api_key).aio as client:
            async with client.live.connect(model=settings.gemini_live_model, config=config) as session:
                await ws.send_json({"type": "ready", "conversation_id": str(conversation_id)})
                transcript = {"user": "", "assistant": ""}
                turn_id = uuid.uuid4().hex
                tool_count = 0
                send_lock = asyncio.Lock()
                async def send_event(event):
                    async with send_lock:
                        await ws.send_json(event)
                runner = LiveToolRunner(session, send_event, lambda name, args: call_tool(user_id, name, args), language)
                await session.send_client_content(turns={"role": "user", "parts": [{"text":
                    "Begin our conversation with a brief warm greeting and ask how I am feeling. Then listen for my reply."}]}, turn_complete=True)

                async def inbound():
                    loop = asyncio.get_running_loop()
                    window_start, byte_count = loop.time(), 0
                    while True:
                        frame = await asyncio.wait_for(ws.receive(), timeout=30)
                        if frame["type"] == "websocket.disconnect":
                            return
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

                async def monitor_owner():
                    # Database round trips must not hold up microphone frames.
                    while await asyncio.to_thread(check_live_owner, user_id, conversation_id, profile_updated_at):
                        await asyncio.sleep(3)

                async def outbound():
                    nonlocal turn_id, tool_count
                    while True:
                        async for response in session.receive():
                            if response.go_away:
                                await send_event({"type": "error", "message": "Voice session is ending. Tap to start a new session."})
                                return
                            if response.tool_call_cancellation:
                                runner.cancel(response.tool_call_cancellation.ids)
                            if response.tool_call:
                                for call in response.tool_call.function_calls:
                                    tool_count += 1
                                    if tool_count <= 6:
                                        await runner.dispatch(call)
                                    else:
                                        await session.send_tool_response(function_responses=[types.FunctionResponse(id=call.id, name=call.name, response={"error": "Tool budget exceeded"})])
                            content = response.server_content
                            if not content:
                                continue
                            if content.input_transcription and content.input_transcription.text:
                                transcript["user"] = (transcript["user"] + content.input_transcription.text)[-8000:]
                                await send_event({"type": "transcript", "role": "user", "text": transcript["user"]})
                            if content.output_transcription and content.output_transcription.text:
                                transcript["assistant"] = (transcript["assistant"] + content.output_transcription.text)[-8000:]
                                await send_event({"type": "transcript", "role": "assistant", "text": transcript["assistant"]})
                            if content.model_turn:
                                for part in content.model_turn.parts:
                                    if part.inline_data and part.inline_data.data:
                                        await send_event({"type": "audio", "data": base64.b64encode(part.inline_data.data).decode(), "sample_rate": 24000})
                            if content.interrupted or content.turn_complete:
                                # A normal response boundary does not end the session or
                                # cancel an asynchronous lookup still gathering results.
                                if content.interrupted:
                                    runner.cancel()
                                    await send_event({"type": "interrupted"})
                                stored = await asyncio.to_thread(save_live_turn, user_id, conversation_id,
                                    list(transcript.items()), turn_id, bool(content.interrupted))
                                await send_event({"type": "turn_complete", "event_id": turn_id, "stored": stored})
                                transcript.update(user="", assistant="")
                                turn_id, tool_count = uuid.uuid4().hex, 0
                tasks = [asyncio.create_task(inbound()), asyncio.create_task(outbound()), asyncio.create_task(monitor_owner())]
                try:
                    done, _ = await asyncio.wait(tasks, timeout=settings.live_max_session_seconds, return_when=asyncio.FIRST_COMPLETED)
                    for task in done:
                        task.result()
                finally:
                    for task in tasks:
                        task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
                    await runner.close()
                    if any(transcript.values()):
                        await asyncio.to_thread(save_live_turn, user_id, conversation_id, list(transcript.items()), turn_id, True)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception as error:
        logger.warning("Live session ended (%s)", type(error).__name__)
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
