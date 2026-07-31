/**
 * Réexport du client d'API, désormais extrait en paquet autonome
 * (`packages/apowerb-sdk`).
 *
 * Ce fichier existe pour que les 75 modules qui importent `@/lib/api`
 * n'aient pas à changer : le chemin historique reste valable, seule
 * l'implémentation a déménagé. Le nouveau code peut importer directement
 * `@thaink2/apowerb-sdk`.
 */

export * from "@thaink2/apowerb-sdk";
