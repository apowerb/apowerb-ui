/**
 * The two polynomial patterns CodeQL flagged in the published SDK.
 *
 * Both were O(N squared) on inputs that never match: `\/+$` over a run of
 * slashes, and the greedy classes around the dot in the email pattern. The
 * timing assertions below are deliberately loose -- they only need to fail
 * on a quadratic implementation, where these inputs take seconds.
 */

import { describe, expect, it } from "vitest";

import { apiUrl, configureClient, resetClientConfig } from "../config.js";
import { mockAuthApi } from "../authStorage.js";

function millisecondsOf(fn) {
  const started = performance.now();
  fn();
  return performance.now() - started;
}

describe("apiUrl trailing-slash handling", () => {
  it("still strips every trailing slash", () => {
    configureClient({ baseUrl: "https://agent.example.com///" });
    expect(apiUrl("/api/agents")).toBe("https://agent.example.com/api/agents");
    resetClientConfig();
  });

  it("leaves a clean base alone", () => {
    configureClient({ baseUrl: "https://agent.example.com" });
    expect(apiUrl("/api/agents")).toBe("https://agent.example.com/api/agents");
    resetClientConfig();
  });

  it("stays relative when no base is configured", () => {
    resetClientConfig();
    expect(apiUrl("/api/agents")).toBe("/api/agents");
  });

  it("does not degrade on a long run of slashes", () => {
    configureClient({ baseUrl: `${"/".repeat(50_000)}x` });
    const elapsed = millisecondsOf(() => apiUrl("/api/agents"));
    resetClientConfig();
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("mock register email check", () => {
  const valid = { password: "hunter2", username: "u" };

  it("accepts a normal address", async () => {
    await expect(
      mockAuthApi.register({ email: "someone@example.com", ...valid }),
    ).resolves.toBeTruthy();
  });

  it.each([
    ["no at sign", "someone.example.com"],
    ["two at signs", "a@b@example.com"],
    ["empty local part", "@example.com"],
    ["no dot in the domain", "someone@example"],
    ["whitespace inside", "some one@example.com"],
  ])("rejects %s", async (_label, email) => {
    await expect(mockAuthApi.register({ email, ...valid })).rejects.toThrow(
      "Invalid email format",
    );
  });

  it("does not degrade on a long non-matching address", async () => {
    // Many dots, then an invalid ending: the greedy classes around the dot
    // make the old pattern try every split of the domain. Measured at 2.0s
    // for 30k dots, against 0.2ms for a long domain with no dot at all --
    // which is why the first version of this test caught nothing.
    const email = `a@${"b.".repeat(40_000)} `;
    const started = performance.now();
    await expect(mockAuthApi.register({ email, ...valid })).rejects.toThrow(
      "Invalid email format",
    );
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
