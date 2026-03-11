"""Worker dispatch — async bridge between Frontend AI and Worker AI.

The Frontend AI delegates CRM work here. The worker runs in the background.
The API layer awaits the result and streams it back to the user.

Key functions:
- delegate(prompt) → task_id (non-blocking, spawns worker in background)
- await_result(task_id) → worker response text (blocking, used by API layer)
"""

import asyncio
import json
import logging
import uuid
from typing import Any, Awaitable, Callable

from claude_code_sdk.types import AssistantMessage, TextBlock, ToolUseBlock

log = logging.getLogger("agent.worker")

# ---------------------------------------------------------------------------
# Dependencies — injected by api.py via configure()
# ---------------------------------------------------------------------------
_ensure_worker: Callable[[], Awaitable[Any]] | None = None
_sse_queue: asyncio.Queue[str | None] | None = None
_worker_busy: bool = False

# Task tracking (task_id → Future[str])
_tasks: dict[str, asyncio.Future[str]] = {}


def configure(*, ensure_worker: Callable[[], Awaitable[Any]]) -> None:
    """Called once at startup to inject the worker client factory."""
    global _ensure_worker
    _ensure_worker = ensure_worker


def set_sse_queue(queue: asyncio.Queue[str | None] | None) -> None:
    """Set/clear the active SSE queue for streaming worker events."""
    global _sse_queue
    _sse_queue = queue


def is_busy() -> bool:
    return _worker_busy


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _run_worker(task_id: str, prompt: str, future: asyncio.Future[str]) -> None:
    """Background task: query Worker AI and resolve the future with its response."""
    global _worker_busy
    _worker_busy = True
    try:
        assert _ensure_worker is not None, "mcp_worker.configure() not called"
        client = await _ensure_worker()
        await client.query(prompt)

        text_parts: list[str] = []
        async for msg in client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, ToolUseBlock):
                        log.info("[worker:%s] tool: %s", task_id, block.name)
                        text_parts.clear()
                        if _sse_queue:
                            await _sse_queue.put(
                                _sse_event("tool_use", {"tool": block.name})
                            )
                    elif isinstance(block, TextBlock):
                        text_parts.append(block.text)

        result = "\n\n".join(text_parts) or "(no response from worker)"
        log.info("[worker:%s] done — %d chars", task_id, len(result))
        future.set_result(result)
    except Exception as exc:
        log.error("[worker:%s] error: %s", task_id, exc)
        if not future.done():
            future.set_exception(exc)
    finally:
        _worker_busy = False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def delegate(prompt: str) -> str:
    """Queue a CRM query for the Worker AI. Returns task_id immediately (non-blocking)."""
    task_id = str(uuid.uuid4())[:8]
    log.info("[delegate] task=%s prompt=%s", task_id, prompt[:120])

    if _worker_busy:
        raise RuntimeError("Worker is busy with another task.")

    future: asyncio.Future[str] = asyncio.get_event_loop().create_future()
    _tasks[task_id] = future
    asyncio.create_task(_run_worker(task_id, prompt, future))

    return task_id


async def await_result(task_id: str, timeout: float = 120.0) -> str:
    """Await the worker result for a given task. Blocks until done or timeout."""
    future = _tasks.get(task_id)
    if future is None:
        raise ValueError(f"Unknown task_id: {task_id}")

    try:
        result = await asyncio.wait_for(asyncio.shield(future), timeout=timeout)
        del _tasks[task_id]
        return result
    except asyncio.TimeoutError:
        raise TimeoutError(f"Worker task {task_id} timed out after {timeout}s")
    except Exception:
        if task_id in _tasks:
            del _tasks[task_id]
        raise
