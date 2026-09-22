// src/app/forms/[token]/page.jsx

import WorkflowFormView from "./WorkflowFormView";

export default async function WorkflowFormPage({ params }) {
  const { token } = await params;

  return <WorkflowFormView token={token} />;
}
