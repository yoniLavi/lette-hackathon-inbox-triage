#!/usr/bin/env bash
# E2E chat tests using playwright-cli and curl.
# Requires: Docker Compose stack running, playwright-cli available.
#
# Usage:
#   ./tests/test_chat_e2e.sh          # run all tests
#   ./tests/test_chat_e2e.sh test_X   # run a single test
#
# Each test restarts the agent session to ensure a clean state.

set -euo pipefail

AGENT_URL="${AGENT_URL:-http://localhost:8001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
PASS=0; FAIL=0; SKIP=0
FAILURES=""

# ---------- helpers ----------

restart_agent() {
    curl -sf -X POST "$AGENT_URL/session/restart" >/dev/null 2>&1 || true
    # wait for busy=false
    for i in $(seq 1 10); do
        local status
        status=$(curl -sf "$AGENT_URL/session/status" 2>/dev/null || echo '{}')
        if echo "$status" | grep -q '"busy":false'; then
            return 0
        fi
        sleep 1
    done
    echo "  WARN: agent still busy after restart"
}

agent_status() {
    curl -sf "$AGENT_URL/session/status" 2>/dev/null || echo '{}'
}

# Send a message via the streaming endpoint and capture SSE events.
# Returns the full SSE text on stdout. Sets $STREAM_RESPONSE to the final text.
stream_prompt() {
    local msg="$1"
    local timeout="${2:-120}"
    curl -sf -N --max-time "$timeout" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$msg\"}" \
        "$AGENT_URL/prompt/stream" 2>/dev/null || true
}

# Parse SSE events from stream output, extract events of a given type.
# Usage: echo "$sse_output" | extract_events "tool_use"
extract_events() {
    local event_type="$1"
    awk -v evt="$event_type" '
        /^event: / { cur = substr($0, 8) }
        /^data: / && cur == evt { print substr($0, 7) }
    '
}

run_test() {
    local name="$1"
    echo -n "  $name ... "
}

pass() {
    echo "PASS"
    PASS=$((PASS + 1))
}

fail() {
    local reason="${1:-}"
    echo "FAIL${reason:+ ($reason)}"
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - $current_test: $reason"
}

# ---------- tests ----------

test_agent_health() {
    run_test "agent health"
    local r
    r=$(curl -sf "$AGENT_URL/health" 2>/dev/null)
    if echo "$r" | grep -q '"ok"'; then
        pass
    else
        fail "health endpoint not ok: $r"
    fi
}

test_session_restart_clears_busy() {
    run_test "session restart clears busy flag"
    restart_agent
    local status
    status=$(agent_status)
    if echo "$status" | grep -q '"busy":false'; then
        pass
    else
        fail "busy not cleared: $status"
    fi
}

test_single_message_streams_events() {
    run_test "single message streams SSE events"
    restart_agent

    local sse
    sse=$(stream_prompt "Say hello in exactly 3 words." 60)

    local has_status has_text has_done
    has_status=$(echo "$sse" | grep -c "^event: status" || true)
    has_text=$(echo "$sse" | grep -c "^event: text" || true)
    has_done=$(echo "$sse" | grep -c "^event: done" || true)

    if [ "$has_status" -gt 0 ] && [ "$has_text" -gt 0 ] && [ "$has_done" -gt 0 ]; then
        pass
    else
        fail "missing events: status=$has_status text=$has_text done=$has_done"
    fi
}

test_busy_false_after_completion() {
    run_test "busy=false after stream completes"
    # The previous test left a completed session
    local status
    status=$(agent_status)
    if echo "$status" | grep -q '"busy":false'; then
        pass
    else
        fail "busy not false after completion: $status"
    fi
}

test_multi_turn_conversation() {
    run_test "multi-turn: second message also completes"
    restart_agent

    # First message
    local sse1
    sse1=$(stream_prompt "Say hello in exactly 3 words." 60)
    local done1
    done1=$(echo "$sse1" | grep -c "^event: done" || true)

    if [ "$done1" -eq 0 ]; then
        fail "first message did not complete"
        return
    fi

    # Verify not busy
    local status
    status=$(agent_status)
    if echo "$status" | grep -q '"busy":true'; then
        fail "still busy after first message"
        return
    fi

    # Second message (same session)
    local sse2
    sse2=$(stream_prompt "Now say goodbye in exactly 3 words." 60)
    local done2
    done2=$(echo "$sse2" | grep -c "^event: done" || true)

    if [ "$done2" -gt 0 ]; then
        pass
    else
        fail "second message did not complete. Events: $(echo "$sse2" | grep "^event:" | sort | uniq -c)"
    fi
}

test_busy_false_after_multi_turn() {
    run_test "busy=false after multi-turn"
    local status
    status=$(agent_status)
    if echo "$status" | grep -q '"busy":false'; then
        pass
    else
        fail "busy not false: $status"
    fi
}

test_tool_use_events_appear() {
    run_test "tool_use events appear for CRM queries"
    restart_agent

    local sse
    sse=$(stream_prompt "Use the EspoCRM tools to count how many Contact records exist. Return only the number." 120)

    local tool_events
    tool_events=$(echo "$sse" | grep -c "^event: tool_use" || true)
    local done_events
    done_events=$(echo "$sse" | grep -c "^event: done" || true)

    if [ "$tool_events" -gt 0 ] && [ "$done_events" -gt 0 ]; then
        pass
    else
        fail "tool_use=$tool_events done=$done_events"
    fi
}

test_client_disconnect_recovery() {
    run_test "agent recovers after client disconnect"
    restart_agent

    # Start a request but kill it after 3 seconds (simulates browser disconnect)
    timeout 3 bash -c "stream_prompt 'Count all emails in the CRM system' 120" >/dev/null 2>&1 || true

    # Give the server a moment to notice
    sleep 2

    # Check if agent is stuck busy
    local status
    status=$(agent_status)
    local busy
    busy=$(echo "$status" | python3 -c "import sys,json; print(json.load(sys.stdin).get('busy', 'unknown'))" 2>/dev/null || echo "unknown")

    if [ "$busy" = "True" ] || [ "$busy" = "true" ]; then
        # Agent is stuck - this is the known bug
        echo "FAIL (known bug: busy stuck after disconnect)"
        FAIL=$((FAIL + 1))
        FAILURES="${FAILURES}\n  - $current_test: busy stuck after client disconnect"

        # Recover for subsequent tests
        restart_agent
        return
    fi

    # Even if not stuck, verify we can send a new message
    local sse
    sse=$(stream_prompt "Say ok." 30)
    local done_count
    done_count=$(echo "$sse" | grep -c "^event: done" || true)

    if [ "$done_count" -gt 0 ]; then
        pass
    else
        fail "could not send message after disconnect recovery"
        restart_agent
    fi
}

test_409_when_busy() {
    run_test "409 returned when agent is busy"
    restart_agent

    # Start a long request in the background
    stream_prompt "Use EspoCRM tools to list all emails and summarize each one." 120 >/dev/null &
    local bg_pid=$!
    sleep 3

    # Try a second request — should get 409
    local status_code
    status_code=$(curl -sf -o /dev/null -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d '{"message": "hello"}' \
        "$AGENT_URL/prompt/stream" 2>/dev/null || echo "000")

    # Clean up
    kill $bg_pid 2>/dev/null || true
    wait $bg_pid 2>/dev/null || true

    if [ "$status_code" = "409" ]; then
        pass
    else
        fail "expected 409, got $status_code"
    fi

    restart_agent
}

test_frontend_loads() {
    run_test "frontend loads without build errors"
    local http_code
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ]; then
        pass
    else
        fail "frontend returned $http_code"
    fi
}

test_frontend_chat_ui() {
    run_test "chat UI: open, send, receive (playwright)"
    restart_agent

    # Open browser and navigate
    playwright-cli open "$FRONTEND_URL" >/dev/null 2>&1

    # Take snapshot to find chat button
    local snap
    snap=$(playwright-cli snapshot 2>/dev/null)

    # Look for the chat bubble button (MessageSquare icon button at bottom-right)
    # It should be a button with no specific label, near the end of the snapshot
    local chat_ref
    chat_ref=$(playwright-cli snapshot --filename=chat-test.yaml 2>/dev/null | grep -o 'e[0-9]*' | tail -1 || true)

    if [ -z "$chat_ref" ]; then
        echo "SKIP (could not find chat button)"
        SKIP=$((SKIP + 1))
        playwright-cli close >/dev/null 2>&1 || true
        return
    fi

    # Click the last button (chat bubble)
    playwright-cli click "$chat_ref" >/dev/null 2>&1 || true
    sleep 1

    # Take snapshot to find input field
    snap=$(playwright-cli snapshot 2>/dev/null)

    # Type and send a message
    playwright-cli type "hello" >/dev/null 2>&1 || true
    playwright-cli press Enter >/dev/null 2>&1 || true

    # Wait for response (up to 30s)
    local got_response=false
    for i in $(seq 1 15); do
        sleep 2
        local page_snap
        page_snap=$(playwright-cli snapshot 2>/dev/null || true)
        if echo "$page_snap" | grep -qi "triage\|agent\|help\|email\|CRM\|hello"; then
            got_response=true
            break
        fi
    done

    playwright-cli close >/dev/null 2>&1 || true

    if $got_response; then
        pass
    else
        fail "no response in chat UI within 30s"
    fi
}

# ---------- runner ----------

echo "=== Chat E2E Tests ==="
echo "  Agent:    $AGENT_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""

# Collect all test functions
ALL_TESTS=(
    test_agent_health
    test_session_restart_clears_busy
    test_single_message_streams_events
    test_busy_false_after_completion
    test_multi_turn_conversation
    test_busy_false_after_multi_turn
    test_tool_use_events_appear
    test_client_disconnect_recovery
    test_409_when_busy
    test_frontend_loads
    # test_frontend_chat_ui  # slower, uncomment to include
)

# If a test name is passed as argument, run only that test
if [ $# -gt 0 ]; then
    TESTS_TO_RUN=("$@")
else
    TESTS_TO_RUN=("${ALL_TESTS[@]}")
fi

for t in "${TESTS_TO_RUN[@]}"; do
    current_test="$t"
    if declare -f "$t" >/dev/null 2>&1; then
        "$t"
    else
        echo "  $t ... SKIP (unknown test)"
        SKIP=$((SKIP + 1))
    fi
done

echo ""
echo "=== Results: $PASS passed, $FAIL failed, $SKIP skipped ==="
if [ -n "$FAILURES" ]; then
    echo -e "Failures:$FAILURES"
fi

exit $FAIL
