/**
 * Réexport du stockage d'authentification, extrait en paquet autonome
 * (`packages/sdk`). Le chemin `@/lib/authStorage` reste
 * valable pour les 17 modules qui l'utilisent — toute la surface
 * d'origine est conservée (`authStorage`, `authApi`, ...).
 */

export * from "@apowerb/sdk/authStorage";
