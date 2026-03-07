"""Agent API — thin FastAPI wrapper around Claude Code SDK with EspoMCP."""

import asyncio
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from claude_code_sdk import ClaudeSDKClient
from claude_code_sdk.types import (
    AssistantMessage,
    ClaudeCodeOptions,
    McpStdioServerConfig,
    TextBlock,
)

# ---------------------------------------------------------------------------
# SDK options (shared across sessions)
# ---------------------------------------------------------------------------
SDK_OPTIONS = ClaudeCodeOptions(
    system_prompt=(
        "You are a PropTech email triage agent for a property management company. "
        "You have access to EspoCRM via MCP tools. Use them to read and manage "
        "emails, contacts, accounts, and cases. Be concise and action-oriented."
    ),
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
_client: ClaudeSDKClient | None = None
_session_id: str | None = None
_message_count: int = 0
_busy: bool = False
_lock = asyncio.Lock()


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


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class PromptRequest(BaseModel):
    message: str


class PromptResponse(BaseModel):
    response: str
    session_id: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.post("/prompt")
async def prompt(req: PromptRequest) -> PromptResponse:
    global _busy, _message_count

    if _busy:
        raise HTTPException(status_code=409, detail="A prompt is already being processed")

    async with _lock:
        _busy = True

    try:
        client = await _ensure_client()
        await client.query(req.message)

        text_parts: list[str] = []
        async for msg in client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        text_parts.append(block.text)

        _message_count += 1

        return PromptResponse(
            response="\n".join(text_parts) or "(no response)",
            session_id=_session_id or "",
        )
    finally:
        async with _lock:
            _busy = False


@app.post("/session/restart")
async def restart_session():
    async with _lock:
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
