// Test-run payload helpers. The JSON text stays the single source of truth:
// the Text and Form modes of the payload editor only read and write it.

/** Read a form value as JSON when it parses (12, true, null, [..], {..}); otherwise keep the string. */
export function coerceFieldValue(raw) {
  const text = String(raw ?? "");
  if (text.trim() === "") return "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function fieldText(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Form rows for a payload text, or null when it is not a JSON object (the form cannot show it). */
export function payloadRows(text) {
  let value;
  try {
    value = (text || "").trim() === "" ? {} : JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.entries(value).map(([key, v]) => ({ key, value: fieldText(v) }));
}

/** Payload text for form rows; rows without a key are skipped, later duplicates win. */
export function rowsToPayloadText(rows = []) {
  const out = {};
  for (const { key, value } of rows) {
    const k = (key || "").trim();
    if (k) out[k] = coerceFieldValue(value);
  }
  return JSON.stringify(out, null, 2);
}

/** Plain-text mode sends `{ "message": text }`, what a chat trigger receives. */
export function textToPayloadText(text) {
  return JSON.stringify({ message: text ?? "" }, null, 2);
}

/** The message of a payload text, when it is a string `message` field; otherwise "". */
export function payloadMessage(text) {
  try {
    const value = JSON.parse(text || "{}");
    return value && typeof value.message === "string" ? value.message : "";
  } catch {
    return "";
  }
}

/** Pretty-printed JSON, or null when the text does not parse. */
export function formatPayloadText(text) {
  try {
    return JSON.stringify(JSON.parse(text || "{}"), null, 2);
  } catch {
    return null;
  }
}
