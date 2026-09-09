#!/usr/bin/env node
/**
 * Le garde qui aurait vu l'écran rouge du 08/09.
 *
 * `b7a18b5` a remplacé le `generateSessionId` local de ScheduleRunModal par
 * `newSessionId` à UN seul de ses trois appels. Les deux autres appelaient une
 * fonction supprimée -- dont celui de l'effet joué à l'OUVERTURE du modal, donc
 * « Something went wrong » avant même que l'écran s'affiche. Rien ne l'a vu :
 * ni le lint (`eslint-config-next` n'active pas `no-undef`), ni un test (le
 * composant n'était pas couvert), ni le build (Next compile un identifiant
 * libre sans broncher, c'est une erreur d'exécution).
 *
 * Pourquoi un script plutôt que `npx eslint src` en CI : cette commande rend
 * aujourd'hui 61 erreurs et 27 avertissements sur `main` -- une dette réelle,
 * dont 50 `react-hooks/set-state-in-effect`. Brancher le lint entier en CI
 * demanderait de la solder d'abord ; brancher CE défaut-là ne demande rien et
 * couvre la panne qui a coûté la démo. Le reste est compté et affiché, jamais
 * bloquant, pour que la dette reste visible au lieu d'être oubliée.
 *
 * La règle elle-même vit dans `eslint.config.mjs`, pas ici : un éditeur la
 * montre donc pendant qu'on écrit, et ce script n'a pas sa propre idée de la
 * configuration.
 */

import { ESLint } from "eslint";

const TARGET = "src";
const GATED = "no-undef";

const eslint = new ESLint({ cwd: process.cwd() });
const results = await eslint.lintFiles([TARGET]);

// Un garde qui n'a rien lu rend « rien à signaler » et ressemble à un succès.
// C'est le même piège que `kubeconform` rendant 0 sur 0 ressource : on lit le
// nombre, pas le code de retour.
if (results.length === 0) {
  console.error(`✗ aucun fichier lu sous ${TARGET}/ -- ce garde n'a rien prouvé.`);
  process.exit(1);
}

const gated = [];
const others = new Map();
for (const file of results) {
  for (const m of file.messages) {
    if (m.ruleId === GATED) {
      gated.push({ file: file.filePath, line: m.line, col: m.column, message: m.message });
    } else {
      const key = m.ruleId ?? "(sans règle)";
      others.set(key, (others.get(key) ?? 0) + 1);
    }
  }
}

const root = process.cwd() + "/";
console.log(`${results.length} fichiers lus sous ${TARGET}/.`);

if (others.size > 0) {
  const total = [...others.values()].reduce((a, b) => a + b, 0);
  console.log(`\nDette existante, comptée et NON bloquante (${total}) :`);
  for (const [rule, n] of [...others].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${rule}`);
  }
}

if (gated.length === 0) {
  console.log(`\n✓ aucun ${GATED} sous ${TARGET}/.`);
  process.exit(0);
}

console.error(`\n✗ ${gated.length} identifiant(s) libre(s) sous ${TARGET}/ :\n`);
for (const g of gated) {
  console.error(`  ${g.file.replace(root, "")}:${g.line}:${g.col}  ${g.message}`);
}
console.error(
  "\nUn identifiant qui n'est déclaré ni importé nulle part est une " +
  "ReferenceError au moment où la ligne s'exécute. Le build ne l'attrape pas."
);
process.exit(1);
