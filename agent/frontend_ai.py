"""Frontend AI — direct Anthropic/Bedrock Messages API client.

Bypasses Claude Code CLI subprocess for fast user-facing responses (<3s).
Maintains in-process conversation history and handles delegation tools directly.

Key design: the Frontend AI NEVER blocks on worker operations. It delegates
and returns immediately. The API layer awaits the worker result separately.
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from anthropic import AnthropicBedrock

log = logging.getLogger("agent.frontend")

# ---------------------------------------------------------------------------
# Tool definitions for the Messages API — only delegate, no blocking get
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "name": "delegate_to_worker",
        "description": (
            "Delegate a CRM query to the Worker AI. Returns a task ID immediately. "
            "The worker runs in the background — you will NOT get the result back. "
            "After calling this tool, tell the user you're looking into it and end your turn. "
            "The system will deliver the worker's result to the user automatically."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "A clear CRM query or action for the worker.",
                }
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "page_action",
        "description": (
            "Trigger a UI action on the user's page. Use this to draw the user's "
            "attention to a specific element. Call at most once per turn. "
            "Do NOT combine with delegate_to_worker in the same turn."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["scrollTo", "expand", "navigate"],
                    "description": (
                        "scrollTo: scroll to and highlight an element. "
                        "expand: expand a collapsed thread. "
                        "navigate: navigate to a different page."
                    ),
                },
                "target": {
                    "type": "object",
                    "description": "The element to target.",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["case", "email", "thread", "task", "draft", "note", "situation", "dashboard", "properties"],
                            "description": (
                                "For scrollTo: case (on dashboard), email, thread, task, draft, note (on situation pages). "
                                "For expand: thread. "
                                "For navigate: situation (requires id), dashboard, properties."
                            ),
                        },
                        "id": {
                            "type": "string",
                            "description": "The element ID. Required for scrollTo/expand and navigate to situation.",
                        },
                    },
                    "required": ["type"],
                },
            },
            "required": ["action", "target"],
        },
    },
]

# Type for the delegate handler: (prompt) -> task_id
DelegateHandler = Callable[[str], Awaitable[str]]


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@dataclass
class PageAction:
    """A UI action for the frontend to execute."""
    action: str  # "scrollTo" | "expand"
    target: dict  # {"type": "email"|"thread"|..., "id": "..."}


@dataclass
class ChatResult:
    """Result from a Frontend AI chat turn."""
    text: str
    pending_task_id: str | None = None
    page_action: PageAction | None = None


# ---------------------------------------------------------------------------
# Bedrock client creation
# ---------------------------------------------------------------------------
def _create_client():
    """Create Anthropic Bedrock client for the Frontend AI.

    Supports two auth modes:
    - ABSK bearer token (Claude Code format): passed as Authorization header,
      SigV4 auth skipped (matches Claude Code CLI behavior)
    - Standard IAM credentials: uses AnthropicBedrock with SigV4
    """
    region = os.environ.get("AWS_REGION", "eu-west-1")
    bearer_token = os.environ.get("AWS_BEARER_TOKEN_BEDROCK", "")

    if bearer_token:
        log.info("Creating AnthropicBedrock client (bearer token, region=%s)", region)
        return _BearerTokenBedrock(
            aws_region=region,
            default_headers={"Authorization": f"Bearer {bearer_token}"},
        )
    else:
        log.info("Creating AnthropicBedrock client (IAM credentials, region=%s)", region)
        return AnthropicBedrock(aws_region=region)


class _BearerTokenBedrock(AnthropicBedrock):
    """AnthropicBedrock subclass that skips SigV4 auth for bearer token mode."""

    def _prepare_request(self, request) -> None:
        pass


# ---------------------------------------------------------------------------
# FrontendAI
# ---------------------------------------------------------------------------
class FrontendAI:
    """Direct Messages API client for the user-facing AI layer.

    Never blocks on CRM operations. Delegates to worker and returns immediately.
    """

    def __init__(
        self,
        *,
        system_prompt: str,
        model: str,
        delegate_handler: DelegateHandler,
        max_turns: int = 5,
    ):
        self.client = _create_client()
        self.system_prompt = system_prompt
        self.model = model
        self.delegate_handler = delegate_handler
        self.max_turns = max_turns
        self.messages: list[dict] = []
        log.info("FrontendAI initialized — model=%s", model)

    async def chat(
        self,
        user_message: str,
        sse_queue: asyncio.Queue[str | None] | None = None,
    ) -> ChatResult:
        """Send a user message, return immediately with text + optional pending task.

        If the AI delegates to the worker, the task_id is returned in the result
        so the API layer can await and stream the worker's response separately.
        """
        self.messages.append({"role": "user", "content": user_message})

        pending_task_id: str | None = None
        page_action: PageAction | None = None
        final_text = "(no response)"

        for turn in range(self.max_turns):
            log.info("[chat] turn %d — calling Messages API...", turn)

            response = await asyncio.to_thread(
                self.client.messages.create,
                model=self.model,
                max_tokens=4096,
                system=self.system_prompt,
                messages=self.messages,
                tools=TOOLS,
            )

            log.info(
                "[chat] turn %d — stop_reason=%s, %d blocks",
                turn, response.stop_reason, len(response.content),
            )

            # Append to conversation history
            self.messages.append({
                "role": "assistant",
                "content": [_serialize_block(b) for b in response.content],
            })

            # Process content blocks
            text_parts: list[str] = []
            tool_uses: list[Any] = []

            for block in response.content:
                if block.type == "text" and block.text:
                    text_parts.append(block.text)
                    log.info("[chat] text: %s...", block.text[:80])
                    if sse_queue:
                        await sse_queue.put(
                            _sse_event("text", {"text": block.text})
                        )
                elif block.type == "tool_use":
                    tool_uses.append(block)
                    log.info("[chat] tool_use: %s", block.name)

            # No tool calls → done
            if response.stop_reason != "tool_use" or not tool_uses:
                final_text = "\n\n".join(text_parts) or "(no response)"
                break

            # Execute tools
            tool_results = []
            for tu in tool_uses:
                if tu.name == "delegate_to_worker":
                    try:
                        task_id = await self.delegate_handler(tu.input["prompt"])
                        pending_task_id = task_id
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tu.id,
                            "content": json.dumps({
                                "task_id": task_id,
                                "status": "queued",
                                "note": "Worker is running. End your turn now — the system will deliver results to the user.",
                            }),
                        })
                    except Exception as e:
                        log.warning("[chat] delegate failed: %s", e)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tu.id,
                            "content": json.dumps({"error": str(e)}),
                            "is_error": True,
                        })
                elif tu.name == "page_action":
                    # Don't execute server-side — pass through to frontend via SSE
                    page_action = PageAction(
                        action=tu.input["action"],
                        target=tu.input["target"],
                    )
                    log.info("[chat] page_action: %s %s", page_action.action, page_action.target)
                    if sse_queue:
                        await sse_queue.put(
                            _sse_event("action", {
                                "action": page_action.action,
                                "target": page_action.target,
                            })
                        )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": json.dumps({"status": "executed", "note": "Action sent to the user's browser."}),
                    })
                else:
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": json.dumps({"error": f"Unknown tool: {tu.name}"}),
                        "is_error": True,
                    })

            self.messages.append({"role": "user", "content": tool_results})

            # After delegation/action, the AI should produce a brief response
            # and end its turn (next iteration of the loop)

        return ChatResult(text=final_text, pending_task_id=pending_task_id, page_action=page_action)

    async def summarize_worker_result(self, result_text: str) -> str:
        """Pass worker result through the Frontend AI for a conversational summary.

        Injects the raw worker data as internal context, then generates a brief,
        conversational response that the user actually sees.
        """
        # Inject as a user message (internal — not shown to user) so the AI
        # can see the data and respond conversationally.
        self.messages.append({
            "role": "user",
            "content": (
                "[Internal: worker result — do NOT repeat this verbatim. "
                "Summarize conversationally in 2-4 sentences. Highlight only "
                "what matters most. The user can see the full data on the page.]\n\n"
                + result_text
            ),
        })

        log.info("[chat] summarizing worker result (%d chars)...", len(result_text))

        response = await asyncio.to_thread(
            self.client.messages.create,
            model=self.model,
            max_tokens=1024,
            system=self.system_prompt,
            messages=self.messages,
            tools=TOOLS,
        )

        # Extract text from response
        text_parts = [b.text for b in response.content if b.type == "text" and b.text]
        summary = "\n\n".join(text_parts) or result_text  # fallback to raw if empty

        # Add the AI's summary to conversation history
        self.messages.append({
            "role": "assistant",
            "content": [{"type": "text", "text": summary}],
        })

        log.info("[chat] worker summary: %s", summary[:120])
        return summary

    def reset(self) -> None:
        """Clear conversation history for a fresh session."""
        self.messages = []
        log.info("FrontendAI conversation history cleared")


def _serialize_block(block: Any) -> dict:
    """Convert an SDK content block to a dict for conversation history."""
    if block.type == "text":
        return {"type": "text", "text": block.text}
    elif block.type == "tool_use":
        return {
            "type": "tool_use",
            "id": block.id,
            "name": block.name,
            "input": block.input,
        }
    return block.model_dump() if hasattr(block, "model_dump") else {"type": block.type}
