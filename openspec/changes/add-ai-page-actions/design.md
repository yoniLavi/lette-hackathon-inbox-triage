## Context
The Frontend AI currently receives minimal page summaries and has no way to interact with the page UI. We want it to see what the user sees and to be able to draw attention to specific elements.

## Goals / Non-Goals
- Goals: Full page data in AI context; AI can scroll to and expand page elements; visual highlight on targeted elements
- Non-Goals: AI editing page content (e.g., modifying drafts directly); navigate action (Phase 2)

## Decisions

### Action protocol via SSE events
- Decision: Actions are emitted as a new `event: action` SSE event type, processed by the frontend before or alongside the `done` event
- Why: Fits naturally into the existing SSE streaming architecture. No new endpoints needed. The action is a side-effect of the AI's response, not a separate request.
- Alternatives: Embedding actions in the text response as JSON markers (fragile parsing), separate REST endpoint for actions (over-engineering)

### page_action tool on the Frontend AI
- Decision: Add a `page_action` tool to the Frontend AI's tool list. The AI calls it when it wants to point the user at something. The tool is "executed" by returning the action to the frontend via SSE — no server-side execution.
- Why: Tool use is the natural way for the AI to express intent to act. The tool result can confirm success. Keeps the AI's text response separate from the action.
- The tool has `at_most_one: true` semantics enforced by the system prompt (not schema) — the AI should call page_action at most once per turn.

### Highlight via CSS class + animation
- Decision: A `data-ai-target="{type}-{id}"` attribute on targetable elements. The highlight is a CSS class (`ai-highlight`) with a ring/glow animation that auto-removes after 2 seconds via `animationend` event.
- Why: Purely CSS-driven, no React state pollution. The attribute approach decouples the AI's target identification from React component internals.

### Expand via shared state
- Decision: Thread expand state is lifted to a shared ref/state that the AIAssistant can write to. When the AI sends `expand` for a thread, the assistant sets the thread's expanded state.
- Why: ThreadGroup already manages its own `expanded` state. We need to bridge from the AIAssistant (in the root layout) to the ThreadGroup component (in the situation page). A lightweight pub/sub or shared context handles this.

### Context size management
- Decision: Include full content for situation detail (typically <20 emails per case). For dashboard, include top 15 cases with descriptions. For search, include body snippets (first 200 chars). No compression or truncation for Phase 1.
- Why: Realistic data volumes are small enough. The Bedrock Messages API has a 200k context window. If a case has unusually long email bodies, the serialized context might reach 20-30KB — well within limits.

## Risks / Trade-offs
- Larger context payloads increase latency slightly (serialization + token count). Mitigated: data is already loaded, serialization is fast, and Sonnet handles large contexts well.
- Thread expand requires cross-component communication. Mitigated: lightweight pattern, only needed on situation detail page.

## Open Questions
- None for Phase 1.
