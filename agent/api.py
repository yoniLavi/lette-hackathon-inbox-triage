"""Agent API — thin FastAPI wrapper around Claude Code SDK with EspoMCP."""

import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("agent")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from claude_code_sdk import ClaudeSDKClient
from claude_code_sdk.types import (
    AssistantMessage,
    ClaudeCodeOptions,
    McpStdioServerConfig,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock,
)

# ---------------------------------------------------------------------------
# SDK options (shared across sessions)
# ---------------------------------------------------------------------------
SDK_OPTIONS = ClaudeCodeOptions(
    cwd="/workspace",
    mcp_servers={
        "espocrm": McpStdioServerConfig(
            command="node",
            args=["/opt/espomcp/build/index.js"],
            env={
                "ESPOCRM_URL": os.environ.get("ESPOCRM_INTERNAL_URL", "http://espocrm"),
                "ESPOCRM_API_KEY": os.environ.get("ESPOCRM_API_KEY", ""),
                "ESPOCRM_AUTH_METHOD": "apikey",
            },
        ),
    },
    permission_mode="bypassPermissions",
)

# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------
_RESPONSE_TIMEOUT = 90  # seconds — tear down session if SDK goes silent

_client: ClaudeSDKClient | None = None
_session_id: str | None = None
_message_count: int = 0
_busy: bool = False


async def _ensure_client() -> ClaudeSDKClient:
    """Return the current client, creating one if needed."""
    global _client, _session_id
    if _client is None:
        _client = ClaudeSDKClient(options=SDK_OPTIONS)
        await _client.connect()
        _session_id = str(uuid.uuid4())
    return _client


async def _teardown_client() -> None:
    """Disconnect and discard the current client."""
    global _client, _session_id, _message_count
    if _client is not None:
        try:
            await _client.disconnect()
        except Exception:
            pass
        _client = None
    _session_id = None
    _message_count = 0


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await _teardown_client()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class PromptRequest(BaseModel):
    message: str
    context: str | None = None  # page context from the frontend


class PromptResponse(BaseModel):
    response: str
    session_id: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/prompt")
async def prompt(req: PromptRequest) -> PromptResponse:
    global _busy, _message_count

    if _busy:
        raise HTTPException(status_code=409, detail="Agent is busy with another request.")

    _busy = True
    try:
        client = await _ensure_client()
        prompt = req.message
        if req.context:
            prompt = f"[Page context: {req.context}]\n\n{req.message}"
        await client.query(prompt)

        text_parts: list[str] = []
        async for msg in client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, ToolUseBlock):
                        text_parts.clear()
                    elif isinstance(block, TextBlock):
                        text_parts.append(block.text)

        _message_count += 1

        return PromptResponse(
            response="\n\n".join(text_parts) or "(no response)",
            session_id=_session_id or "",
        )
    except HTTPException:
        raise
    except Exception as exc:
        await _teardown_client()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        _busy = False


@app.post("/prompt/stream")
async def prompt_stream(req: PromptRequest):
    """SSE streaming endpoint — sends tool_use, text, and done events.

    Uses an asyncio.Queue to bridge between the SDK response consumer
    (a regular coroutine) and the SSE generator.  This avoids iterating
    the anyio-backed receive_response() inside a Starlette async-generator,
    which hangs on multi-turn conversations.
    """
    global _busy

    if _busy:
        raise HTTPException(status_code=409, detail="Agent is busy with another request.")

    _busy = True

    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def _consume():
        """Read SDK response and push SSE strings into the queue.

        Intermediate TextBlocks (before/between tool calls) are streamed as
        'progress' events for the status indicator.  Only text after the last
        tool call is used as the final response.
        """
        global _message_count
        try:
            client = await _ensure_client()
            log.info("[stream] client ready, session=%s msg_count=%d", _session_id, _message_count)
            await queue.put(_sse_event("status", {"status": "thinking"}))

            # Prepend page context to the user's message on the first turn
            prompt = req.message
            if req.context:
                prompt = f"[Page context: {req.context}]\n\n{req.message}"

            log.info("[stream] calling client.query()...")
            await asyncio.wait_for(client.query(prompt), timeout=_RESPONSE_TIMEOUT)
            log.info("[stream] query() returned, starting receive_response()...")

            # text_parts collects text blocks. On each ToolUseBlock we clear it,
            # so the done event only contains text after the last tool call.
            # If no tools are used, all text is the final response.
            text_parts: list[str] = []
            # Resetting deadline: each SDK message pushes it forward,
            # so long multi-tool sequences that make progress won't time out.
            loop = asyncio.get_event_loop()
            cm = asyncio.timeout_at(loop.time() + _RESPONSE_TIMEOUT)
            async with cm:
                async for msg in client.receive_response():
                    cm.reschedule(loop.time() + _RESPONSE_TIMEOUT)
                    log.info("SDK message: type=%s", type(msg).__name__)
                    if isinstance(msg, AssistantMessage):
                        log.info("  AssistantMessage blocks: %s", [type(b).__name__ for b in msg.content])
                        for block in msg.content:
                            if isinstance(block, ToolUseBlock):
                                log.info("  ToolUseBlock: %s", block.name)
                                # Discard intermediate text — it's reasoning, not the answer
                                text_parts.clear()
                                await queue.put(_sse_event("tool_use", {"tool": block.name}))
                            elif isinstance(block, ToolResultBlock):
                                log.info("  ToolResultBlock")
                                await queue.put(_sse_event("tool_result", {"tool": getattr(block, "name", "")}))
                            elif isinstance(block, TextBlock):
                                log.info("  TextBlock: %s...", block.text[:80])
                                text_parts.append(block.text)
                                # Always send text events — the frontend uses the done event for the final response
                                await queue.put(_sse_event("text", {"text": block.text}))

            _message_count += 1
            await queue.put(_sse_event("done", {"response": "\n\n".join(text_parts) or "(no response)"}))
        except TimeoutError:
            log.error("[stream] timeout — no SDK messages for %ds", _RESPONSE_TIMEOUT)
            await _teardown_client()
            await queue.put(_sse_event("error", {"detail": f"Response timed out after {_RESPONSE_TIMEOUT}s. Please try again."}))
        except Exception as exc:
            log.error("[stream] error: %s", exc)
            await _teardown_client()
            await queue.put(_sse_event("error", {"detail": str(exc)}))
        finally:
            await queue.put(None)  # sentinel

    async def generate():
        global _busy
        try:
            yield _sse_event("status", {"status": "connecting"})
            task = asyncio.create_task(_consume())
            try:
                while True:
                    event = await queue.get()
                    if event is None:
                        break
                    yield event
            finally:
                # Ensure the consumer task finishes even if the client disconnects
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
        finally:
            _busy = False

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/shift")
async def shift():
    """Start a batch shift — restart session, run /shift skill, return summary."""
    global _busy

    if _busy:
        raise HTTPException(status_code=409, detail="Agent is busy with another request.")

    _busy = True
    try:
        # Always start with a fresh session for a shift
        await _teardown_client()
        client = await _ensure_client()
        await client.query("/shift")

        text_parts: list[str] = []
        loop = asyncio.get_event_loop()
        cm = asyncio.timeout_at(loop.time() + _RESPONSE_TIMEOUT)
        async with cm:
            async for msg in client.receive_response():
                cm.reschedule(loop.time() + _RESPONSE_TIMEOUT)
                if isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, ToolUseBlock):
                            text_parts.clear()
                        elif isinstance(block, TextBlock):
                            text_parts.append(block.text)

        global _message_count
        _message_count += 1

        return {
            "response": "\n\n".join(text_parts) or "(no response)",
            "session_id": _session_id or "",
        }
    except TimeoutError:
        log.error("[shift] timeout — no SDK messages for %ds", _RESPONSE_TIMEOUT)
        await _teardown_client()
        raise HTTPException(status_code=504, detail=f"Shift timed out after {_RESPONSE_TIMEOUT}s of inactivity.")
    except HTTPException:
        raise
    except Exception as exc:
        await _teardown_client()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        _busy = False


@app.post("/session/restart")
async def restart_session():
    global _busy
    _busy = False
    await _teardown_client()
    return {"status": "restarted"}


@app.get("/session/status")
async def session_status():
    return {
        "active": _session_id is not None,
        "session_id": _session_id,
        "message_count": _message_count,
        "busy": _busy,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
