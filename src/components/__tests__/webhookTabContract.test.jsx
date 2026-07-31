/**
 * Source-level invariants for the "webhook results live in their tab, not the chat" decision.
 *
 * Live decision 2026-05-19: webhook-triggered agent runs must surface in
 * `/webhooks` (Activity tab), not in the chat sidebar. The contract spans
 * four files and two repos:
 *
 *   - th2agent backend (`outlook.py`)            session_id = f"webhook_{log_id}"
 *                                                push notif link = /webhooks?log=<log_id>
 *
 *   - th2agent-app frontend
 *       `lib/api.js`                             getWebhookLog(id) helper exists
 *       `WebhookManager.jsx`                     reads ?log + ?tab, load-more pagination, deep-link fetch
 *       `ChatContainer.jsx`                      sidebar excludes `webhook_*`, redirects deep-links
 *       `app/(dashboard)/webhooks/page.jsx`      Suspense wrapper for useSearchParams
 *
 * These tests pin those invariants at the source level. They are cheap and
 * blunt — a runtime regression in WebhookManager pagination would still
 * pass — but they catch every accidental revert of the four anchors that
 * make the cross-component contract work.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf-8");
}

describe("webhook-tab-only contract", () => {
  describe("lib/api.js", () => {
    const src = read("packages/apowerb-sdk/src/api.js");

    it("exposes a getWebhookLog(id) helper hitting /api/webhooks/logs/:id", () => {
      expect(src).toMatch(/export const getWebhookLog\s*=\s*\(id\)\s*=>/);
      expect(src).toContain("/api/webhooks/logs/${id}");
    });
  });

  describe("WebhookManager.jsx", () => {
    const src = read("src/components/WebhookManager.jsx");

    it("imports getWebhookLog so deep-link can fetch a row outside the current page", () => {
      expect(src).toContain("getWebhookLog");
    });

    it("reads ?log and ?tab from the URL via useSearchParams", () => {
      expect(src).toContain('from "@/lib/navigation"');
      expect(src).toContain("useSearchParams");
      expect(src).toMatch(/searchParams\?\.get\("log"\)/);
      expect(src).toMatch(/searchParams\?\.get\("tab"\)/);
    });

    it("uses load-more pagination, not a fixed cap", () => {
      expect(src).toContain("ACTIVITY_PAGE_SIZE");
      // No legacy hard-coded `limit: "50", offset: "0"` literal lingering.
      expect(src).not.toMatch(/limit:\s*"50",\s*offset:\s*"0"/);
      // Load-more button is rendered when hasMore is true, label sourced from i18n.
      expect(src).toContain('t("loadMoreButton")');
      const messages = JSON.parse(read("messages/en.json"));
      expect(messages.WebhookManager.loadMoreButton).toBe("Load more");
    });
  });

  describe("ChatContainer.jsx", () => {
    const src = read("src/components/chat/ChatContainer.jsx");

    it("redirects deep-links of the form ?session=webhook_* to /webhooks", () => {
      expect(src).toContain('initialSession.startsWith("webhook_")');
      expect(src).toMatch(/router\.replace\(target\)/);
    });

    it("filters webhook_* sessions out of the chat sidebar unconditionally", () => {
      expect(src).toContain("isWebhookSession");
      expect(src).toMatch(/s\.id\.startsWith\("webhook_"\)/);
    });
  });

  describe("webhooks page", () => {
    const src = read("src/app/(dashboard)/webhooks/page.jsx");

    it("wraps WebhookManager in <Suspense> (required by useSearchParams)", () => {
      expect(src).toContain('from "react"');
      expect(src).toContain("Suspense");
      expect(src).toMatch(/<Suspense[^>]*>\s*<WebhookManager/);
    });
  });
});
