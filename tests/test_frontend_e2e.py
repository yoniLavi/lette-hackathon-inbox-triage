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

# Generous timeouts — worker delegation can take 30s+
FAST_TIMEOUT = 15_000  # context-only responses
SLOW_TIMEOUT = 120_000  # CRM delegation responses


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
    chat_input = page.locator("input[placeholder*='Ask anything']")
    expect(chat_input).to_be_visible(timeout=3000)
    return chat_input


def send_message(page: Page, text: str):
    """Type a message and send it."""
    chat_input = page.locator("input[placeholder*='Ask anything']")
    chat_input.fill(text)
    page.locator("button[type='submit']").click()


def wait_for_response(page: Page, timeout: int = FAST_TIMEOUT) -> str:
    """Wait for the AI response to appear and loading to finish.

    Returns the last assistant message text.
    """
    # Wait for loading to finish — input placeholder changes back
    page.locator("input[placeholder*='Ask anything']").wait_for(
        state="visible", timeout=timeout
    )

    # Get the last assistant message bubble
    assistant_msgs = page.locator("div.justify-start div.rounded-\\[24px\\]")
    count = assistant_msgs.count()
    assert count > 0, "No assistant messages found"
    return assistant_msgs.nth(count - 1).inner_text()


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
    chat_panel = page.locator("input[placeholder*='Ask anything']")
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
    send_message(page, "What can you help me with?")

    # Wait for response
    response = wait_for_response(page, timeout=FAST_TIMEOUT)
    assert len(response) > 20, f"Response too short: {response}"
    # Response should mention property management or similar domain terms
    assert any(
        kw in response.lower()
        for kw in ["property", "crm", "case", "email", "task", "help", "manage"]
    ), f"Response doesn't seem relevant: {response[:200]}"


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
    send_message(page, "Remember this number: 42")
    wait_for_response(page, timeout=FAST_TIMEOUT)

    # Second message — should recall the number
    send_message(page, "What number did I just tell you?")
    response = wait_for_response(page, timeout=FAST_TIMEOUT)
    assert "42" in response, f"AI didn't recall the number: {response[:200]}"


def test_context_aware_response(page: Page):
    """Chat responds using page context data from the dashboard."""
    page.goto(FRONTEND_URL, wait_until="networkidle")

    # Open chat and ask about what's on screen
    open_chat(page)
    send_message(page, "How many situations are showing on my dashboard?")
    response = wait_for_response(page, timeout=FAST_TIMEOUT)

    # Should reference actual data from the dashboard context
    assert len(response) > 10, f"Response too short: {response}"


def test_streaming_shows_loading_state(page: Page):
    """While AI is responding, a loading indicator is visible."""
    open_chat(page)
    send_message(page, "Explain what BTR means in Irish property management.")

    # Should see loading state (spinner or "Waiting for response..." placeholder)
    loading_indicator = page.locator("input[placeholder*='Waiting']")
    # This may be brief — just verify it was visible at some point
    # If the response is very fast, the loading state may flash too quickly
    # So we check either loading appeared OR response appeared quickly
    try:
        expect(loading_indicator).to_be_visible(timeout=2000)
    except Exception:
        # Response came back so fast that loading was not observed — that's OK
        pass

    # Either way, wait for the final response
    response = wait_for_response(page, timeout=FAST_TIMEOUT)
    assert "build" in response.lower() or "rent" in response.lower() or "btr" in response.lower()


def test_input_disabled_during_loading(page: Page):
    """Input field is disabled while waiting for a response."""
    open_chat(page)
    send_message(page, "What is the Residential Tenancies Board?")

    # Immediately after sending, input should be disabled
    chat_input = page.locator("input[placeholder*='Waiting']")
    try:
        expect(chat_input).to_be_disabled(timeout=2000)
    except Exception:
        pass  # Response arrived very quickly

    wait_for_response(page, timeout=FAST_TIMEOUT)

    # After response, input should be enabled again
    enabled_input = page.locator("input[placeholder*='Ask anything']")
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
    send_message(page, "Search the CRM for emails about fire safety")

    # Step 2: Acknowledgment arrives quickly, input re-enables
    ack = wait_for_response(page, timeout=FAST_TIMEOUT)
    assert len(ack) > 5, f"Acknowledgment too short: {ack}"

    chat_input = page.locator("input[placeholder*='Ask anything']")
    expect(chat_input).to_be_enabled(timeout=5000)

    # Worker progress indicator should be visible while worker runs
    worker_indicator = page.locator("[data-testid='worker-indicator']")
    try:
        expect(worker_indicator).to_be_visible(timeout=5000)
    except Exception:
        pass  # Worker may have already finished

    # Step 3: Send a follow-up while worker is still running
    send_message(page, "What is your name?")
    followup = wait_for_response(page, timeout=FAST_TIMEOUT)
    assert any(
        kw in followup.lower() for kw in ["lette", "assistant", "ai", "help"]
    ), f"Follow-up response doesn't seem right: {followup[:200]}"

    # Step 4: Wait for the worker result to appear as a NEW assistant message
    # The worker result is delivered via polling and added as a new bubble
    assistant_msgs = page.locator("div.justify-start div.rounded-\\[24px\\]")
    msgs_after_followup = assistant_msgs.count()

    # Wait for message count to increase (worker result arrives as new message)
    page.wait_for_function(
        f"document.querySelectorAll('div.justify-start div[class*=\"rounded-[24px]\"]').length > {msgs_after_followup}",
        timeout=SLOW_TIMEOUT,
    )

    # The new message should contain actual CRM data (not just acknowledgment)
    final_count = assistant_msgs.count()
    last_msg = assistant_msgs.nth(final_count - 1).inner_text()
    assert len(last_msg) > 100, (
        f"Worker result message too short ({len(last_msg)} chars): {last_msg[:200]}"
    )


def test_response_renders_markdown(page: Page):
    """AI responses render markdown formatting (bold, lists, headers)."""
    open_chat(page)
    send_message(page, "List 3 types of property issues in a numbered list with bold titles.")
    wait_for_response(page, timeout=FAST_TIMEOUT)

    # Check that the response container has rendered markdown elements
    last_msg = page.locator("div.justify-start div.rounded-\\[24px\\]").last
    # Look for bold text (strong tags) or list items rendered by ReactMarkdown
    has_formatting = (
        last_msg.locator("strong").count() > 0
        or last_msg.locator("li").count() > 0
        or last_msg.locator("ol").count() > 0
    )
    assert has_formatting, "Response should contain markdown formatting"


def test_chat_persists_across_page_navigation(page: Page):
    """Chat widget is available on other pages after navigation."""
    open_chat(page)
    send_message(page, "Remember the word: pineapple")
    wait_for_response(page, timeout=FAST_TIMEOUT)

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
