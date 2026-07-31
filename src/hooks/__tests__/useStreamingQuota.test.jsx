/**
 * Câblage « la jauge suit la conversation ».
 *
 * C'est le maillon central de la mise à jour en continu : sans cet appel,
 * la barre ne bougerait qu'au rechargement de la page. Il est dans un
 * `finally`, donc il doit se déclencher aussi quand la conversation
 * échoue ou est interrompue — des tokens ont pu être consommés avant.
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// `useStreaming` ne connait plus le magasin de quota : il signale la fin d'un
// run au registre, et une brique decide quoi en faire. Le test suit ce lien.
const notifyQuotaMayHaveChanged = vi.fn();
vi.mock("@/extensions/registry", () => ({
  notifyRunFinished: (...a) => notifyQuotaMayHaveChanged(...a),
}));

vi.mock("@/lib/authStorage", () => ({
  authStorage: { getToken: () => "jeton-de-test" },
}));

import { useStreaming } from "@/hooks/useStreaming";

function sseResponse(body) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    headers: { get: () => "text/event-stream" },
    body: {
      getReader: () => {
        let sent = false;
        return {
          read: async () => {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: encoder.encode(body) };
          },
          releaseLock: () => {},
        };
      },
    },
  };
}

const baseArgs = {
  agentId: "agent1",
  userId: "u@example.com",
  sessionId: "s1",
  message: "bonjour",
  onChunk: () => {},
  onThinking: () => {},
  onToolCall: () => {},
  onToolResult: () => {},
  onMeta: () => {},
  onComplete: () => {},
  onError: () => {},
};

beforeEach(() => {
  notifyQuotaMayHaveChanged.mockReset();
});

describe("useStreaming — rafraîchissement du quota", () => {
  it("rafraîchit la jauge à la fin d'une conversation réussie", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseResponse('data: {"content":{"parts":[{"text":"salut"}]}}\n\n')
    );
    const { result } = renderHook(() => useStreaming());
    await act(async () => {
      await result.current.startStreaming(baseArgs);
    });
    expect(notifyQuotaMayHaveChanged).toHaveBeenCalledTimes(1);
  });

  it("rafraîchit aussi quand la conversation échoue", async () => {
    // Des tokens ont pu être consommés avant l'erreur : ne pas rafraîchir
    // laisserait la barre en retard sans que rien ne le signale.
    global.fetch = vi.fn().mockRejectedValue(new Error("réseau"));
    const { result } = renderHook(() => useStreaming());
    await act(async () => {
      await result.current.startStreaming({ ...baseArgs, onError: () => {} });
    });
    expect(notifyQuotaMayHaveChanged).toHaveBeenCalledTimes(1);
  });

  it("rafraîchit quand un quota dépassé refuse le run", async () => {
    // Le refus 402 doit se refléter tout de suite : c'est le moment précis
    // où l'utilisateur cherche à comprendre pourquoi il est bloqué.
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: { get: () => "application/json" },
      text: async () =>
        JSON.stringify({
          detail: { code: "QUOTA_EXCEEDED", message: "plafond atteint" },
        }),
    });
    const { result } = renderHook(() => useStreaming());
    await act(async () => {
      await result.current.startStreaming({ ...baseArgs, onError: () => {} });
    });
    expect(notifyQuotaMayHaveChanged).toHaveBeenCalledTimes(1);
  });
});
