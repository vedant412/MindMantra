import asyncio
from contextlib import contextmanager
from datetime import datetime, timezone
from types import SimpleNamespace as NS
from uuid import uuid4

from app.routes import live
from app.services.live_tools import LiveToolRunner, LOOKUP_LABELS


def test_hands_free_configuration():
    config = live.live_config("{}", "mr")
    assert config.realtime_input_config.automatic_activity_detection.disabled is False
    assert config.realtime_input_config.activity_handling == "START_OF_ACTIVITY_INTERRUPTS"
    assert config.context_window_compression.sliding_window is not None
    assert "Respond in mr" in config.system_instruction
    assert "Never speak lookup announcements" in config.system_instruction
    assert "suggest 2-3 relevant activities" in config.system_instruction
    assert set(LOOKUP_LABELS) == {"en", "hi", "mr"}


def test_same_live_session_survives_turns_and_finishes_pending_lookup(monkeypatch):
    from google import genai

    async def scenario():
        owner, conversation_id = uuid4(), uuid4()
        ticket = NS(id=uuid4(), conversation_id=conversation_id, used=False, expires_at=None)
        conversation = NS(language="en", status="active", ended_at=None)
        profile = NS(updated_at=datetime.now(timezone.utc), memory_enabled=False)
        release_lookup = asyncio.Event()
        lookup_started = asyncio.Event()
        turns = asyncio.Queue()

        class Database:
            def scalar(self, query): return ticket
            def execute(self, query): pass
            def get(self, model, key):
                if model is live.User: return NS(status="active")
                if model is live.Profile: return profile
                return conversation
        @contextmanager
        def scoped(user_id):
            assert user_id == owner
            yield Database()

        class Socket:
            def __init__(self): self.events, self.frames, self.ready = [], asyncio.Queue(), asyncio.Event()
            async def accept(self): pass
            async def receive_json(self): return {"user_id": str(owner), "ticket": "test-only-ticket"}
            async def receive(self): return await self.frames.get()
            async def send_json(self, event):
                self.events.append(event)
                if event["type"] == "ready": self.ready.set()
                if event["type"] == "turn_complete": await turns.put(event)
                if event["type"] == "lookup_status" and event["phase"] == "started": lookup_started.set()
            async def close(self, *args): pass
        socket = Socket()

        def message(text, call=None):
            return NS(go_away=None, tool_call_cancellation=None, tool_call=NS(function_calls=[call]) if call else None,
                server_content=NS(input_transcription=None, output_transcription=NS(text=text), model_turn=None,
                    interrupted=False, turn_complete=True))
        class Session:
            def __init__(self): self.messages, self.frames, self.responses, self.greetings = asyncio.Queue(), [], [], 0
            async def send_client_content(self, **kwargs):
                self.greetings += 1
                await self.messages.put(message("Hello, how are you?"))
            async def send_realtime_input(self, **kwargs):
                self.frames.append(kwargs)
                call = NS(id="lookup-one", name="get_daily_metrics", args={"day": "2026-10-19"}) if len(self.frames) == 1 else None
                await self.messages.put(message("Checking" if call else "Let's continue.", call))
            async def send_tool_response(self, **kwargs):
                self.responses.extend(kwargs["function_responses"])
                await self.messages.put(message("Here is your result."))
            async def receive(self):
                yield await self.messages.get()
        session = Session()
        class Connection:
            async def __aenter__(self): return session
            async def __aexit__(self, *args): pass
        class Client:
            def __init__(self): self.aio, self.live, self.connections = self, self, 0
            async def __aenter__(self): return self
            async def __aexit__(self, *args): pass
            def connect(self, **kwargs): self.connections += 1; return Connection()
        client = Client()
        async def context(*args): return "{}"
        async def lookup(user_id, name, args):
            assert user_id == owner
            await release_lookup.wait()
            return {"score": None}
        monkeypatch.setattr(live, "user_session", scoped)
        monkeypatch.setattr(live, "owned_conversation", lambda *args: conversation)
        monkeypatch.setattr(live, "check_live_owner", lambda *args: True)
        monkeypatch.setattr(live, "save_live_turn", lambda *args: False)
        monkeypatch.setattr(live, "assemble_context", context)
        monkeypatch.setattr(live, "call_tool", lookup)
        monkeypatch.setattr(live, "get_settings", lambda: NS(live_enabled=True, gemini_api_key="test-only",
            live_max_session_seconds=5, gemini_live_model="test-model", rag_enabled=False))
        monkeypatch.setattr(genai, "Client", lambda **kwargs: client)

        async def user():
            await socket.ready.wait()
            await turns.get()  # One automatic greeting.
            await socket.frames.put({"type": "websocket.receive", "bytes": b"\x00\x00" * 1600})
            await lookup_started.wait()
            await turns.get()  # The acknowledgment's turn ends while lookup is pending.
            release_lookup.set()
            await turns.get()  # Lookup result arrives without another button press.
            await socket.frames.put({"type": "websocket.receive", "bytes": b"\x00\x00" * 1600})
            await turns.get()  # Second spoken input on the same connection.
            await socket.frames.put({"type": "websocket.receive", "text": '{"type":"stop"}'})
        await asyncio.wait_for(asyncio.gather(live.live_socket(socket), user()), timeout=6)
        assert client.connections == 1
        assert session.greetings == 1
        assert len(session.frames) == 2
        assert len(session.responses) == 1
        assert session.responses[0].response == {"score": None}
        assert session.responses[0].scheduling == "WHEN_IDLE"
        assert [event["phase"] for event in socket.events if event["type"] == "lookup_status"] == ["started", "finished"]
        assert sum(event["type"] == "turn_complete" for event in socket.events) == 4
        assert not any(event["type"] == "error" for event in socket.events)
    asyncio.run(scenario())


def test_interruption_cancels_lookup_and_releases_status():
    async def scenario():
        events = []
        started = asyncio.Event()
        class Session:
            async def send_tool_response(self, **kwargs): raise AssertionError("Cancelled result must not reach model")
        async def send(event): events.append(event)
        async def lookup(*args): started.set(); await asyncio.Event().wait()
        runner = LiveToolRunner(Session(), send, lookup, "hi")
        await runner.dispatch(NS(id="one", name="search_narrative_memory", args={"query": "test"}))
        await started.wait()
        runner.cancel(["one"])
        await runner.close()
        assert not runner.pending
        assert events[0]["language"] == "hi"
        assert events[-1]["phase"] == "finished"
    asyncio.run(scenario())
