## ADDED Requirements

### Requirement: Agent Backend Interface
Clawling SHALL define an `AgentBackend` interface that abstracts agent lifecycle management. All agent interactions (sessions, prompts, streaming) SHALL go through this interface, enabling future provider backends (ACP, etc.) without changing framework code.

#### Scenario: Create a new session
- **WHEN** the framework calls `backend.createSession(config)` with agent name, cwd, and system prompt
- **THEN** the backend returns an `AgentSession` with a unique `sessionId`
- **AND** the session is ready to receive prompts

#### Scenario: Resume an existing session
- **WHEN** the framework calls `backend.resumeSession(sessionId)`
- **THEN** the backend restores the session with its accumulated context
- **AND** subsequent prompts have access to prior conversation history

### Requirement: Claude Agent SDK Backend
Clawling SHALL include a `ClaudeSDKBackend` that wraps `@anthropic-ai/claude-agent-sdk` for in-process agent execution without spawning CLI subprocesses.

#### Scenario: In-process agent execution
- **WHEN** a prompt is sent to a Claude SDK session
- **THEN** the Agent SDK `query()` function executes in the same Node process
- **AND** tool execution (Bash, Read, Edit, etc.) happens autonomously
- **AND** no CLI subprocess is spawned

#### Scenario: Cost tracking
- **WHEN** an agent turn completes via the Claude SDK backend
- **THEN** the `SDKResultSuccess.total_cost_usd` is emitted as a `cost` AgentEvent
- **AND** the framework can track cumulative cost per session and per delegation tree

#### Scenario: Progress via hooks
- **WHEN** the agent executes a Bash tool call during a shift
- **THEN** the `postToolUse` hook fires with the tool name and input
- **AND** the framework can derive structured progress messages (e.g., "Creating case: Water leak at Graylings")

#### Scenario: Permission bypass for autonomous work
- **WHEN** an agent is configured with `"permissions": "bypass"`
- **THEN** the Claude SDK backend sets `permissionMode: "bypassPermissions"`
- **AND** the agent executes all tools without permission prompts

### Requirement: Messages API Backend
Clawling SHALL include a `MessagesAPIBackend` that wraps the Anthropic/Bedrock Messages API for fast, lightweight agent responses. This backend maintains conversation history in-process and executes framework-defined tools (delegation, page actions) directly — without loading CLAUDE.md or enabling autonomous file/bash tools. It is designed for the frontend agent tier where response time (<3s) matters more than autonomous tool execution.

#### Scenario: Fast response from page context
- **WHEN** a user sends a message with page context to an agent using the Messages API backend
- **THEN** the backend makes a single Messages API call with the system prompt, conversation history, and tool definitions
- **AND** the response is returned within 5 seconds

#### Scenario: Framework tool execution
- **WHEN** the Messages API backend receives a `tool_use` block for `delegate_to_worker`
- **THEN** the backend executes the tool via the clawling delegation system (not the LLM's own tool loop)
- **AND** returns the tool result in a follow-up Messages API call

#### Scenario: Page action passthrough
- **WHEN** the Messages API backend receives a `tool_use` block for `page_action`
- **THEN** the action is emitted as an `AgentEvent` of type `action`
- **AND** the tool result confirms execution to the LLM

#### Scenario: Conversation history management
- **WHEN** multiple prompts are sent to the same Messages API session
- **THEN** the backend maintains the full `messages[]` array in-process
- **AND** each subsequent call includes prior context

#### Scenario: Bedrock authentication
- **WHEN** the backend is configured with Bedrock
- **THEN** it uses `@anthropic-ai/bedrock-sdk` with the same bearer token auth pattern as the current system

### Requirement: Unified Agent Event Stream
All agent backends SHALL emit a common `AgentEvent` type union, enabling the gateway and delegation system to work identically regardless of which backend powers a given agent.

#### Scenario: Event types
- **WHEN** an agent session processes a prompt
- **THEN** it yields a sequence of typed `AgentEvent` objects including: `text_delta`, `text_done`, `tool_call`, `tool_call_update`, `delegation`, `cost`, `done`, and `error`

#### Scenario: Backend-agnostic consumption
- **WHEN** the gateway streams events to an HTTP client
- **THEN** it consumes the `AgentEvent` async generator without knowledge of which backend produced it

### Requirement: Multi-Level Delegation
Clawling SHALL support spawning child agent sessions from a parent session, tracking parent-child relationships, and delivering child results back to the parent — as a first-class framework primitive.

#### Scenario: Spawn a child agent
- **WHEN** a parent agent (e.g., frontend AI) needs to delegate work to a worker agent
- **THEN** the framework calls `spawner.spawn(parentSession, childAgentName, prompt)`
- **AND** a child session is created with the specified agent configuration
- **AND** a `taskId` is returned immediately (non-blocking)
- **AND** the child runs in the background

#### Scenario: Track delegation lifecycle
- **WHEN** a child agent is spawned
- **THEN** the tracker records: taskId, parentSessionId, childSessionId, childAgentName, prompt, status, startedAt
- **AND** when the child completes, the tracker updates: status, result, completedAt

#### Scenario: Deliver results to parent
- **WHEN** a child agent completes its work
- **THEN** the announcer delivers the result to the parent session
- **AND** the result is available via the `/v1/status/:taskId` polling endpoint
- **AND** the delegation record is marked as completed

#### Scenario: Delegation timeout
- **WHEN** a child agent exceeds its configured timeout
- **THEN** the tracker marks the delegation as failed
- **AND** an error result is delivered to the parent

#### Scenario: Orphan cleanup
- **WHEN** clawling starts up
- **THEN** it checks for delegation records with status "running" from a previous process
- **AND** marks them as failed (orphan recovery)

#### Scenario: Delegation depth limit
- **WHEN** a child agent attempts to spawn its own child
- **AND** the current depth exceeds `delegation.maxDepth` from config
- **THEN** the spawn is rejected with an error

### Requirement: HTTP Gateway with SSE Streaming
Clawling SHALL expose an HTTP API following claw ecosystem conventions: OpenAI-compatible `/v1/chat/completions` for prompts with SSE streaming, agent routing via the `model` field, and bearer token authentication. Custom event extensions support delegation and UI actions alongside the standard OpenAI streaming format.

#### Scenario: Send a prompt via OpenAI-compatible endpoint
- **WHEN** a client sends `POST /v1/chat/completions` with `{"model": "clawling/frontend", "messages": [{"role": "user", "content": "..."}], "stream": true}`
- **THEN** the gateway routes to the agent named `frontend` (after the `clawling/` prefix)
- **AND** returns `Content-Type: text/event-stream`
- **AND** emits `data: {"choices": [{"delta": {"content": "..."}}]}` for streamed text (OpenAI format)
- **AND** emits `data: [DONE]` on completion

#### Scenario: Custom extension events in stream
- **WHEN** the agent produces non-text events (tool calls, delegation, UI actions)
- **THEN** the SSE stream emits extension events alongside standard OpenAI chunks:
- **AND** `data: {"clawling": {"type": "tool_call", "name": "...", "status": "running"}}` for tool use
- **AND** `data: {"clawling": {"type": "delegation", "childAgent": "worker", "taskId": "..."}}` for delegation
- **AND** `data: {"clawling": {"type": "action", "action": "scrollTo", "target": {...}}}` for UI actions

#### Scenario: Session routing via headers
- **WHEN** a client includes `x-clawling-session-id` header
- **THEN** the gateway routes to or resumes that session
- **AND** if omitted, a new session is created

#### Scenario: Trigger autonomous work
- **WHEN** a client sends `POST /v1/wake/:agent` with `{"prompt": "/shift"}`
- **THEN** the gateway creates a session for the named agent
- **AND** sends the prompt in the background
- **AND** returns `{"taskId": "..."}` immediately

#### Scenario: Poll for task result
- **WHEN** a client sends `GET /v1/status/:taskId`
- **AND** the task has completed
- **THEN** the response includes `{"status": "completed", "result": "..."}`
- **AND** the result is consumed once (cleared after read)

#### Scenario: Reject concurrent prompts to same agent
- **WHEN** an agent is already processing a prompt
- **AND** a second prompt arrives for the same agent
- **THEN** the gateway returns `409 Conflict`

#### Scenario: Bearer token authentication
- **WHEN** `CLAWLING_GATEWAY_TOKEN` is set
- **THEN** all requests MUST include `Authorization: Bearer <token>`
- **AND** requests without a valid token receive `401 Unauthorized`
- **WHEN** `CLAWLING_GATEWAY_TOKEN` is not set
- **THEN** authentication is disabled (local development mode)

#### Scenario: Health check
- **WHEN** a client sends `GET /health`
- **THEN** the gateway returns `200 OK`

#### Scenario: CORS support
- **WHEN** the frontend sends a cross-origin request
- **THEN** the gateway includes appropriate CORS headers

### Requirement: Config-Driven Agent Definitions
Clawling SHALL load agent configurations from a JSON file at startup. Each agent definition specifies the backend, model, tools, permissions, system prompt, and working directory.

#### Scenario: Load agent config
- **WHEN** clawling starts with a `config.json`
- **THEN** it validates the config against a Zod schema
- **AND** creates an agent backend instance for each defined agent
- **AND** logs a startup summary listing all agents

#### Scenario: Agent with system prompt from file
- **WHEN** an agent's `systemPrompt` field is a file path (e.g., `"./skills/frontend.md"`)
- **THEN** clawling reads the file at startup and uses its contents as the system prompt

#### Scenario: Agent with custom tools
- **WHEN** an agent config references tools defined in `config.tools`
- **THEN** those tools are registered via MCP and made available to the agent session

### Requirement: Custom Tool Registration via MCP
Clawling SHALL support defining custom tools in config that are exposed to agents via MCP. For the Claude SDK backend, tools SHALL run in-process via `createSdkMcpServer()`.

#### Scenario: Register a CLI tool
- **WHEN** config defines a tool with `{"command": "crm {{action}} {{entity}}", "description": "CRM CLI"}`
- **THEN** the tool is available to agents as an MCP tool
- **AND** when invoked, the command template is rendered with the tool's input parameters and executed

#### Scenario: In-process MCP for Claude SDK
- **WHEN** the active backend is Claude SDK
- **THEN** custom tools run via `createSdkMcpServer()` in the same Node process
- **AND** no separate MCP server process is needed

### Requirement: Skill File Format
Clawling SHALL use the claw ecosystem SKILL.md format for agent skills — markdown files with YAML frontmatter containing `name` and `description` fields. This ensures compatibility with ClawHub and other claw implementations.

#### Scenario: Load skill with frontmatter
- **WHEN** a skill file contains YAML frontmatter with `name` and `description`
- **THEN** clawling registers the skill with those metadata fields
- **AND** the markdown body is available as skill content for agent context injection

#### Scenario: Skill without frontmatter
- **WHEN** a skill file is plain markdown without frontmatter
- **THEN** clawling still loads it, deriving the name from the filename
- **AND** emits a warning that frontmatter is recommended

### Requirement: Agent Context Files
Clawling SHALL load workspace context files (AGENTS.md, CLAUDE.md) for agents that specify a `cwd`. These files provide agent personality and domain instructions. AGENTS.md is the source of truth; CLAUDE.md may be a symlink to it (following the project's existing convention).

#### Scenario: Workspace with AGENTS.md
- **WHEN** an agent's `cwd` contains an `AGENTS.md` file
- **THEN** the Claude SDK backend loads it as workspace context (via CLAUDE.md symlink or directly)
- **AND** the agent has access to all instructions defined in the file

### Requirement: Session Persistence
Clawling SHALL persist framework-level session state (delegation records, message metadata) to JSONL files. Agent-internal session persistence (conversation history) is handled by the backend.

#### Scenario: Save delegation state
- **WHEN** a delegation is spawned or completed
- **THEN** the delegation record is appended to the session's JSONL file

#### Scenario: Recover on restart
- **WHEN** clawling restarts
- **THEN** it reads JSONL files to recover active delegation records
- **AND** marks orphaned delegations as failed
