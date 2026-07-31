"use client";

import UserInputCard from "./UserInputCard";
import ConfirmDestructiveCard from "./ConfirmDestructiveCard";
import PaymentCard from "./PaymentCard";
import FollowupCard from "./FollowupCard";
import ArtifactEditCard from "./ArtifactEditCard";
import FileRequestCard from "./FileRequestCard";
import AgentUpgradeCard from "./AgentUpgradeCard";
import ChartEmbedCard from "./ChartEmbedCard";
import LocationRequestCard from "./LocationRequestCard";

const REGISTRY = {
  user_input: UserInputCard,
  confirm_destructive: ConfirmDestructiveCard,
  payment: PaymentCard,
  followup: FollowupCard,
  artifact_edit: ArtifactEditCard,
  file_request: FileRequestCard,
  agent_upgrade: AgentUpgradeCard,
  chart_embed: ChartEmbedCard,
  location_request: LocationRequestCard,
};

export default function ActionCard({ card, onRespond, agentId, agentName }) {
  if (!card) return null;
  const Component = REGISTRY[card.kind];
  if (!Component) {
    console.warn("[ActionCard] Unknown card kind:", card.kind);
    return null;
  }
  return (
    <Component
      card={card}
      onRespond={onRespond}
      agentId={agentId}
      agentName={agentName}
    />
  );
}
