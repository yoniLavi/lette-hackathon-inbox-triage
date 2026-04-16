/**
 * Unescape literal backslash-escapes in text that was double-escaped
 * through a bash+JSON pipeline.
 *
 * Background: the worker agent creates CRM records via bash calls like
 *   crm tasks create --json '{"description":"a\\n\\nb"}'
 * When the LLM writes `\\n` in the JSON body, JSON.parse produces literal
 * backslash-n (two characters) instead of a newline. This renders as
 * "a\n\nb" in the UI instead of the intended paragraph break.
 *
 * This helper converts common literal escapes (\n, \t, \r) back to their
 * real characters. Used at display time so we don't mutate stored data.
 *
 * Uses negative lookbehind to avoid unescaping `\\n` (escaped backslash
 * before a literal 'n'), which might legitimately mean "show the backslash".
 */
export function unescapeMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/(?<!\\)\\n/g, "\n")
    .replace(/(?<!\\)\\t/g, "\t")
    .replace(/(?<!\\)\\r/g, "\r")
    .replace(/\\\\/g, "\\");
}
