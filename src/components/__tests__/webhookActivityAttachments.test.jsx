/**
 * Source-level invariants for the "email body + attachments in Activity expanded row" feature.
 *
 * These tests pin security and contract invariants at the source level.
 * They are cheap and blunt — they catch accidental reverts of the
 * critical properties that make the feature safe and correct.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf-8");
}

describe("webhook activity — email body + attachments contract", () => {
  describe("WebhookManager.jsx — XSS safety", () => {
    const src = read("src/components/WebhookManager.jsx");

    it("sandboxes the email-body iframe and never allows scripts", () => {
      expect(src).toMatch(/sandbox=""/);
      expect(src).not.toMatch(/allow-scripts/);
    });

    it("delegates attachment rendering to the WebhookAttachment component", () => {
      // Attachments moved out of WebhookManager into a dedicated component that
      // fetches an authenticated object URL — no raw URL is built inline here.
      expect(src).toContain("<WebhookAttachment");
    });
  });

  describe("attachment fetch — authenticated and path-safe (lib/api.js)", () => {
    const src = read("packages/sdk/src/api.js");

    it("percent-encodes the filename in the attachment path", () => {
      expect(src).toContain("/attachments/${encodeURIComponent(filename)}");
    });

    it("fetches behind auth headers (no unauthenticated public URL)", () => {
      expect(src).toMatch(/export const fetchWebhookLogAttachmentObjectUrl\s*=/);
      expect(src).toContain("getAuthHeaders()");
    });
  });

  describe("WebhookAttachment.jsx — safe open", () => {
    const src = read("src/components/WebhookAttachment.jsx");

    it("opens the fetched object URL with noopener (no raw URL injection)", () => {
      expect(src).toContain("fetchWebhookLogAttachmentObjectUrl");
      expect(src).toContain('"noopener"');
    });
  });

  describe("lib/api.js — getWebhookLogBody export", () => {
    const src = read("packages/sdk/src/api.js");

    it("exports getWebhookLogBody function targeting /api/webhooks/logs/:id/body", () => {
      expect(src).toMatch(/export const getWebhookLogBody\s*=/);
      expect(src).toContain("/api/webhooks/logs/${id}/body");
    });
  });
});
