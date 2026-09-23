/**
 * Model for the one-click starter agent.
 *
 * The backend checks every model through litellm, and a bare id such as
 * "gemini-2.0-flash" is refused with a 422 since litellm 1.95.0: the
 * starter could no longer be created (roadmap#92). The shared model needs
 * no API key, so it comes first whenever the server offers it; otherwise
 * the starter gets a provider-prefixed id.
 */
export const STARTER_FALLBACK_MODEL = "gemini/gemini-2.5-flash";

/**
 * @param models  the GET /models response ({ providers: [{ models: [{ id }] }] }), or null
 * @param defaultModelId  the shared model's id, as ModelSelector names it
 */
export function starterAgentModel(models, defaultModelId) {
  const offered = (models?.providers || []).some((provider) =>
    (provider.models || []).some((model) => model.id === defaultModelId),
  );
  return offered ? defaultModelId : STARTER_FALLBACK_MODEL;
}
