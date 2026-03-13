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
    ResultMessage,
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
You are in a chat widget — reply like a colleague in a quick Slack conversation. \
One or two SHORT sentences max. Never write paragraphs, bullet lists, or headers. \
The user can already see the full data on the page — your job is to POINT at things \
(using page_action) and add brief insight, not to repeat or summarize what's on screen.

Good example: "That's the RTB complaint from Sean — I've highlighted the draft response. \
Main risk is the RTÉ inquiry angle, so I'd prioritize settling this week."

Bad example: listing out the problem, settlement terms, actions needed, risks — \
the user can read all of that on the page already.

## Rules
1. **Always highlight what you reference.** Whenever your answer refers to a \
specific email, draft, task, note, or case, call page_action scrollTo to highlight \
it. This is the most important rule — never talk about an element without pointing \
at it. The user should see what you mean, not just read about it.
2. **Show, don't tell.** Do NOT repeat the content of emails, drafts, tasks, or \
notes back to the user — they can read it themselves once you highlight it.
3. **Check page context first.** Messages include `[Page context: {...}]` with \
full page data. If you can answer from this context, do so — no delegation needed.
4. **Delegate CRM queries.** For data not in page context, call delegate_to_worker \
with a clear prompt. Say a brief acknowledgment and end your turn.
5. **Never narrate tool usage.** Don't say "I'll use page_action" or \
"I'll scroll to". Just do it and respond naturally.
6. **Brevity is mandatory.** If your response is more than 2-3 sentences, you are \
doing it wrong. Cut ruthlessly. Point at the page instead of explaining.

## page_action usage
**Prefer scrollTo** — always scroll to and highlight the element on the current \
page first. Only use navigate when the user explicitly asks for more detail that \
requires a different page (e.g. "open that case", "go to the dashboard").
- **scrollTo**: scroll to and highlight an element on the current page. Works on \
all pages. Target types: case (on dashboard), email, thread, task, draft, note \
(on situation pages). The id must match an element from the page context.
- **expand**: open a collapsed thread on a situation page. Target: thread.
- **navigate**: go to a different page. Only use when the user asks for additional \
detail beyond what's on the current page, or explicitly asks to navigate. \
Target types: situation (id = case id), dashboard, properties. After navigating, \
the system sends you the new page's context — wait for it to answer.

## delegate_to_worker prompts
Write clear, specific CRM queries. Examples:
- "List all unread email threads for property Graylings"
- "Get case 5 with all emails, tasks, and notes"
- "Search emails for 'water leak' and summarize findings"

## Page context formats
- Dashboard: caseCount, stats, topCases[] (with descriptions, pendingTasks, draftSubjects)
- Situation: caseId, caseName, tasks[] (with descriptions), drafts[] (with full body), \
emails[] (with full body, thread info), notes[] (with content), contacts[]
- Properties: properties[] (name, type, units, manager, managerEmail, description)
- Search: query, topResults[] (with bodySnippet, caseId)
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


_CRM_API_URL = "http://crm-api:8002"

# Active shift tracking
_active_shift_id: int | None = None


async def _crm_create_shift() -> int:
    """Create a Shift record in the CRM, return its ID."""
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_CRM_API_URL}/api/shifts",
            json={"status": "in_progress"},
        )
        resp.raise_for_status()
        return resp.json()["id"]


async def _crm_update_shift(shift_id: int, data: dict) -> None:
    """Update a Shift record in the CRM."""
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{_CRM_API_URL}/api/shifts/{shift_id}",
            json=data,
        )
        resp.raise_for_status()


async def _fetch_thread_subject(thread_id: str) -> str | None:
    """Fetch a thread's subject from CRM. Returns None on failure."""
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{_CRM_API_URL}/api/threads/{thread_id}", timeout=5)
            if resp.status_code == 200:
                subj = resp.json().get("subject", "")
                return subj[:60] if subj else None
    except Exception:
        pass
    return None


async def _progress_from_crm_cmd(cmd: str, current_subject: str | None) -> tuple[str | None, str | None]:
    """Derive a progress message from a crm CLI command.

    Returns (progress_message, updated_current_subject).
    """
    parts = cmd.split()
    if len(parts) < 3:
        return None, current_subject
    entity, action = parts[1], parts[2]
    ctx = f": {current_subject}" if current_subject else "..."

    if entity == "threads" and action == "list":
        return "Scanning email threads...", current_subject
    if entity == "threads" and action == "get" and len(parts) > 3 and parts[3].isdigit():
        subj = await _fetch_thread_subject(parts[3])
        if subj:
            return f'Reading thread: {subj}', subj
        return "Reading thread...", current_subject
    if entity == "emails" and action in ("get", "list"):
        return f"Reading emails{ctx}", current_subject
    if entity == "cases" and action == "create":
        return f"Creating case{ctx}", current_subject
    if entity == "tasks" and action == "create":
        return f"Creating task{ctx}", current_subject
    if entity == "emails" and action == "create":
        return f"Drafting reply{ctx}", current_subject
    if entity == "notes" and action == "create":
        return f"Writing case notes{ctx}", current_subject
    if entity in ("emails", "threads") and action == "update":
        return f"Updating records{ctx}", current_subject
    return None, current_subject


async def _run_shift_background(shift_id: int) -> None:
    """Run the shift skill in background, update Shift record on completion."""
    global _busy, _active_shift_id, _worker_msg_count
    import re as _re
    import time as _time
    t0 = _time.monotonic()
    tool_count = 0
    cost_usd: float | None = None
    last_progress_update = 0.0  # monotonic time of last CRM progress update
    try:
        await _teardown_worker()
        client = await _ensure_worker()
        log.info("[shift] worker ready (%s), sending /shift skill", _worker_session_id)
        await client.query("/shift")

        text_parts: list[str] = []
        progress_msg = "Starting shift..."
        current_subject: str | None = None  # tracks the thread subject being processed
        threads_read = 0
        emails_read = 0
        loop = asyncio.get_event_loop()
        cm = asyncio.timeout_at(loop.time() + _RESPONSE_TIMEOUT)
        async with cm:
            async for msg in client.receive_response():
                cm.reschedule(loop.time() + _RESPONSE_TIMEOUT)
                if isinstance(msg, ResultMessage):
                    cost_usd = msg.total_cost_usd
                    log.info("[shift] result: cost=$%.4f turns=%d duration=%dms",
                             cost_usd or 0, msg.num_turns, msg.duration_ms)
                elif isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, ToolUseBlock):
                            tool_count += 1
                            elapsed = _time.monotonic() - t0
                            log.info("[shift] tool #%d: %s (%.0fs elapsed)",
                                     tool_count, block.name, elapsed)
                            text_parts.clear()

                            # Extract progress from crm commands
                            cmd = (block.input or {}).get("command", "") if isinstance(block.input, dict) else ""
                            if cmd.startswith("crm "):
                                parts = cmd.split()
                                if len(parts) >= 3:
                                    if parts[1] == "threads" and parts[2] == "get":
                                        threads_read += 1
                                    elif parts[1] == "emails" and parts[2] == "get":
                                        emails_read += 1
                                new_progress, current_subject = await _progress_from_crm_cmd(cmd, current_subject)
                                if new_progress:
                                    progress_msg = new_progress

                            # Debounce progress updates to CRM (every 5s)
                            now = _time.monotonic()
                            if now - last_progress_update >= 5:
                                last_progress_update = now
                                try:
                                    await _crm_update_shift(shift_id, {
                                        "summary": progress_msg,
                                        "threads_processed": threads_read,
                                        "emails_processed": emails_read,
                                    })
                                except Exception:
                                    pass  # non-critical

                        elif isinstance(block, TextBlock):
                            text_parts.append(block.text)
                            snippet = block.text[:120].replace("\n", " ")
                            log.info("[shift] text: %s%s", snippet,
                                     "…" if len(block.text) > 120 else "")

                            # Extract progress from text — look for thread/email subjects
                            subj = _re.search(r'["\u201c]([^"\u201d]{10,80})["\u201d]', block.text)
                            if subj:
                                progress_msg = f'Looking at "{subj.group(1)}"'

                            # Also update CRM on text blocks (debounced)
                            now = _time.monotonic()
                            if now - last_progress_update >= 5:
                                last_progress_update = now
                                try:
                                    await _crm_update_shift(shift_id, {"summary": progress_msg})
                                except Exception:
                                    pass

        _worker_msg_count += 1
        elapsed = _time.monotonic() - t0
        summary = "\n\n".join(text_parts) or "(no response)"
        log.info("[shift] complete — %d tool calls in %.0fs", tool_count, elapsed)

        # Parse metrics from summary text (best-effort)
        metrics = _parse_shift_summary(summary)
        update_data: dict = {
            "status": "completed",
            "completed_at": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
            "summary": summary,
            **metrics,
        }
        if cost_usd is not None:
            update_data["cost_usd"] = round(cost_usd, 4)
        await _crm_update_shift(shift_id, update_data)
    except TimeoutError:
        elapsed = _time.monotonic() - t0
        log.error("[shift] timeout after %.0fs (%d tool calls)", elapsed, tool_count)
        await _teardown_worker()
        await _crm_update_shift(shift_id, {
            "status": "failed",
            "completed_at": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
            "summary": f"Timed out after {elapsed:.0f}s ({tool_count} tool calls)",
        })
    except Exception as exc:
        elapsed = _time.monotonic() - t0
        log.error("[shift] error after %.0fs (%d tool calls): %s", elapsed, tool_count, exc)
        await _teardown_worker()
        await _crm_update_shift(shift_id, {
            "status": "failed",
            "completed_at": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
            "summary": f"Error after {elapsed:.0f}s: {exc}",
        })
    finally:
        _busy = False
        _active_shift_id = None


def _parse_shift_summary(summary: str) -> dict:
    """Best-effort extraction of metrics from the shift summary text."""
    import re
    metrics: dict = {}
    patterns = {
        "threads_processed": r"\*\*Threads processed\*\*:\s*(\d+)",
        "emails_processed": r"\*\*Emails processed\*\*:\s*(\d+)",
        "drafts_created": r"\*\*Drafts created\*\*:\s*(\d+)",
        "tasks_created": r"\*\*Tasks created\*\*:\s*(\d+)",
    }
    for key, pattern in patterns.items():
        m = re.search(pattern, summary)
        if m:
            metrics[key] = int(m.group(1))
    return metrics


@app.post("/shift")
async def shift():
    """Start a batch shift — async. Returns shift_id immediately."""
    global _busy, _active_shift_id

    if _busy:
        raise HTTPException(status_code=409, detail="Agent is busy with another request.")

    _busy = True
    try:
        shift_id = await _crm_create_shift()
        _active_shift_id = shift_id
        log.info("[shift] created shift record %d, starting background processing", shift_id)
        asyncio.create_task(_run_shift_background(shift_id))
        return {"shift_id": shift_id}
    except Exception as exc:
        _busy = False
        _active_shift_id = None
        log.error("[shift] failed to start: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


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
