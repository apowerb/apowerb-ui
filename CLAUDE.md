# apowerb-ui — product vision and working frame

> Read before any decision about architecture, packaging or component boundaries.
> Source: Farid ↔ David meeting, 2026-07-28. Code state verified 2026-07-31.

## 1. The model: open core

thaink2 sells **bespoke work** (platform plus a custom business component), aimed at small
and mid-sized companies. The Studio is not the product being sold: it is **the visibility
lever**.

Two entry doors, in this order: **(1)** "Get started" — the hosted Studio as freemium,
**(2)** "Self-host" — open source, stated reference: **n8n** (community edition). The Studio
first: finish it, open it, communicate.

The front end is directly concerned: it has to exist **in two versions** — an open source one
"without advanced auth", and the current commercial one.

## 2. What that imposes on the front end

**Stays commercial**: SSO / SAML / LDAP, the log screens, the usage screens.
**Goes open source**: the rest of the Studio.

⚠️ Those screens must be **cleanly removable** — by feature flag or by package boundary —
never interleaved with the core navigation or layouts. Any new sensitive page (billing, logs,
usage, admin) is designed from the start as detachable.

## 3. Actual state (verified 2026-07-31)

The extraction is merged on `main` and running:

- **#130** — `src/lib/api.js` (143 functions) extracted into the npm workspace package
  `packages/apowerb-sdk` (`@apowerb/apowerb-sdk`). `const BASE = ""` replaced by
  `configureClient({baseUrl, storage, onUnauthorized})`. The old paths are re-exports, so the
  75 + 17 consuming modules did not move.
- **#131** — 118 files migrated from `next-intl` to `use-intl` (framework-agnostic core, same
  API).
- **#133** — `src/lib/navigation.jsx` abstracts `useRouter/usePathname/useSearchParams/Link/Image`.
  The context carries **hook implementations, not their values** (otherwise `useSearchParams`
  would push a Suspense boundary up to the layout). `src/lib/NextNavigationProvider.jsx`,
  mounted in `src/app/layout.jsx`, is the only place still importing
  `next/navigation|link|image`.

Measured result: components usable outside Next went from **25% to 100%** (227/227).

**The SDK is published.** `@apowerb/apowerb-sdk` ships from `.github/workflows/npm-publish.yml`
through npm trusted publishing (OIDC), with a provenance attestation and no long-lived token.
One npm quirk to know: unlike PyPI, npm refuses to configure a trusted publisher for a package
that does not exist yet, so the very first publish had to come from a token.

**Still open**: the 227 components are decoupled but **not extracted** into a package. Two
known blockers: (a) distributing the Tailwind v4 styles (`globals.css` is 1717 lines with a
`@theme`), (b) the exported surface — exposing everything would freeze business components
into a public API.

What does not exist: `Dockerfile`, `docker-compose`, Helm chart, self-host documentation.

## 4. Rules for any session working here

1. **This repository is public, and so is its history.** Removing a file from the tip does not
   remove it from the history, and a force-push does not purge it from GitHub. Nothing
   customer-specific — names, domains, deployment topology — goes in, at any point.
2. **Decouple from Next.js** everything that will enter the component package. The pattern is
   set by #133: go through `src/lib/navigation.jsx`, never re-import `next/navigation`,
   `next/link` or `next/image` anywhere other than `NextNavigationProvider.jsx`. Same for
   i18n: `use-intl`, not `next-intl`. ⚠️ New code keeps reintroducing the old pattern
   (`QuotaMeter` imported `next-intl` the day after the migration) — check after every merge
   of `main`.
3. **The tests mock i18n and navigation**: they prove nothing about the real wiring. Verify at
   runtime in the browser. The signature proving Next really goes through the context: images
   come out as `/_next/image?url=...` with a `srcset` (otherwise it fell back to `<img>`).
4. **No customer-specific hard-coded value** in the core: the business logic lives in the
   template and the database.
5. `next dev` does not compile Tailwind CSS the way the build does — check the real rendering
   before concluding that a style is broken.
6. **Publishing goes through a GitHub release.** The workflow derives the version from the
   tag, refuses to ship if tests end up inside the tarball, and attaches provenance. Do not
   publish by hand.

## 5. Ecosystem

The matching backend is `apowerb/apowerb` (public, on PyPI), with the commercial bricks and
the deployment IaC in `thaink2/apowerb` — see its `CLAUDE.md` for the quota, Stripe billing
and packaging state. Open source scope: `apowerb`, `apowerb-ui`, `th2etl`, `th2pulse`,
`th2rag`.
