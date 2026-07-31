/**
 * URL validators for agent-controlled links.
 *
 * An agent can emit arbitrary URLs via tool calls. We treat those URLs as
 * untrusted input and whitelist the known-safe domains per category.
 *
 * All validators return `{ safe: boolean, reason: string }`.
 */

const PAYMENT_ALLOWED_HOSTS = [
  "checkout.stripe.com",
  "buy.stripe.com",
  "billing.stripe.com",
];

const CALENDAR_ALLOWED_HOSTS = [
  "calendar.google.com",
  "outlook.live.com",
  "outlook.office.com",
  "outlook.office365.com",
];

function parseUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function validatePaymentUrl(url) {
  const parsed = parseUrl(url);
  if (!parsed) {
    return { safe: false, reason: "Invalid or malformed URL" };
  }
  if (parsed.protocol !== "https:") {
    return { safe: false, reason: "Only https protocol is allowed" };
  }
  if (!PAYMENT_ALLOWED_HOSTS.includes(parsed.hostname)) {
    return { safe: false, reason: `Domain not in payment whitelist: ${parsed.hostname}` };
  }
  return { safe: true, reason: "" };
}

export function validateCalendarUrl(url) {
  const parsed = parseUrl(url);
  if (!parsed) {
    return { safe: false, reason: "Invalid or malformed URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { safe: false, reason: "Only http/https protocols are allowed" };
  }
  if (!CALENDAR_ALLOWED_HOSTS.includes(parsed.hostname)) {
    return { safe: false, reason: `Domain not in calendar whitelist: ${parsed.hostname}` };
  }
  return { safe: true, reason: "" };
}
