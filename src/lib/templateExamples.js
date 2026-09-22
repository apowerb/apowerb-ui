import { templateSuggestionsFor } from "@/lib/workflowGraph";

/**
 * Ready-made values for each template field of the inspector, so a field is
 * never a blank box to guess at. `@ref` stands for the nearest upstream
 * node's whole output (`{{id}}`), `@field` for its first declared field when
 * it has one (a trigger's sample payload key, a Set/Extract field, an HTTP
 * `body`…), else its whole output too.
 *
 * `text` is language-neutral (URLs, JSON, a bare reference). Examples
 * without it are prose, read from the `tplExText_<kind>_<id>` message.
 */
export const TEMPLATE_EXAMPLES = {
  agentInput: [{ id: "summarize" }, { id: "reply" }, { id: "translate" }],
  extractInput: [{ id: "whole", text: "@ref" }, { id: "email" }],
  convertInput: [{ id: "whole", text: "@ref" }, { id: "field", text: "@field" }],
  outputValue: [{ id: "labelled" }, { id: "json", text: '{"result": "@ref"}' }],
  httpUrl: [
    { id: "path", text: "https://api.example.com/items/@field" },
    { id: "query", text: "https://api.example.com/search?q=@field" },
  ],
  httpBody: [{ id: "json", text: '{\n  "text": "@ref"\n}' }],
  ragQuery: [{ id: "whole", text: "@ref" }, { id: "question" }],
  notificationBody: [{ id: "summary" }],
  loopItems: [{ id: "field", text: "@field" }],
  subworkflowInput: [{ id: "whole", text: "@ref" }, { id: "field", text: "@field" }],
};

/** The references an example is built from, taken from the nearest upstream node. */
export function exampleRefs(upstreamNodes) {
  const nearest = upstreamNodes?.[0];
  if (!nearest) return null;
  // Canvas nodes keep their config under `data`; graph nodes at the top.
  const [whole, firstField] = templateSuggestionsFor({ ...nearest, config: nearest.config ?? nearest.data?.config });
  return { ref: whole, field: firstField || whole };
}

export function fillExample(text, refs) {
  return text.replaceAll("@field", refs.field).replaceAll("@ref", refs.ref);
}

/**
 * The examples of a field kind, filled with real references. `prose(key)`
 * returns the raw localized text of a prose example. Empty when the kind
 * is unknown or nothing is upstream to refer to.
 */
export function templateExamplesFor(kind, upstreamNodes, prose) {
  const refs = exampleRefs(upstreamNodes);
  const examples = TEMPLATE_EXAMPLES[kind];
  if (!refs || !examples) return [];
  return examples.map(({ id, text }) => ({
    id,
    labelKey: `tplEx_${kind}_${id}`,
    snippet: fillExample(text ?? prose(`tplExText_${kind}_${id}`), refs),
  }));
}
