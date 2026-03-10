"""Agent API — two-tier AI architecture with Frontend AI and Worker AI.

Frontend AI: user-facing, answers from page context or delegates CRM work.
Worker AI: CRM agent with crm CLI access, domain knowledge, shift skills.
Delegation: in-process MCP server bridges the two asynchronously.
"""

import asyncio
import json
import logging
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
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
)

import mcp_worker

# ---------------------------------------------------------------------------
# SDK options
# ---------------------------------------------------------------------------
WORKER_OPTIONS = ClaudeCodeOptions(
    cwd="/workspace",
    permission_mode="bypassPermissions",
)

FRONTEND_SYSTEM_PROMPT = """\
You are Lette, an AI assistant for BTR/PRS property managers in Ireland.

## Rules
1. **Check page context first.** Each message may include `[Page context: {...}]` \
with JSON data from the user's screen. If you can answer from this data, respond \
immediately — no tools needed.
2. **Delegate CRM queries.** For data not in page context, call delegate_to_worker \
with a clear prompt, then get_worker_result to retrieve the answer.
3. **Be concise.** Short, helpful answers. Use markdown. Don't narrate tool usage.
4. **Acknowledge before delegating.** Say something brief like "Let me check that." \
before calling delegate_to_worker.

## delegate_to_worker prompts
Write clear, specific CRM queries. The worker has full CRM access via CLI. Examples:
- "List all unread email threads for property Graylings"
- "Get case 5 with all emails, tasks, and notes"
- "Search emails for 'water leak' and summarize findings"
- "Create a task: Schedule plumber for Unit 4B, priority urgent, case 3"

## Page context formats
- Dashboard (page: "dashboard"): caseCount, openCaseCount, stats, topCases[]
- Situation (page: "situation"): caseId, caseName, priority, status, tasks[], \
draftCount, contactNames[]
- Properties (page: "properties"): properties[] (name, type, units, manager)
- Search (page: "search"): query, resultCount, topResults[]
"""

FRONTEND_OPTIONS = ClaudeCodeOptions(
    cwd="/tmp",
    permission_mode="bypassPermissions",
    model="eu.anthropic.claude-sonnet-4-20250514-v1:0",
    extra_args={"effort": "low"},
    append_system_prompt=FRONTEND_SYSTEM_PROMPT,
    mcp_servers={"worker_delegation": mcp_worker.delegation_server},
    allowed_tools=[
        "mcp__worker_delegation__delegate_to_worker",
        "mcp__worker_delegation__get_worker_result",
    ],
    max_turns=10,
)

# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------
_RESPONSE_TIMEOUT = 300  # seconds per message

# Worker AI
_worker_client: ClaudeSDKClient | None = None
_worker_session_id: str | None = None
_worker_msg_count: int = 0

# Frontend AI
_frontend_client: ClaudeSDKClient | None = None
_frontend_session_id: str | None = None
_frontend_msg_count: int = 0

_busy: bool = False


async def _ensure_worker() -> ClaudeSDKClient:
    global _worker_client, _worker_session_id
    if _worker_client is None:
        _worker_client = ClaudeSDKClient(options=WORKER_OPTIONS)
        await _worker_client.connect()
        _worker_session_id = str(uuid.uuid4())
        log.info("[worker] connected session=%s", _worker_session_id)
    return _worker_client


async def _teardown_worker() -> None:
    global _worker_client, _worker_session_id, _worker_msg_count
    if _worker_client is not None:
        try:
            await _worker_client.disconnect()
        except Exception:
            pass
        _worker_client = None
    _worker_session_id = None
    _worker_msg_count = 0


async def _ensure_frontend() -> ClaudeSDKClient:
    global _frontend_client, _frontend_session_id
    if _frontend_client is None:
        _frontend_client = ClaudeSDKClient(options=FRONTEND_OPTIONS)
        await _frontend_client.connect()
        _frontend_session_id = str(uuid.uuid4())
        log.info("[frontend] connected session=%s", _frontend_session_id)
    return _frontend_client


async def _teardown_frontend() -> None:
    global _frontend_client, _frontend_session_id, _frontend_msg_count
    if _frontend_client is not None:
        try:
            await _frontend_client.disconnect()
        except Exception:
            pass
        _frontend_client = None
    _frontend_session_id = None
    _frontend_msg_count = 0


# Wire up MCP worker with our ensure_worker function
mcp_worker.configure(ensure_worker=_ensure_worker)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await _teardown_frontend()
    await _teardown_worker()


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
# Helpers
# ---------------------------------------------------------------------------
def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _is_delegation_tool(name: str) -> bool:
    """Check if a tool call is a delegation MCP tool (hide from user)."""
    return "delegate_to_worker" in name or "get_worker_result" in name


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.post("/prompt")
async def prompt(req: PromptRequest) -> PromptResponse:
    """Non-streaming prompt — routes through Frontend AI."""
    global _busy, _frontend_msg_count

    if _busy:
        raise HTTPException(status_code=409, detail="Agent is busy with another request.")

    _busy = True
    import time as _time
    t0 = _time.monotonic()
    log.info("[prompt] query: %s", req.message[:120])
    try:
        client = await _ensure_frontend()
        prompt_text = req.message
        if req.context:
            prompt_text = f"[Page context: {req.context}]\n\n{req.message}"
        await client.query(prompt_text)

        text_parts: list[str] = []
        async for msg in client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, ToolUseBlock):
                        text_parts.clear()
                    elif isinstance(block, TextBlock):
                        text_parts.append(block.text)

        _frontend_msg_count += 1
        log.info("[prompt] done in %.0fs", _time.monotonic() - t0)

        return PromptResponse(
            response="\n\n".join(text_parts) or "(no response)",
            session_id=_frontend_session_id or "",
        )
    except HTTPException:
        raise
    except Exception as exc:
        log.error("[prompt] error after %.0fs: %s", _time.monotonic() - t0, exc)
        await _teardown_frontend()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        _busy = False


@app.post("/prompt/stream")
async def prompt_stream(req: PromptRequest):
    """SSE streaming endpoint — two-tier: Frontend AI answers or delegates to Worker.

    Uses an asyncio.Queue to bridge between the SDK consumer and the SSE generator.
    Worker tool_use events are pushed to the same queue by the MCP handler, so the
    user sees CRM tool progress in real time even while the Frontend AI waits.
    """
    global _busy

    if _busy:
        raise HTTPException(status_code=409, detail="Agent is busy with another request.")

    _busy = True

    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def _consume():
        global _frontend_msg_count
        try:
            # Wire up worker events to this stream's queue
            mcp_worker.set_sse_queue(queue)

            client = await _ensure_frontend()
            log.info("[stream] frontend ready, session=%s msg_count=%d",
                     _frontend_session_id, _frontend_msg_count)
            await queue.put(_sse_event("status", {"status": "thinking"}))

            prompt_text = req.message
            if req.context:
                prompt_text = f"[Page context: {req.context}]\n\n{req.message}"

            log.info("[stream] calling frontend AI query()...")
            await asyncio.wait_for(client.query(prompt_text), timeout=_RESPONSE_TIMEOUT)
            log.info("[stream] query() returned, starting receive_response()...")

            text_parts: list[str] = []
            loop = asyncio.get_event_loop()
            cm = asyncio.timeout_at(loop.time() + _RESPONSE_TIMEOUT)
            async with cm:
                async for msg in client.receive_response():
                    cm.reschedule(loop.time() + _RESPONSE_TIMEOUT)
                    if isinstance(msg, AssistantMessage):
                        for block in msg.content:
                            if isinstance(block, ToolUseBlock):
                                if not _is_delegation_tool(block.name):
                                    await queue.put(
                                        _sse_event("tool_use", {"tool": block.name})
                                    )
                                else:
                                    log.info("[stream] delegation: %s", block.name)
                                text_parts.clear()
                            elif isinstance(block, ToolResultBlock):
                                pass  # handled internally by SDK
                            elif isinstance(block, TextBlock):
                                log.info("[stream] text: %s...", block.text[:80])
                                text_parts.append(block.text)
                                await queue.put(
                                    _sse_event("text", {"text": block.text})
                                )

            _frontend_msg_count += 1
            await queue.put(
                _sse_event("done", {"response": "\n\n".join(text_parts) or "(no response)"})
            )
        except TimeoutError:
            log.error("[stream] timeout — no messages for %ds", _RESPONSE_TIMEOUT)
            await _teardown_frontend()
            await queue.put(
                _sse_event("error", {"detail": f"Response timed out after {_RESPONSE_TIMEOUT}s. Please try again."})
            )
        except Exception as exc:
            log.error("[stream] error: %s", exc)
            await _teardown_frontend()
            await queue.put(_sse_event("error", {"detail": str(exc)}))
        finally:
            mcp_worker.set_sse_queue(None)
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
    """Start a batch shift — restart worker session, run /shift skill, return summary."""
    global _busy

    if _busy:
        raise HTTPException(status_code=409, detail="Agent is busy with another request.")

    _busy = True
    import time as _time
    t0 = _time.monotonic()
    tool_count = 0
    log.info("[shift] starting — tearing down old worker session")
    try:
        await _teardown_worker()
        client = await _ensure_worker()
        log.info("[shift] worker ready (%s), sending /shift skill", _worker_session_id)
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
                            tool_count += 1
                            elapsed = _time.monotonic() - t0
                            log.info("[shift] tool #%d: %s (%.0fs elapsed)",
                                     tool_count, block.name, elapsed)
                            text_parts.clear()
                        elif isinstance(block, TextBlock):
                            text_parts.append(block.text)
                            snippet = block.text[:120].replace("\n", " ")
                            log.info("[shift] text: %s%s", snippet,
                                     "…" if len(block.text) > 120 else "")

        global _worker_msg_count
        _worker_msg_count += 1
        elapsed = _time.monotonic() - t0
        log.info("[shift] complete — %d tool calls in %.0fs", tool_count, elapsed)

        return {
            "response": "\n\n".join(text_parts) or "(no response)",
            "session_id": _worker_session_id or "",
        }
    except TimeoutError:
        elapsed = _time.monotonic() - t0
        log.error("[shift] timeout after %.0fs (%d tool calls) — no SDK messages for %ds",
                  elapsed, tool_count, _RESPONSE_TIMEOUT)
        await _teardown_worker()
        raise HTTPException(status_code=504,
                            detail=f"Shift timed out after {_RESPONSE_TIMEOUT}s of inactivity.")
    except HTTPException:
        raise
    except Exception as exc:
        elapsed = _time.monotonic() - t0
        log.error("[shift] error after %.0fs (%d tool calls): %s", elapsed, tool_count, exc)
        await _teardown_worker()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        _busy = False


@app.post("/session/restart")
async def restart_session():
    global _busy
    _busy = False
    await _teardown_frontend()
    await _teardown_worker()
    return {"status": "restarted"}


@app.get("/session/status")
async def session_status():
    return {
        # Backward-compatible top-level fields
        "active": _frontend_session_id is not None or _worker_session_id is not None,
        "session_id": _frontend_session_id,
        "message_count": _frontend_msg_count + _worker_msg_count,
        "busy": _busy,
        # Detailed per-session info
        "frontend": {
            "session_id": _frontend_session_id,
            "message_count": _frontend_msg_count,
        },
        "worker": {
            "session_id": _worker_session_id,
            "message_count": _worker_msg_count,
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
