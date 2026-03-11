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
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from anthropic import AnthropicBedrock

log = logging.getLogger("agent.frontend")

# ---------------------------------------------------------------------------
# Tool definitions for the Messages API — only delegate, no blocking get
# ---------------------------------------------------------------------------
DELEGATION_TOOLS = [
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
]

# Type for the delegate handler: (prompt) -> task_id
DelegateHandler = Callable[[str], Awaitable[str]]


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@dataclass
class ChatResult:
    """Result from a Frontend AI chat turn."""
    text: str
    pending_task_id: str | None = None


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
        final_text = "(no response)"

        for turn in range(self.max_turns):
            log.info("[chat] turn %d — calling Messages API...", turn)

            response = await asyncio.to_thread(
                self.client.messages.create,
                model=self.model,
                max_tokens=4096,
                system=self.system_prompt,
                messages=self.messages,
                tools=DELEGATION_TOOLS,
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

            # Execute delegate_to_worker — non-blocking, returns task_id
            tool_results = []
            for tu in tool_uses:
                if tu.name == "delegate_to_worker":
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
                else:
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": json.dumps({"error": f"Unknown tool: {tu.name}"}),
                        "is_error": True,
                    })

            self.messages.append({"role": "user", "content": tool_results})

            # After delegation, the AI should produce a brief acknowledgment
            # and end its turn (next iteration of the loop)

        return ChatResult(text=final_text, pending_task_id=pending_task_id)

    def inject_worker_result(self, result_text: str) -> None:
        """Inject a worker result into conversation history for follow-up context.

        Added as an assistant message so the AI sees it as its own prior response.
        """
        self.messages.append({
            "role": "assistant",
            "content": [{"type": "text", "text": result_text}],
        })
        log.info("[chat] injected worker result (%d chars) into history", len(result_text))

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
