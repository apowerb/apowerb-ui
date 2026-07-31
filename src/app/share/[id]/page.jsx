// src/app/share/[id]/page.jsx

import SharedConversationView from "./SharedConversationView";

export default async function SharedConversationPage({ params }) {
  const { id } = await params;

  return <SharedConversationView shareId={id} />;
}