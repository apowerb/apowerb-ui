// Tool name emitted by the agent → `kind` of the typed action card, shared by
// the main chat (useChat) and the BI mini chat.
export const ACTION_CARD_TOOL_TO_KIND = {
  request_user_input: "user_input",
  confirm_destructive: "confirm_destructive",
  request_payment: "payment",
  schedule_followup: "followup",
  propose_artifact_edit: "artifact_edit",
  request_file_from_user: "file_request",
  propose_agent_upgrade: "agent_upgrade",
  embed_chart: "chart_embed",
  request_location: "location_request",
};

// ADK hands a dict result as is and anything else wrapped in {result}.
function isRefusal(result) {
  const r = result && typeof result === "object" && "result" in result ? result.result : result;
  return Boolean(r) && typeof r === "object" && (r.success === false || r.status === "error");
}

/**
 * The card is added on the tool CALL. When the tool then refuses it (e.g.
 * embed_chart with an id that is not a chart), drop the last pending card of
 * that tool's kind; otherwise the chat keeps a dead card (a 404 chart, PROD
 * 13/10) that the agent has already moved past.
 */
export function dropRefusedCard(cards, toolName, result) {
  const kind = ACTION_CARD_TOOL_TO_KIND[toolName];
  if (!kind || !cards?.length || !isRefusal(result)) return cards;
  for (let i = cards.length - 1; i >= 0; i--) {
    if (cards[i].kind === kind && cards[i].status === "pending") {
      return [...cards.slice(0, i), ...cards.slice(i + 1)];
    }
  }
  return cards;
}
