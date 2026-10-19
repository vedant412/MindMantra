"""Bounded live lookups that survive normal model turn boundaries."""
import asyncio
from google.genai import types

LOOKUP_LABELS = {
    "en": "Getting information…",
    "hi": "जानकारी प्राप्त की जा रही है…",
    "mr": "माहिती मिळवत आहे…",
}

class LiveToolRunner:
    def __init__(self, session, send_event, lookup, language):
        self.session, self.send_event, self.lookup = session, send_event, lookup
        self.language = language if language in LOOKUP_LABELS else "en"
        self.pending = {}

    async def dispatch(self, call):
        if call.id in self.pending:
            return
        if len(self.pending) >= 6:
            await self.session.send_tool_response(function_responses=[types.FunctionResponse(
                id=call.id, name=call.name, response={"error": "Too many pending lookups"})])
            return
        task = asyncio.create_task(self._run(call))
        self.pending[call.id] = task
        task.add_done_callback(lambda done: None if done.cancelled() else done.exception())

    async def _run(self, call):
        try:
            await self.send_event({"type": "lookup_status", "id": call.id, "phase": "started",
                "language": self.language, "message": LOOKUP_LABELS[self.language]})
            try:
                result = await asyncio.wait_for(self.lookup(call.name, call.args or {}), timeout=20)
            except asyncio.CancelledError:
                raise
            except Exception:
                result = {"error": "Information is temporarily unavailable"}
            if call.id in self.pending:
                await self.session.send_tool_response(function_responses=[types.FunctionResponse(
                    id=call.id, name=call.name, response=result, scheduling="WHEN_IDLE")])
        finally:
            self.pending.pop(call.id, None)
            try:
                await self.send_event({"type": "lookup_status", "id": call.id, "phase": "finished"})
            except Exception:
                pass

    def cancel(self, ids=None):
        for call_id in list(self.pending) if ids is None else ids:
            task = self.pending.get(call_id)
            if task:
                task.cancel()

    async def close(self):
        tasks = list(self.pending.values())
        self.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        self.pending.clear()
