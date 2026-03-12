"""Agent API — two-tier AI architecture with Frontend AI and Worker AI.

Frontend AI: direct Anthropic/Bedrock Messages API, answers from page context
or delegates CRM work and returns immediately.
Worker AI: Claude Code SDK session with crm CLI access, domain knowledge, shift skills.

Key design: the Frontend AI NEVER blocks on worker operations. When it delegates,
the worker runs in the background and results are delivered via /worker/status polling.
The user can continue chatting with the Frontend AI while the worker runs.
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
    ToolUseBlock,
)

import mcp_worker
from frontend_ai import FrontendAI

# ---------------------------------------------------------------------------
# SDK options (Worker AI only — Frontend AI uses direct Messages API)
# ---------------------------------------------------------------------------
WORKER_OPTIONS = ClaudeCodeOptions(
    cwd="/workspace",
    permission_mode="bypassPermissions",
)

FRONTEND_SYSTEM_PROMPT = """\
You are Lette, a concise AI assistant for property managers in Ireland.

## Tone
Be conversational and brief. One or two sentences is ideal. Only give long \
detailed answers when the user explicitly asks for detail (e.g. "list all", \
"explain", "give me everything"). If the user says "hi" or greets you, respond \
with a short friendly greeting and mention the single most pressing issue from \
page context (if available) — nothing more.

## Rules
1. **Check page context first.** Messages may include `[Page context: {...}]`. \
If you can answer from this context, do so — no tools needed.
2. **Delegate CRM queries.** For data not in page context, call delegate_to_worker \
with a clear prompt. After calling the tool, say a brief acknowledgment \
("Looking into that..." / "Checking the CRM...") and end your turn. The system \
will deliver the worker's result to the user automatically.
3. **Never narrate tool usage.** Don't say "I'll use delegate_to_worker". Just \
acknowledge naturally and delegate.
4. **Keep it short.** Don't dump all page context data back at the user — they \
can already see it. Only highlight what's relevant to their question.

## delegate_to_worker prompts
Write clear, specific CRM queries. Examples:
- "List all unread email threads for property Graylings"
- "Get case 5 with all emails, tasks, and notes"
- "Search emails for 'water leak' and summarize findings"

## Page context formats
- Dashboard: caseCount, openCaseCount, stats, topCases[]
- Situation: caseId, caseName, priority, status, tasks[], draftCount
- Properties: properties[] (name, type, units, manager)
- Search: query, resultCount, topResults[]
"""

FRONTEND_MODEL = "eu.anthropic.claude-sonnet-4-20250514-v1:0"

# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------
_RESPONSE_TIMEOUT = 300  # seconds per message

# Worker AI (Claude Code SDK)
_worker_client: ClaudeSDKClient | None = None
_worker_session_id: str | None = None
_worker_msg_count: int = 0

# Frontend AI (direct Messages API)
_frontend_ai: FrontendAI | None = None
_frontend_session_id: str | None = None
_frontend_msg_count: int = 0

_busy: bool = False

# Background worker tracking — results delivered via /worker/status polling
_pending_worker_task_id: str | None = None
_pending_worker_result: dict | None = None  # {"task_id": str, "text": str}


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


async def _delegate_handler(prompt: str) -> str:
    """Non-blocking: spawn worker task, return task_id immediately."""
    return await mcp_worker.delegate(prompt)


def _ensure_frontend() -> FrontendAI:
    global _frontend_ai, _frontend_session_id
    if _frontend_ai is None:
        _frontend_ai = FrontendAI(
            system_prompt=FRONTEND_SYSTEM_PROMPT,
            model=FRONTEND_MODEL,
            delegate_handler=_delegate_handler,
        )
        _frontend_session_id = str(uuid.uuid4())
        log.info("[frontend] initialized session=%s", _frontend_session_id)
    return _frontend_ai


def _teardown_frontend() -> None:
    global _frontend_ai, _frontend_session_id, _frontend_msg_count
    if _frontend_ai is not None:
        _frontend_ai.reset()
    _frontend_ai = None
    _frontend_session_id = None
    _frontend_msg_count = 0


# Wire up worker dispatch with our ensure_worker function
mcp_worker.configure(ensure_worker=_ensure_worker)


async def _background_worker_complete(task_id: str) -> None:
    """Background task: await worker result, summarize via Frontend AI, store for polling."""
    global _pending_worker_result, _pending_worker_task_id
    try:
        worker_text = await mcp_worker.await_result(task_id, timeout=_RESPONSE_TIMEOUT)
        log.info("[worker-bg] raw result task=%s (%d chars)", task_id, len(worker_text))

        # Pass through Frontend AI for conversational summary
        if _frontend_ai is not None:
            summary = await _frontend_ai.summarize_worker_result(worker_text)
        else:
            summary = worker_text  # fallback if frontend AI is gone

        _pending_worker_result = {"task_id": task_id, "text": summary}
        log.info("[worker-bg] summary ready task=%s (%d chars)", task_id, len(summary))
    except Exception as exc:
        log.error("[worker-bg] error task=%s: %s", task_id, exc)
        error_text = f"Sorry, I couldn't fetch that from the CRM: {exc}"
        _pending_worker_result = {"task_id": task_id, "text": error_text}
    finally:
        _pending_worker_task_id = None


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    _teardown_frontend()
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
    worker_task_id: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.post("/prompt")
async def prompt(req: PromptRequest) -> PromptResponse:
    """Non-streaming prompt — routes through Frontend AI, returns immediately.

    If the Frontend AI delegates to the worker, the acknowledgment is returned
    with worker_task_id. The client polls /worker/status for the worker result.
    """
    global _busy, _frontend_msg_count, _pending_worker_task_id

    if _busy:
        raise HTTPException(status_code=409, detail="Agent is busy with another request.")

    _busy = True
    import time as _time
    t0 = _time.monotonic()
    log.info("[prompt] query: %s", req.message[:120])
    try:
        frontend = _ensure_frontend()
        prompt_text = req.message
        if req.context:
            prompt_text = f"[Page context: {req.context}]\n\n{req.message}"

        mcp_worker.set_sse_queue(None)
        result = await frontend.chat(prompt_text)
        _frontend_msg_count += 1

        # If worker was delegated, start background task — don't block
        if result.pending_task_id:
            _pending_worker_task_id = result.pending_task_id
            asyncio.create_task(_background_worker_complete(result.pending_task_id))
            log.info("[prompt] delegated to worker task=%s, returning acknowledgment", result.pending_task_id)

        log.info("[prompt] done in %.1fs", _time.monotonic() - t0)
        return PromptResponse(
            response=result.text,
            session_id=_frontend_session_id or "",
            worker_task_id=result.pending_task_id,
        )
    except HTTPException:
        raise
    except Exception as exc:
        log.error("[prompt] error after %.1fs: %s", _time.monotonic() - t0, exc)
        _teardown_frontend()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        _busy = False


@app.post("/prompt/stream")
async def prompt_stream(req: PromptRequest):
    """SSE streaming — Frontend AI responds instantly, stream closes immediately.

    Flow:
    1. Frontend AI answers from context OR delegates and returns acknowledgment (<5s)
    2. Done event closes the stream — input re-enables immediately
    3. If delegated, worker runs in background — client polls /worker/status
    """
    global _busy

    if _busy:
        raise HTTPException(status_code=409, detail="Agent is busy with another request.")

    _busy = True

    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def _consume():
        global _frontend_msg_count, _pending_worker_task_id
        try:
            mcp_worker.set_sse_queue(None)  # No SSE queue — worker events via polling

            frontend = _ensure_frontend()
            log.info("[stream] frontend ready, session=%s msg_count=%d",
                     _frontend_session_id, _frontend_msg_count)
            await queue.put(_sse_event("status", {"status": "thinking"}))

            prompt_text = req.message
            if req.context:
                prompt_text = f"[Page context: {req.context}]\n\n{req.message}"

            # Frontend AI responds — fast path (<5s)
            result = await asyncio.wait_for(
                frontend.chat(prompt_text, sse_queue=queue),
                timeout=_RESPONSE_TIMEOUT,
            )
            _frontend_msg_count += 1

            if result.pending_task_id:
                # Delegation happened — close stream immediately, worker runs in background
                _pending_worker_task_id = result.pending_task_id
                await queue.put(
                    _sse_event("done", {
                        "response": result.text,
                        "worker_task_id": result.pending_task_id,
                    })
                )
                asyncio.create_task(_background_worker_complete(result.pending_task_id))
                log.info("[stream] delegated task=%s, closing stream", result.pending_task_id)
            else:
                # No delegation — done with frontend's response
                await queue.put(
                    _sse_event("done", {"response": result.text})
                )

        except TimeoutError:
            log.error("[stream] timeout — no response within %ds", _RESPONSE_TIMEOUT)
            _teardown_frontend()
            await queue.put(
                _sse_event("error", {"detail": f"Response timed out after {_RESPONSE_TIMEOUT}s."})
            )
        except Exception as exc:
            log.error("[stream] error: %s", exc)
            _teardown_frontend()
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


@app.get("/worker/status")
async def worker_status():
    """Poll for background worker results. Returns result once, then clears it."""
    global _pending_worker_result
    result = _pending_worker_result
    if result:
        _pending_worker_result = None  # consume once
        return {
            "busy": False,
            "result": result["text"],
            "task_id": result["task_id"],
        }
    return {
        "busy": _pending_worker_task_id is not None or mcp_worker.is_busy(),
        "result": None,
        "task_id": _pending_worker_task_id,
    }


@app.post("/session/restart")
async def restart_session():
    global _busy, _pending_worker_result, _pending_worker_task_id
    _busy = False
    _pending_worker_result = None
    _pending_worker_task_id = None
    _teardown_frontend()
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
