/**
 * Unit tests for unescapeMarkdown — handles the case where the worker agent
 * double-escapes newlines when writing JSON through bash.
 *
 * Scenario: LLM writes `crm tasks create --json '{"description":"a\\n\\nb"}'`
 * After JSON.parse the description contains literal `\n` (backslash + n)
 * instead of an actual newline. We need to unescape at display time.
 */

import { test, expect } from "vitest";
import { unescapeMarkdown } from "../frontend/src/lib/unescape-markdown.js";

test("converts literal \\n to real newlines", () => {
  expect(unescapeMarkdown("line1\\nline2")).toBe("line1\nline2");
});

test("converts literal \\n\\n to paragraph break", () => {
  expect(unescapeMarkdown("para1\\n\\npara2")).toBe("para1\n\npara2");
});

test("converts literal \\t to real tab", () => {
  expect(unescapeMarkdown("col1\\tcol2")).toBe("col1\tcol2");
});

test("preserves real newlines untouched", () => {
  expect(unescapeMarkdown("line1\nline2")).toBe("line1\nline2");
});

test("handles mixed real and literal newlines", () => {
  expect(unescapeMarkdown("real\nlit\\nreal")).toBe("real\nlit\nreal");
});

test("real-world task description from screenshot", () => {
  const input =
    "**Prevent contractor work hold immediately**\\n\\n**Contact:** Mairead Coyne\\n**Threat:** Hold on work\\n\\n**Actions needed:**\\n1. Call Crest Electrical";
  const out = unescapeMarkdown(input);
  expect(out).not.toContain("\\n");
  expect(out.split("\n\n").length).toBe(3);
});

test("handles null and undefined gracefully", () => {
  expect(unescapeMarkdown(null)).toBe("");
  expect(unescapeMarkdown(undefined)).toBe("");
});

test("empty string returns empty string", () => {
  expect(unescapeMarkdown("")).toBe("");
});

test("does not double-unescape \\\\n (escaped backslash before n)", () => {
  // \\\\n in source = backslash-backslash-n in string
  // Intent: literal backslash followed by 'n' (e.g. showing escape syntax)
  // Should stay as backslash + n
  expect(unescapeMarkdown("show the \\\\n escape")).toBe("show the \\n escape");
});
