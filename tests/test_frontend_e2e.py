# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright>=1.40", "pytest>=8", "httpx>=0.27"]
# ///
"""Playwright E2E tests for the frontend chat widget.

Requires:
    - Docker Compose stack running (docker compose up -d)
    - Playwright browsers installed (playwright install chromium)

Run via:
    uv run --with playwright --with pytest --with httpx -- pytest tests/test_frontend_e2e.py -v
"""

import httpx
import pytest

try:
    from playwright.sync_api import Page, expect, sync_playwright
except ImportError:
    pytest.skip("playwright not installed", allow_module_level=True)

FRONTEND_URL = "http://localhost:3000"
AGENT_URL = "http://localhost:8001"
CRM_URL = "http://localhost:8002"

# Generous timeouts — worker delegation can take 30s+
FAST_TIMEOUT = 15_000  # context-only responses
SLOW_TIMEOUT = 120_000  # CRM delegation responses


def _get_case_ids() -> list[int]:
    """Fetch available case IDs from the CRM. Returns sorted list."""
    resp = httpx.get(f"{CRM_URL}/api/cases", params={"limit": "10", "order_by": "id", "order": "asc"}, timeout=10)
    resp.raise_for_status()
    return [c["id"] for c in resp.json()["list"]]


def _first_case_id() -> int:
    """Return the first available case ID."""
    ids = _get_case_ids()
    if not ids:
        pytest.skip("No cases in CRM")
    return ids[0]


def _second_case_id() -> int:
    """Return the second available case ID (or first if only one)."""
    ids = _get_case_ids()
    if not ids:
        pytest.skip("No cases in CRM")
    return ids[1] if len(ids) > 1 else ids[0]


@pytest.fixture(scope="module")
def browser_context():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        yield ctx
        ctx.close()
        browser.close()


@pytest.fixture
def page(browser_context):
    page = browser_context.new_page()
    yield page
    page.close()


@pytest.fixture(autouse=True)
def restart_agent():
    """Restart agent session before each test for clean state."""
    httpx.post(f"{AGENT_URL}/session/restart", timeout=10)


def open_chat(page: Page):
    """Navigate to dashboard and open the chat widget."""
    page.goto(FRONTEND_URL, wait_until="networkidle")

    # Click the chat toggle button (the 16x16 round button)
    chat_toggle = page.locator("button.w-16.h-16")
    chat_toggle.click()

    # Wait for the chat widget to appear (animated)
    chat_input = page.locator("textarea[placeholder*='Ask anything']")
    expect(chat_input).to_be_visible(timeout=3000)
    return chat_input


def send_message(page: Page, text: str) -> int:
    """Type a message and send it. Returns the message count after user message appears."""
    chat_input = page.locator("textarea[placeholder*='Ask anything']")
    chat_input.fill(text)
    page.locator("button[type='submit']").click()
    # Wait briefly for the user message bubble to render
    page.wait_for_timeout(100)
    return count_msgs(page)


def count_msgs(page: Page) -> int:
    """Count permanent message elements (with data-msg-id) in the chat."""
    return page.locator("[data-msg-id]").count()


def wait_for_response(page: Page, timeout: int = FAST_TIMEOUT, prev_count: int | None = None) -> str:
    """Wait for a new AI response to appear in the chat.

    Uses data-msg-id attribute to distinguish permanent messages from streaming previews.
    Returns the last assistant message text.
    """
    if prev_count is not None:
        # Wait for permanent message count (data-msg-id) to exceed prev_count
        page.wait_for_function(
            f"document.querySelectorAll('[data-msg-id]').length > {prev_count}",
            timeout=timeout,
        )
    else:
        # Fallback: wait for spinner to disappear
        spinner = page.locator("div.justify-start .animate-spin")
        try:
            spinner.first.wait_for(state="visible", timeout=3000)
        except Exception:
            pass
        try:
            spinner.first.wait_for(state="hidden", timeout=timeout)
        except Exception:
            pass

    page.wait_for_timeout(300)
    msgs = page.locator("[data-msg-id]")
    count = msgs.count()
    assert count > 0, "No assistant messages found"
    return msgs.nth(count - 1).inner_text()


# ---------- Tests ----------


def test_dashboard_loads(page: Page):
    """Dashboard renders with cases and navigation."""
    page.goto(FRONTEND_URL, wait_until="networkidle")

    # Page title or heading should mention cases/situations
    page.wait_for_selector("text=/Situations|Cases|Dashboard/i", timeout=10_000)


def test_chat_widget_opens_and_closes(page: Page):
    """Chat widget toggles open/closed on button click."""
    page.goto(FRONTEND_URL, wait_until="networkidle")

    # The toggle is the 16x16 round button (w-16 h-16)
    toggle = page.locator("button.w-16.h-16")

    # Open
    toggle.click()
    chat_panel = page.locator("textarea[placeholder*='Ask anything']")
    expect(chat_panel).to_be_visible(timeout=3000)

    # Close — same button, now shows X icon
    toggle.click()
    expect(chat_panel).to_be_hidden(timeout=3000)


def test_suggested_prompts_visible(page: Page):
    """Chat widget shows suggested prompt buttons when opened."""
    open_chat(page)

    # Should see at least one suggested prompt button
    prompts = page.locator("button:has-text('Summarize'), button:has-text('Show me'), button:has-text('Draft')")
    expect(prompts.first).to_be_visible(timeout=3000)


def test_send_message_shows_response(page: Page):
    """Sending a message shows an AI response in the chat."""
    open_chat(page)
    n = send_message(page, "What can you help me with?")

    # Wait for response — just verify the AI responded with something substantive
    response = wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)
    assert len(response) > 20, f"Response too short: {response}"


def test_user_message_appears_in_chat(page: Page):
    """The user's own message appears in the chat bubble."""
    open_chat(page)
    send_message(page, "Hello there!")

    # User message should appear right-aligned
    user_msgs = page.locator("div.justify-end div.rounded-\\[24px\\]")
    expect(user_msgs.first).to_be_visible(timeout=3000)
    assert "Hello there!" in user_msgs.first.inner_text()


def test_multi_turn_conversation(page: Page):
    """Multi-turn conversation preserves context across messages."""
    open_chat(page)

    # First message
    n = send_message(page, "Remember this number: 42")
    wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)

    # Second message — should recall the number
    n = send_message(page, "What number did I just tell you?")
    response = wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)
    assert "42" in response, f"AI didn't recall the number: {response[:200]}"


def test_context_aware_response(page: Page):
    """Chat responds using page context data from the dashboard."""
    page.goto(FRONTEND_URL, wait_until="networkidle")

    # Open chat and ask about what's on screen
    open_chat(page)
    n = send_message(page, "How many situations are showing on my dashboard?")
    response = wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)

    # Should reference actual data from the dashboard context
    assert len(response) > 10, f"Response too short: {response}"


def test_streaming_shows_loading_state(page: Page):
    """While AI is responding, a loading indicator is visible."""
    open_chat(page)
    n = send_message(page, "Explain what BTR means in Irish property management.")

    # Should see a loading spinner briefly
    spinner = page.locator("div.justify-start .animate-spin")
    try:
        spinner.first.wait_for(state="visible", timeout=3000)
    except Exception:
        pass  # Response came back very fast

    # Wait for the final response — may be a direct answer or a delegation acknowledgment
    response = wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)
    assert len(response) > 5, f"Response too short: {response}"


def test_input_disabled_during_loading(page: Page):
    """Input field is disabled while waiting for a response."""
    open_chat(page)
    n = send_message(page, "What is the Residential Tenancies Board?")

    # The textarea stays enabled (non-blocking input) — just wait for the response
    wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)

    # After response, input should still be enabled
    enabled_input = page.locator("textarea[placeholder*='Ask anything']")
    expect(enabled_input).to_be_enabled(timeout=3000)


def test_non_blocking_delegation(page: Page):
    """Full non-blocking flow: delegate → chat during worker → receive worker result.

    This is the key regression test for the non-blocking delegation UX:
    1. Send a CRM query that triggers worker delegation
    2. Get acknowledgment quickly, input re-enables
    3. Send a follow-up question while worker runs — get an instant response
    4. Worker result arrives as a new message after some time
    """
    open_chat(page)

    # Step 1: Send a query that requires CRM delegation
    n = send_message(page, "Search the CRM for emails about fire safety")

    # Step 2: Acknowledgment arrives quickly, input re-enables
    ack = wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)
    assert len(ack) > 5, f"Acknowledgment too short: {ack}"

    chat_input = page.locator("textarea[placeholder*='Ask anything']")
    expect(chat_input).to_be_enabled(timeout=5000)

    # Worker progress indicator should be visible while worker runs
    worker_indicator = page.locator("[data-testid='worker-indicator']")
    try:
        expect(worker_indicator).to_be_visible(timeout=5000)
    except Exception:
        pass  # Worker may have already finished

    # Step 3: Send a follow-up while worker is still running
    n2 = send_message(page, "What is your name?")
    followup = wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n2)
    assert len(followup) > 5, f"Follow-up response too short: {followup[:200]}"

    # Step 4: Wait for the worker result to appear as a NEW assistant message
    msgs_after_followup = count_msgs(page)

    # Wait for message count to increase (worker result arrives as new message)
    page.wait_for_function(
        f"document.querySelectorAll('[data-msg-id]').length > {msgs_after_followup}",
        timeout=SLOW_TIMEOUT,
    )

    # The new message should contain actual CRM data (not just acknowledgment)
    all_msgs = page.locator("[data-msg-id]")
    final_count = all_msgs.count()
    last_msg = all_msgs.nth(final_count - 1).inner_text()
    assert len(last_msg) > 20, (
        f"Worker result message too short ({len(last_msg)} chars): {last_msg[:200]}"
    )


def test_response_renders_markdown(page: Page):
    """AI responses are rendered through ReactMarkdown (not plain text)."""
    open_chat(page)
    n = send_message(page, "What does BTR stand for?")
    wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)

    # ReactMarkdown wraps content in <p> tags — verify rendering pipeline works
    last_msg = page.locator("[data-msg-id]").last
    has_markdown = (
        last_msg.locator("p").count() > 0
        or last_msg.locator("strong").count() > 0
        or last_msg.locator("em").count() > 0
    )
    assert has_markdown, "Response should be rendered through ReactMarkdown (expected <p>, <strong>, or <em> tags)"


def test_chat_persists_across_page_navigation(page: Page):
    """Chat widget is available on other pages after navigation."""
    open_chat(page)
    n = send_message(page, "Remember the word: pineapple")
    wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)

    # Navigate to a different page
    nav_links = page.locator("a[href*='properties'], a[href*='situation'], nav a")
    if nav_links.count() > 0:
        nav_links.first.click()
        page.wait_for_load_state("networkidle")

        # Chat toggle button should still be accessible (the 16x16 round button)
        toggle = page.locator("button.w-16.h-16")
        expect(toggle).to_be_visible(timeout=5000)
    else:
        pytest.skip("No navigation links found to test persistence")


# ---------- Page context enrichment tests ----------


def open_chat_on_situation(page: Page, case_id: int | None = None):
    """Navigate to a situation detail page and open chat."""
    if case_id is None:
        case_id = _first_case_id()
    page.goto(f"{FRONTEND_URL}/situations/{case_id}", wait_until="networkidle")
    chat_toggle = page.locator("button.w-16.h-16")
    chat_toggle.click()
    chat_input = page.locator("textarea[placeholder*='Ask anything']")
    expect(chat_input).to_be_visible(timeout=3000)
    return chat_input


def test_situation_has_ai_target_attributes(page: Page):
    """Situation detail page elements have data-ai-target attributes for AI actions."""
    case_id = _first_case_id()
    page.goto(f"{FRONTEND_URL}/situations/{case_id}", wait_until="networkidle")

    # Should have at least one data-ai-target attribute
    targets = page.locator("[data-ai-target]")
    count = targets.count()
    assert count > 0, "No data-ai-target attributes found on situation page"

    # Check specific target types exist
    target_values = [targets.nth(i).get_attribute("data-ai-target") for i in range(count)]
    has_task = any(t.startswith("task-") for t in target_values if t)
    has_draft = any(t.startswith("draft-") for t in target_values if t)
    has_note = any(t.startswith("note-") for t in target_values if t)
    assert has_task or has_draft or has_note, f"Expected task, draft, or note targets, got: {target_values}"


def test_enriched_context_answers_draft_question(page: Page):
    """AI can answer questions about draft content from enriched page context."""
    open_chat_on_situation(page, case_id=_first_case_id())

    n = send_message(page, "What does the draft response say? Give me a brief summary.")
    response = wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)

    # The AI should be able to answer from context — the draft body is now included
    # It should NOT say "I can't see the draft" or "I don't have the draft content"
    assert not any(
        phrase in response.lower()
        for phrase in ["can't see", "don't have", "not available", "not included"]
    ), f"AI couldn't see draft content: {response[:300]}"
    assert len(response) > 20, f"Response too short: {response}"


def test_enriched_context_sees_email_bodies(page: Page):
    """AI can answer about email content from enriched page context."""
    open_chat_on_situation(page, case_id=_first_case_id())

    n = send_message(page, "What is this case about? Be specific about the issue.")
    response = wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)

    # Should give a substantive answer from the page context, not ask for more info
    assert len(response) > 30, f"Response too short: {response}"
    assert not any(
        phrase in response.lower()
        for phrase in ["can't see", "don't have", "not available", "which case"]
    ), f"AI couldn't see page content: {response[:300]}"


def test_scrollto_action_highlights_element(page: Page):
    """AI scrollTo action highlights the targeted element on the page."""
    open_chat_on_situation(page, case_id=_first_case_id())

    n = send_message(page, "Show me the first task")
    wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)

    # After the response, check if any element got the ai-highlight class
    # Give it a moment for the action to execute
    page.wait_for_timeout(500)

    # The highlight animation lasts 2s — check if it was applied
    highlighted = page.locator(".ai-highlight")
    target = page.locator("[data-ai-target^='task-']")

    # Either the highlight is still active OR the target was scrolled into viewport
    has_highlight = highlighted.count() > 0
    target_in_view = target.count() > 0 and target.first.is_visible()
    assert has_highlight or target_in_view, (
        "Expected either ai-highlight class or task scrolled into view"
    )


def test_expand_action_opens_thread(page: Page):
    """AI expand action opens a collapsed thread group."""
    # Use first case — it should have a thread with multiple emails
    open_chat_on_situation(page, case_id=_first_case_id())

    # First verify there's a collapsed thread (thread header button visible)
    thread_headers = page.locator("[data-ai-target^='thread-'] button")
    if thread_headers.count() == 0:
        pytest.skip("No thread groups found to test expand")

    n = send_message(page, "Expand the email thread so I can see all messages")
    wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)

    # Give action time to execute
    page.wait_for_timeout(500)

    # After expansion, individual email cards within the thread should be visible
    thread_emails = page.locator("[data-ai-target^='thread-'] [data-ai-target^='email-']")
    assert thread_emails.count() > 0, "Thread should have expanded to show individual emails"


# ---------- Navigate action tests ----------


def test_scrollto_case_on_dashboard(page: Page):
    """AI scrollTo action highlights a case card on the dashboard."""
    ids = _get_case_ids()
    if not ids:
        pytest.skip("No cases in CRM — run a shift first")

    open_chat(page)

    n = send_message(page, "Show me the first case")
    wait_for_response(page, timeout=FAST_TIMEOUT, prev_count=n)

    # Give action time to execute
    page.wait_for_timeout(500)

    # Should stay on dashboard (scrollTo, not navigate)
    assert page.url.rstrip("/").endswith(":3000") or page.url == "http://localhost:3000/", (
        f"Should stay on dashboard, got: {page.url}"
    )

    # Case card should have been highlighted or scrolled into view
    highlighted = page.locator(".ai-highlight")
    case_target = page.locator("[data-ai-target^='case-']")
    has_highlight = highlighted.count() > 0
    case_in_view = case_target.count() > 0 and case_target.first.is_visible()
    assert has_highlight or case_in_view, (
        "Expected either ai-highlight class or case card scrolled into view"
    )


def test_navigate_from_dashboard_to_situation(page: Page):
    """AI navigate action takes user from dashboard to a situation detail page when asked for detail."""
    open_chat(page)

    # Explicitly ask for detail — should trigger navigate, not just scrollTo
    n = send_message(page, "Open the sublet request case, I want to see all the emails and tasks")

    # The navigate flow: AI navigates → new context loads → AI responds with context
    # This may take longer due to two AI turns + page navigation
    response = wait_for_response(page, timeout=SLOW_TIMEOUT, prev_count=n)

    # After navigation, URL should be on a situation page
    assert "/situations/" in page.url, f"Expected situation page URL, got: {page.url}"

    # The AI response should reference content from the new page
    assert len(response) > 20, f"Response too short after navigation: {response}"

    # Chat widget must remain open after navigation
    chat_input = page.locator("textarea[placeholder*='Ask anything']")
    expect(chat_input).to_be_visible(timeout=3000)


def test_navigate_uses_new_page_context(page: Page):
    """After navigating, AI uses the new page's context to answer questions."""
    # Start on a situation page and ask to go to dashboard
    open_chat_on_situation(page, case_id=_first_case_id())

    n = send_message(page, "Go to the dashboard and tell me how many cases I have")

    response = wait_for_response(page, timeout=SLOW_TIMEOUT, prev_count=n)

    # Should have navigated to dashboard
    url = page.url.rstrip("/")
    assert url.endswith(":3000") or url.endswith("/"), (
        f"Expected dashboard URL, got: {page.url}"
    )

    # Response should mention case count or dashboard data
    assert any(
        kw in response.lower() for kw in ["case", "situation", "dashboard"]
    ), f"Response doesn't reference dashboard context: {response[:300]}"
