import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,

  // `eslint-config-next` n'active PAS `no-undef`, et c'est ce qui a coûté la
  // démo du 08/09 : un correctif de sécurité a remplacé le `generateSessionId`
  // local de ScheduleRunModal à UN seul de ses trois appels. Les deux autres
  // appelaient une fonction supprimée -- dont celui de l'effet joué à
  // l'OUVERTURE du modal, donc « Something went wrong » avant même que l'écran
  // s'affiche. Ni le lint, ni les tests (le composant n'était pas couvert), ni
  // le build : Next compile un identifiant libre sans broncher, l'erreur est à
  // l'exécution.
  //
  // Limitée à `src/` : les globales du navigateur, de Node et de vitest y sont
  // déjà posées par la configuration ci-dessus, et la règle rend 0 sur les
  // 429 fichiers de ce dossier. La CI la tient par `.github/scripts/lint-no-undef.mjs`,
  // qui n'échoue que sur elle -- le reste du lint porte une dette qu'il faudrait
  // solder d'abord.
  {
    files: ["src/**/*.{js,jsx,mjs}"],
    rules: { "no-undef": "error" },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
