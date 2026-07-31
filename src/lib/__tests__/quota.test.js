/**
 * Décodage du refus de quota (HTTP 402).
 *
 * Sans ce décodage, l'utilisateur voit « HTTP error 402: {"detail":{…} } ».
 * Ces tests verrouillent le fait qu'un 402 de quota devient exploitable, et
 * qu'aucune autre erreur n'est confondue avec lui.
 */
import { describe, it, expect } from "vitest";

import { parseQuotaError, formatTokens, QUOTA_EXCEEDED_CODE } from "@/lib/quota";

const BODY = {
  detail: {
    code: QUOTA_EXCEEDED_CODE,
    message: "Quota atteint",
    used_tokens: 1500,
    limit_tokens: 1000,
    resets_at: "2026-08-01T00:00:00+00:00",
  },
};

describe("parseQuotaError", () => {
  it("décode un 402 de quota, chaîne JSON comprise", () => {
    for (const body of [BODY, JSON.stringify(BODY)]) {
      const q = parseQuotaError(402, body);
      expect(q).toMatchObject({
        code: QUOTA_EXCEEDED_CODE,
        message: "Quota atteint",
        usedTokens: 1500,
        limitTokens: 1000,
      });
    }
  });

  it("ignore les autres statuts", () => {
    expect(parseQuotaError(500, BODY)).toBeNull();
    expect(parseQuotaError(200, BODY)).toBeNull();
  });

  it("ignore un 402 qui n'est pas un dépassement de quota", () => {
    expect(parseQuotaError(402, { detail: { code: "CARD_DECLINED" } })).toBeNull();
  });

  it("ne casse pas sur un corps illisible", () => {
    expect(parseQuotaError(402, "<html>502 Bad Gateway</html>")).toBeNull();
    expect(parseQuotaError(402, "")).toBeNull();
    expect(parseQuotaError(402, null)).toBeNull();
    expect(parseQuotaError(402, undefined)).toBeNull();
  });
});

describe("formatTokens", () => {
  it("abrège les grands nombres", () => {
    expect(formatTokens(1_500_000)).toBe("1.5 M");
    expect(formatTokens(1_000_000)).toBe("1 M");
    expect(formatTokens(2_500)).toBe("2.5 k");
    expect(formatTokens(999)).toBe("999");
  });

  it("rend un tiret plutôt que « null »", () => {
    expect(formatTokens(null)).toBe("—");
    expect(formatTokens(undefined)).toBe("—");
  });
});
