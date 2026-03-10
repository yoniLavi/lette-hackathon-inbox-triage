"""Frontend AI — direct Anthropic/Bedrock Messages API client.

Bypasses Claude Code CLI subprocess for fast user-facing responses (<3s).
Maintains in-process conversation history and handles delegation tools directly.
"""

import asyncio
import json
import logging
import os
from typing import Any, Awaitable, Callable

log = logging.getLogger("agent.frontend")

# ---------------------------------------------------------------------------
# Tool definitions for the Messages API
# ---------------------------------------------------------------------------
DELEGATION_TOOLS = [
    {
        "name": "delegate_to_worker",
        "description": (
            "Delegate a CRM query to the Worker AI. Returns a task ID immediately. "
            "The worker has full CRM access (emails, contacts, cases, tasks, threads, properties). "
            "Send a clear, natural-language prompt describing what CRM data or action you need."
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
        "name": "get_worker_result",
        "description": (
            "Get the result of a delegated Worker AI task. "
            "Returns the worker's full response text if complete, or a still_working status. "
            "Call this after delegate_to_worker to retrieve the CRM data."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "The task ID returned by delegate_to_worker.",
                }
            },
            "required": ["task_id"],
        },
    },
]

# Type for the tool handler callback: (tool_name, tool_input, sse_queue) -> result_text
ToolHandler = Callable[
    [str, dict[str, Any], asyncio.Queue | None],
    Awaitable[str],
]


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


class FrontendAI:
    """Direct Messages API client for the user-facing AI layer."""

    def __init__(
        self,
        *,
        system_prompt: str,
        model: str,
        tool_handler: ToolHandler,
        max_turns: int = 10,
    ):
        from anthropic import AnthropicBedrock

        self.client = AnthropicBedrock(
            aws_bearer_token=os.environ["AWS_BEARER_TOKEN_BEDROCK"],
            aws_region=os.environ.get("AWS_REGION", "eu-west-1"),
        )
        self.system_prompt = system_prompt
        self.model = model
        self.tool_handler = tool_handler
        self.max_turns = max_turns
        self.messages: list[dict] = []
        log.info("FrontendAI initialized — model=%s", model)

    async def chat(
        self,
        user_message: str,
        sse_queue: asyncio.Queue[str | None] | None = None,
    ) -> str:
        """Send a user message, handle tool loop, return final assistant text.

        If sse_queue is provided, text and tool_use events are pushed to it
        as they arrive.
        """
        self.messages.append({"role": "user", "content": user_message})

        final_text = "(no response)"

        for turn in range(self.max_turns):
            log.info("[chat] turn %d — calling Messages API...", turn)

            # Sync API call in a thread to avoid blocking the event loop
            response = await asyncio.to_thread(
                self.client.messages.create,
                model=self.model,
                max_tokens=4096,
                system=self.system_prompt,
                messages=self.messages,
                tools=DELEGATION_TOOLS,
            )

            log.info(
                "[chat] turn %d — stop_reason=%s, %d content blocks",
                turn,
                response.stop_reason,
                len(response.content),
            )

            # Append assistant response to conversation history
            self.messages.append({
                "role": "assistant",
                "content": [_serialize_block(b) for b in response.content],
            })

            # Process content blocks — emit text events, collect tool uses
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

            # If no tool calls, we're done
            if response.stop_reason != "tool_use" or not tool_uses:
                final_text = "\n\n".join(text_parts) or "(no response)"
                break

            # Execute tools and continue the loop
            tool_results = []
            for tu in tool_uses:
                try:
                    result_text = await self.tool_handler(
                        tu.name, tu.input, sse_queue
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": result_text,
                    })
                except Exception as exc:
                    log.error("[chat] tool %s error: %s", tu.name, exc)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": json.dumps({"error": str(exc)}),
                        "is_error": True,
                    })

            self.messages.append({"role": "user", "content": tool_results})

        return final_text

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
    # Fallback
    return block.model_dump() if hasattr(block, "model_dump") else {"type": block.type}
