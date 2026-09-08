import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

/**
 * A namespace that no longer exists in messages/ renders its key path in the
 * UI ("DefaultLlmUsageMeter.thisMonth") instead of text, and nothing fails at
 * build time. This walks every `useTranslations("X")` in the source and
 * demands X in both languages — the guard that was missing when a rebase
 * silently dropped the sidebar meter's namespace.
 */
const SRC = path.join(process.cwd(), "src");

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sourceFiles(p);
    return /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
  });
}

function usedNamespaces() {
  const found = new Map();
  for (const file of sourceFiles(SRC)) {
    const code = fs.readFileSync(file, "utf8");
    for (const m of code.matchAll(/useTranslations\(\s*["'`]([\w.]+)["'`]\s*\)/g)) {
      if (!found.has(m[1])) found.set(m[1], path.relative(process.cwd(), file));
    }
  }
  return found;
}

const has = (messages, ns) =>
  ns.split(".").reduce((node, key) => (node && typeof node === "object" ? node[key] : undefined), messages) !== undefined;

describe("i18n namespaces", () => {
  const used = usedNamespaces();

  it("finds the namespaces the app actually asks for", () => {
    expect(used.size).toBeGreaterThan(20);
  });

  it("declares every used namespace in en.json and fr.json", () => {
    const missing = [...used].flatMap(([ns, file]) => [
      ...(has(en, ns) ? [] : [`en: ${ns} (${file})`]),
      ...(has(fr, ns) ? [] : [`fr: ${ns} (${file})`]),
    ]);
    expect(missing).toEqual([]);
  });

  it("keeps the two languages structurally identical", () => {
    const flat = (o, p = "", out = new Set()) => {
      for (const [k, v] of Object.entries(o)) {
        v && typeof v === "object" ? flat(v, `${p}${k}.`, out) : out.add(`${p}${k}`);
      }
      return out;
    };
    const a = flat(en);
    const b = flat(fr);
    expect([...a].filter((k) => !b.has(k))).toEqual([]);
    expect([...b].filter((k) => !a.has(k))).toEqual([]);
  });
});
