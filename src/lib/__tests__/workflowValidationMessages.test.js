import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

/**
 * Every code the local validators emit is shown through
 * `useTranslations("WorkflowValidation")` (StudioTopBar). A key that lands in
 * another namespace — a merge once parked twenty of them under
 * TeamsWebhookModal — renders the raw code, and the namespace/parity guards
 * in i18nNamespaces.test.js stay green. This one reads the codes from the
 * validators' source and demands each in WorkflowValidation, in both languages.
 */
const VALIDATORS = ["src/lib/workflowGraph.js", "src/lib/workflowTriggers.js"];

function emittedCodes() {
  const codes = new Set();
  for (const file of VALIDATORS) {
    const code = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    for (const m of code.matchAll(/(?:message:\s*|push\(\s*|code:\s*)["'`]([a-z][A-Za-z]+)(?=[:"'`])/g)) {
      codes.add(m[1]);
    }
  }
  return codes;
}

describe("workflow validation messages", () => {
  const codes = emittedCodes();

  it("finds the validators' codes", () => {
    expect(codes.size).toBeGreaterThan(40);
    expect(codes).toContain("setNoFields");
    expect(codes).toContain("triggerKindUnknown");
  });

  it("has a WorkflowValidation message for every emitted code, in en and fr", () => {
    const missing = [...codes].flatMap((c) => [
      ...(en.WorkflowValidation?.[c] === undefined ? [`en: ${c}`] : []),
      ...(fr.WorkflowValidation?.[c] === undefined ? [`fr: ${c}`] : []),
    ]);
    expect(missing).toEqual([]);
  });
});
