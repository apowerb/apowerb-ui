import { describe, it, expect } from "vitest";
import { validatePaymentUrl, validateCalendarUrl } from "../validateAgentUrl";

describe("validatePaymentUrl", () => {
  it("accepts a valid Stripe checkout URL", () => {
    const result = validatePaymentUrl("https://checkout.stripe.com/c/pay/cs_test_abc");
    expect(result.safe).toBe(true);
    expect(result.reason).toBe("");
  });

  it("accepts buy.stripe.com", () => {
    const result = validatePaymentUrl("https://buy.stripe.com/test_abc");
    expect(result.safe).toBe(true);
  });

  it("accepts billing.stripe.com", () => {
    const result = validatePaymentUrl("https://billing.stripe.com/session_abc");
    expect(result.safe).toBe(true);
  });

  it("rejects javascript: URLs", () => {
    const result = validatePaymentUrl("javascript:alert(1)");
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/protocol/i);
  });

  it("rejects http on Stripe (non-https)", () => {
    const result = validatePaymentUrl("http://checkout.stripe.com/foo");
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/https/i);
  });

  it("rejects arbitrary phishing domain", () => {
    const result = validatePaymentUrl("https://checkout.stripe.com.phishing.com/foo");
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/domain/i);
  });

  it("rejects malformed URLs", () => {
    const result = validatePaymentUrl("not a url");
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/invalid|malformed/i);
  });

  it("rejects empty/nullish URLs", () => {
    expect(validatePaymentUrl("").safe).toBe(false);
    expect(validatePaymentUrl(null).safe).toBe(false);
    expect(validatePaymentUrl(undefined).safe).toBe(false);
  });
});

describe("validateCalendarUrl", () => {
  it("accepts Google calendar URL", () => {
    const result = validateCalendarUrl("https://calendar.google.com/event?id=abc");
    expect(result.safe).toBe(true);
  });

  it("accepts Outlook Live calendar URL", () => {
    const result = validateCalendarUrl("https://outlook.live.com/calendar");
    expect(result.safe).toBe(true);
  });

  it("accepts Outlook Office 365 calendar URL", () => {
    const result = validateCalendarUrl("https://outlook.office365.com/calendar/abc");
    expect(result.safe).toBe(true);
  });

  it("accepts http on calendar domains", () => {
    const result = validateCalendarUrl("http://calendar.google.com/event?id=abc");
    expect(result.safe).toBe(true);
  });

  it("rejects javascript: URLs", () => {
    const result = validateCalendarUrl("javascript:alert(1)");
    expect(result.safe).toBe(false);
  });

  it("rejects unlisted domain", () => {
    const result = validateCalendarUrl("https://evil.com/cal");
    expect(result.safe).toBe(false);
  });

  it("rejects malformed URLs", () => {
    const result = validateCalendarUrl("not-a-url");
    expect(result.safe).toBe(false);
  });
});
