import { expect } from "@playwright/test";
import fs from "node:fs";

/**
 * Ce que chaque parcours simulé partage : ouvrir une session, et refuser
 * l'écran rouge.
 *
 * Le simulateur accepte n'importe quel jeton et `/api/users/me` répond un
 * utilisateur de démonstration ; le SDK n'a besoin que des deux clés du
 * `localStorage`. Passer par le formulaire de connexion, comme le faisait
 * `tests/e2e/fixtures.js`, imposait un `E2E_TEST_PASSWORD` et un vrai compte —
 * c'est l'une des raisons pour lesquelles ces spécifications ne tournaient
 * nulle part.
 */

export const DEMO_USER = {
  id: "user_demo",
  email: "demo@th2.ai",
  username: "demo",
  firstName: "Elom",
  lastName: "Demo",
  avatar: null,
  role: "user",
  createdAt: "2026-01-15T00:00:00.000Z",
};

const SHOTS = process.env.E2E_SHOTS_DIR || "tests/e2e-mock/shots";

// La même adresse que celle que la configuration donne au front.
const MOCK_API = process.env.E2E_MOCK_API_URL || "http://localhost:8100";

export function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  return page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

export async function signIn(page, path) {
  // Le simulateur est un seul processus pour toute la suite et son état est en
  // mémoire : sans cette remise à zéro, un agent créé par un parcours change
  // le nombre de cartes que le suivant compte, et le résultat dépend de
  // l'ordre d'exécution.
  await page.request.post(`${MOCK_API}/api/__reset`);
  await page.goto("/login");
  await page.evaluate((user) => {
    localStorage.clear();
    localStorage.setItem("th2_auth_token", "mock_token_e2e");
    localStorage.setItem("th2_auth_user", JSON.stringify(user));
  }, DEMO_USER);
  await page.goto(path);
}

/**
 * L'écran rouge de Next. Un test qui ne le cherche pas peut passer au vert
 * juste après l'avoir provoqué, si son assertion porte sur un élément que la
 * barre latérale rend quand même.
 */
export async function assertNoErrorScreen(page, when) {
  await expect(
    page.getByText(/Something went wrong|Application error|Unhandled Runtime Error/i),
    `écran d'erreur ${when}`
  ).toHaveCount(0);
}
