# th2agent-app — vision produit et cadre de travail

> À lire avant toute décision d'architecture, de packaging ou de découpage de composants.
> Source : réunion Farid ↔ David du 28/07/2026. État du code vérifié le 28/07/2026.

## 1. Le modèle : open core

thaink2 vend **du sur-mesure** (plateforme + composante métier custom),
cible PME. Le Studio n'est pas le produit vendu : c'est **le levier de visibilité**.

Deux portes d'entrée, dans cet ordre : **(1)** « Get started » — le Studio hébergé en
freemium, **(2)** « Self-host » — open source, référence assumée = **n8n** (community
edition). Le Studio d'abord : on le finalise, on l'ouvre, on communique.

Le front est concerné directement : il doit exister **en deux versions** — une version
open source « sans auth advanced », et la version commerciale actuelle.

## 2. Ce que ça impose au front

**Reste commercial** : SSO / SAML / LDAP, les écrans de logs, les écrans d'usage.
**Part en OSS** : le reste du Studio.

⚠️ Ces écrans doivent être **retirables proprement** — par feature flag ou par frontière de
paquet — jamais entrelacés avec la navigation ou les layouts du cœur. Toute nouvelle page
sensible (billing, logs, usage, admin) se conçoit dès le départ comme détachable.

## 3. État réel (vérifié le 28/07/2026)

L'extraction est **mergée sur `main` et tourne en dev** — c'est ce que Farid a vu et validé :

- **#130** — `src/lib/api.js` (139 fonctions) extrait en paquet npm workspace
  `packages/apowerb-sdk` (`@apowerb/apowerb-sdk`). `const BASE = ""` remplacé par
  `configureClient({baseUrl, storage, onUnauthorized})`. Les anciens chemins sont des
  réexports : les 75 + 17 modules consommateurs n'ont pas bougé.
- **#131** — 118 fichiers migrés `next-intl` → `use-intl` (cœur agnostique, même API).
- **#133** — `src/lib/navigation.jsx` abstrait `useRouter/usePathname/useSearchParams/Link/Image`.
  Le contexte transporte des **implémentations de hooks, pas leurs valeurs** (sinon
  `useSearchParams` ferait remonter une frontière Suspense au layout).
  `src/lib/NextNavigationProvider.jsx`, monté dans `src/app/layout.jsx`, est le seul endroit
  qui importe encore `next/navigation|link|image`.

Résultat mesuré : composants utilisables hors Next **25 % → 100 %** (227/227).

**Restant** : les 227 composants sont découplés mais **pas extraits** en paquet
`@thaink2/th2agent-ui`. Deux verrous connus : (a) la distribution des styles Tailwind v4
(`globals.css` fait 1717 lignes avec un `@theme`), (b) le périmètre exporté — tout exposer
figerait des composants métier en API publique.

Ce qui n'existe pas : `Dockerfile`, `docker-compose`, Helm chart, doc self-host.
`package.json` est encore `"private": true` et rien n'est publié.

## 4. Règles pour toute session travaillant ici

1. **Ne rien publier** (npm ou PyPI). Farid s'occupe de la publication et a demandé
   d'attendre son feu vert.
2. **Découpler de Next.js** tout ce qui entre dans le paquet de composants. Le pattern est
   posé par #133 — passer par `src/lib/navigation.jsx`, jamais réimporter `next/navigation`,
   `next/link` ou `next/image` ailleurs que dans `NextNavigationProvider.jsx`. Idem i18n :
   `use-intl`, pas `next-intl`. ⚠️ Du code neuf réintroduit régulièrement l'ancien motif
   (`QuotaMeter` importait `next-intl` le lendemain de la migration) — vérifier après chaque
   merge de `main`.
3. **Les tests moquent l'i18n et la navigation** : ils ne prouvent rien sur le câblage réel.
   Vérifier au runtime dans le navigateur. Signature qui prouve que Next passe bien par le
   contexte : les images sortent en `/_next/image?url=...` avec `srcset` (sinon c'est le
   repli `<img>`).
4. **Pas de valeur codée en dur propre à un client** dans le cœur : le métier vit dans le
   template et la DB.
5. `next dev` ne compile pas le CSS Tailwind de la même façon que le build — vérifier le
   rendu réel avant de conclure qu'un style est cassé.

## 5. Écosystème

Le back correspondant est `thaink2/th2agent` (voir son `CLAUDE.md` pour l'état du quota,
du billing Stripe et du packaging). Périmètre open source arrêté : `th2agent`,
`th2agent-front`, `th2etl`, `th2pulse`, `th2rag`. Seul `th2pulse` est déjà un repo public
(MIT) et seul `th2etl` est publié sur PyPI.
