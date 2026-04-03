/**
 * Serialize a database row to a plain JSON-safe object.
 * Converts Date instances to ISO strings.
 */
export function serialize(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = value instanceof Date ? value.toISOString() : value;
  }
  return result;
}

/**
 * Coerce a JSON input value to the expected type for a database column.
 * Handles: ISO date strings → Date, string booleans → boolean, string ints → number.
 */
export function coerceValue(
  columnType: "timestamp" | "boolean" | "integer" | "other",
  value: unknown,
): unknown {
  if (value === null || value === undefined) return value;

  if (columnType === "timestamp" && typeof value === "string") {
    const parsed = new Date(value.replace("Z", "+00:00"));
    return isNaN(parsed.getTime()) ? value : parsed;
  }

  if (columnType === "integer" && typeof value !== "number") {
    const n = Number(value);
    return isNaN(n) ? value : Math.trunc(n);
  }

  if (columnType === "boolean" && typeof value !== "boolean") {
    if (typeof value === "string") {
      return ["true", "1", "yes"].includes(value.toLowerCase());
    }
  }

  return value;
}
