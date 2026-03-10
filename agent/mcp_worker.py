"""Delegation MCP server — async bridge between Frontend AI and Worker AI.

Provides two tools for the Frontend AI:
- delegate_to_worker(prompt) — queue a CRM query, returns task ID immediately
- get_worker_result(task_id) — poll/wait for the worker's response

The worker events (tool_use) are pushed to the active SSE queue so the
frontend sees CRM tool progress in real time.
"""

import asyncio
import json
import logging
import uuid
from typing import Any, Awaitable, Callable

from claude_code_sdk import create_sdk_mcp_server, tool
from claude_code_sdk.types import AssistantMessage, TextBlock, ToolUseBlock

log = logging.getLogger("agent.mcp")

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
# MCP tools
# ---------------------------------------------------------------------------
@tool(
    "delegate_to_worker",
    "Delegate a CRM query to the Worker AI. Returns a task ID immediately. "
    "The worker has full CRM access (emails, contacts, cases, tasks, threads, properties). "
    "Send a clear, natural-language prompt describing what CRM data or action you need.",
    {"prompt": str},
)
async def delegate_to_worker(args: dict) -> dict:
    prompt = args["prompt"]
    task_id = str(uuid.uuid4())[:8]
    log.info("[delegate] task=%s prompt=%s", task_id, prompt[:120])

    if _worker_busy:
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(
                        {"error": "Worker is busy with another task. Please wait and retry."}
                    ),
                }
            ],
            "is_error": True,
        }

    future: asyncio.Future[str] = asyncio.get_event_loop().create_future()
    _tasks[task_id] = future
    asyncio.create_task(_run_worker(task_id, prompt, future))

    return {
        "content": [
            {"type": "text", "text": json.dumps({"task_id": task_id, "status": "queued"})}
        ]
    }


@tool(
    "get_worker_result",
    "Get the result of a delegated Worker AI task. "
    "Returns the worker's full response text if complete, or a still_working status. "
    "Call this after delegate_to_worker to retrieve the CRM data.",
    {"task_id": str},
)
async def get_worker_result(args: dict) -> dict:
    task_id = args["task_id"]
    future = _tasks.get(task_id)

    if future is None:
        return {
            "content": [
                {"type": "text", "text": json.dumps({"error": f"Unknown task_id: {task_id}"})}
            ],
            "is_error": True,
        }

    if not future.done():
        try:
            await asyncio.wait_for(asyncio.shield(future), timeout=60.0)
        except asyncio.TimeoutError:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps({"task_id": task_id, "status": "still_working"}),
                    }
                ]
            }

    try:
        result = future.result()
        del _tasks[task_id]
        return {"content": [{"type": "text", "text": result}]}
    except Exception as exc:
        del _tasks[task_id]
        return {
            "content": [{"type": "text", "text": json.dumps({"error": str(exc)})}],
            "is_error": True,
        }


# ---------------------------------------------------------------------------
# Pre-built server config — imported by api.py
# ---------------------------------------------------------------------------
delegation_server = create_sdk_mcp_server(
    "worker_delegation",
    tools=[delegate_to_worker, get_worker_result],
)
