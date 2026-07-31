/**
 * Point d'entrée du client d'API th2agent.
 *
 * Usage hors de l'application Next :
 *
 *     import { configureClient, listAgents } from "@apowerb/sdk";
 *
 *     configureClient({
 *       baseUrl: "https://agent.example.com",
 *       storage: { getToken: () => process.env.TH2AGENT_TOKEN },
 *     });
 *
 *     const agents = await listAgents();
 *
 * Sans appel à `configureClient`, le comportement est celui d'origine :
 * requêtes relatives et jeton lu dans localStorage.
 */

export * from "./api.js";
export * from "./authStorage.js";
export {
  apiUrl,
  configureClient,
  getClientConfig,
  resetClientConfig,
} from "./config.js";
