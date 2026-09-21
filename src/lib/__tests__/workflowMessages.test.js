import { describe, it, expect } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

// next-intl lit chaque message en syntaxe ICU : une accolade littérale
// ({{noeud.chemin}}, {item, index, previous}) doit être échappée, sinon le
// message échoue et l'UI affiche la clé brute (mesuré sur la pile e2e, 21/09).
const NAMESPACES = ["LoopBodyEditor", "LoopConfigBlock", "WorkflowCanvas", "WorkflowExecutionPanel",
  "WorkflowInspector", "WorkflowNode", "WorkflowPalette", "WorkflowPanel", "WorkflowStudio",
  "WorkflowValidation", "WorkflowVersions", "WorkflowsPage"];

function entries(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [[prefix + k, v]] : entries(v, `${prefix}${k}.`));
}

describe.each([["en", en], ["fr", fr]])("workflow studio messages (%s)", (locale, messages) => {
  const all = NAMESPACES.filter((ns) => messages[ns]).flatMap((ns) => entries(messages[ns], `${ns}.`));

  it("covers the studio namespaces", () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it.each(all)("%s parses as ICU", (_key, message) => {
    expect(() => new IntlMessageFormat(message, locale)).not.toThrow();
  });

  it("keeps template braces visible once formatted", () => {
    const fmt = (key) => new IntlMessageFormat(messages.WorkflowInspector[key], locale).format();
    expect(fmt("loopItemsPlaceholder")).toMatch(/^\{\{.+\}\}$/);
    expect(fmt("loopBodyHelp")).toContain("{item, index, previous}");
  });
});
