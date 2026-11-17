---
name: verify
description: Start apowerb-ui (Next.js front end) locally against the mock backend and exercise its real flows to prove a change works, before any commit, push or PR. Use after every code change in this repository, and whenever asked to "verify", "test it for real" or "check that it works".
---

# Verify apowerb-ui for real

This skill is the repository's smoke-test harness. Keep it fast and reliable: if it is broken or
slow, fix it before relying on it. A code change never edits this file in the same commit to make
itself pass: updating the skill is a separate commit.

## Target

- Repository: the root of this clone. Do not run the harness in a clone another task is using.
- Environment: **local only**, against the mock backend `tests/mock-backend/server.mjs` (no
  database, no LLM, no credentials). Never production, staging or a real backend. No secret
  needed: the mock accepts any token.
- Prerequisites: Node 22, `npm ci` done (`node_modules/` is missing on a fresh clone, ~3.5 min under
  load), ports **3100** (front end) and **8100** (mock) free: `ss -ltnp | grep -E ':(3100|8100) '`.
  Another task may use other ports: leave them alone.
- On a loaded 8 GB machine: run one thing at a time, never two heavy commands (full vitest, lint,
  next dev, Chrome) in parallel.

## 1. Cheap checks first (cheapest to most expensive)

```bash
cd <repository root>
npm run lint:no-undef                                   # ~10 s; this is the CI guard
git diff --name-only -- src | xargs -r npx eslint       # lint only the changed files
npx vitest related --run --maxWorkers=2 $(git diff --name-only -- src)   # affected tests
# or a single file: npx vitest run --maxWorkers=1 src/__tests__/<file>.test.jsx
```

- `npm run lint` over the whole repository is not a criterion: `main` already has 66 errors and
  30 warnings (measured on 2026-11-17, ~2 min). Compare only the touched files.
- A full `npx vitest run` (247 files) did not finish in 10 min on a loaded 8 GB machine: leave it to
  CI unless asked.
- A failure here stops everything: no point starting the application.

## 2. Start the application

Same command as `playwright.mock.config.js`. Use `localhost`, not `127.0.0.1` (Next 16 blocks its
own chunks otherwise: blank page without JavaScript).

```bash
cd <repository root>
D=$(mktemp -d /tmp/verify-apowerb-ui-XXXXXX); echo "$D" > /tmp/verify-apowerb-ui.dir
nohup node tests/mock-backend/server.mjs 8100 > "$D/mock.log" 2>&1 & echo $! > "$D/mock.pid"
API_URL=http://localhost:8100 NEXT_PUBLIC_API_URL=http://localhost:8100 NEXT_TELEMETRY_DISABLED=1 \
  nohup npx next dev -p 3100 > "$D/next.log" 2>&1 & echo $! > "$D/next.pid"
for i in $(seq 1 60); do [ "$(curl -s -m 100 -o /dev/null -w '%{http_code}' localhost:3100/login)" = 200 ] && break; sleep 3; done
curl -s -o /dev/null -w '%{http_code}\n' localhost:8100/api/agents      # 200 expected
```

- Ready when `/login` returns 200 and `GET :8100/api/agents` returns 200 (measured: `/login` in
  ~2 s, but the **first** visit of each route compiles it: `/agents` > 15 s, `/chat` several tens
  of seconds under load).
- The first `npx next dev` may exit immediately after printing a "strongly recommend you upgrade
  Next.js" notice (an upgrade nudge, exit 1, nothing listening on 3100). Do not run the suggested
  upgrade: just launch the same command again (verified 2026-11-17: second launch starts normally).
  Check `$D/next.log` if `/login` never answers.
- `next dev` creates an untracked `AGENTS.md` at the repository root: delete it when stopping.
- Record the PIDs (`$D/*.pid`) for shutdown.

## 3. Flows to exercise

Session: no login form. Reset the mock (`POST :8100/api/__reset`, its state lives in memory),
then set in the `localStorage` of `http://localhost:3100` the keys `th2_auth_token` =
`mock_token_e2e` and `th2_auth_user` = the demo user (see `DEMO_USER` in
`tests/e2e-mock/session.js`).

Tool: `dev-browser`, page named "verify-apowerb-ui". Nominal path: `--connect <port>` to the
shared, already running Chrome (verified 2026-11-17: works for every flow below; the page opens in
the existing browser). Always use `-t 150` and `goto(..., {timeout: 120000})` for a route's first
compilation. Write the script to `$D/*.js` and run it with
`dev-browser --connect <port> -t 150 run $D/j.js`.
**Pitfall**: on a saturated machine that Chrome can be killed by the OOM killer (the service ends
as `failed (oom-kill)` and the debugging port goes silent). On 2026-11-17 this happened while a
Playwright spec ran next to the shared Chrome (about 200 MB available): never run Playwright while
the shared Chrome is open on a small machine. Fallback when Chrome is gone or too heavy:
`dev-browser --headless -b verify-apowerb-ui` (clean, lighter profile), stopped afterwards with
`dev-browser stop verify-apowerb-ui`. Do not start a different browser behind the owner's back.

Scripting notes for `dev-browser run` (sandboxed script, not Node): `process` is not defined
(substitute the screenshot directory into the script text, e.g. with `sed`), `fetch` is available
(`await fetch("http://localhost:8100/api/__reset", {method: "POST"})` replaces the reset call),
`page.waitForLoadState` does not exist (poll with `page.waitForSelector` or a `setTimeout` loop),
`page.type(selector, text)` + `page.keyboard.press("Enter")` work for the chat box. For form fields
use the native value setter plus `input`/`change` events inside `page.evaluate`. A `goto` of a route
never compiled before can raise `Page.navigate timed out` under load: warm it with
`curl -s -m 280 localhost:3100/<route>` and rerun.

| Flow | Steps | Expected result |
|---|---|---|
| Session + agent list | reset, `localStorage` set, `goto /agents`, wait for `.w-80 .rounded-2xl.border` | 5 cards: Analyste, Rédacteur, Support Outillé, Chaîne Qualité, Brouillon (name: `.th-text.text-sm.font-bold`); sidebar visible, no red error screen |
| Agent creation | panel `New` button (`.w-80 button`, rendered "NEW" by CSS) → in `[role=dialog]` "From Scratch" → name (1st `input`), `select` = Base, `input[placeholder="provider/model-name"]` = `mock/instant`, 2 `textarea` (description, instruction) → "Create Agent" | 6 cards, the last one = the entered name; body text without "Something went wrong / Application error / Unhandled Runtime Error" |
| Chat with tools | `goto /chat`, "Choose an agent / All agents" button → "Support Outillé" → type in the `textarea` "Montre-moi les ventes avec les outils" + Enter | "Reasoning trail" region then "Reasoned for … · 2 tools · 1 error", `figure[data-chart='bar']` (Juil., Août, Sept.), answer "Septembre dépasse…", conversation listed on the left |
| Marketplace | `goto /marketplace`; click the "Clone" button found by text | heading "Marketplace", 2 cards ("Analyste de ventes", "Rédacteur d'offres", tags BASE/YOURS, 12 and 3 clones); "Clone" opens a dialog (tabs Clone / API Key / Done) with the name prefilled `analyste_ventes_clone`. Clone submission itself: not exercised |
| Tool box | `goto /tool-box` | "Tool Box & MCP", tabs Available tools (4) / My configurations (1) / MCP servers / Skills (1) / Help, cards Database (2 tools, 1 configured), Email, Web |
| Orchestrator | `goto /orchestrator`, wait: first visit shows a spinner for a while (first compile) | after the spinner: pipeline runs page, 5 agents table (Analyste, Brouillon, Chaîne Qualité, Rédacteur, Support Outillé) with "Run Now" / "Schedule", counters (1 active schedule) |
| Webhooks | `goto /webhooks`; "New Subscription"; "Activity" tab | 0 subscriptions empty state; the form opens inline (Provider = Microsoft Outlook, Resource = Inbox, change types, agent to trigger, message template). Activity tab: **"Could not load activity ... mock: no route for GET /api/webhooks/logs"** (the mock has no such route; the Playwright spec `webhooks-activity` stubs it) |
| Workflows | `goto /workflows` | page renders (heading + "Preview" badge, "New workflow") but with the **error banners** "mock: no route for GET /api/workflows/defs" and "/api/workflows/runs/awaiting": the mock does not serve workflows; the spec `workflows-decision-link` stubs these routes with `page.route`. Use the spec to exercise workflows |
| BI | `goto /bi` | "BI & Reporting", counters 1 dashboard / 0 BI charts, card "Ventes 2026" (Draft, 0 charts), buttons Data Pool / From a template / New Dashboard |

Mock chat keywords: `vide`, `partiel` (long, to test Stop), `erreur`, `outils`, `graph`, `lent`;
any other text returns a short markdown answer.

Existing Playwright suite (15 specs in `tests/e2e-mock/`: agents, chat, marketplace, toolbox,
schedule, webhooks, dashboards, workflows):

```bash
cd <repository root>
E2E_SHOTS_DIR="$D/shots" npx playwright test -c playwright.mock.config.js <spec-file>   # reuses 3100/8100 if running
```

The Playwright browser must match the `@playwright/test` version (1.62.1 →
`chromium_headless_shell-1234`): on "Executable doesn't exist", run
`npx playwright install chromium-headless-shell` (once). Run **one spec at a time**, and only when
the machine has free memory (`free -m`): under heavy load, `goto` calls time out and the browser
"crashes" (see Pitfalls).

## 4. Evidence

- Keep screenshots (`page.screenshot({path: "$D/NN-name.png"})`) and outputs in `$D`, and state in
  the report what was seen, flow by flow (card names, reasoning-trail text, chart type).
- A flow that was not exercised is "not verified", never "ok". A 404 on
  `/api/config/default-llm/usage` or `/api/emailing/microsoft/status` in the console is normal
  with the mock.

## 5. Stop and clean up

```bash
D=$(cat /tmp/verify-apowerb-ui.dir)
kill $(cat "$D/next.pid") $(cat "$D/mock.pid")           # then check below
dev-browser stop verify-apowerb-ui                        # if the headless fallback was used
rm -f AGENTS.md                 # from the repository root; generated by next dev (check git status)
rm -rf tests/e2e-mock/.results "$D" /tmp/verify-apowerb-ui.dir
ss -ltnp | grep -E ':(3100|8100) '; pgrep -af 'next dev -p 3100'   # must be empty
```

Killing the `npx` PID can leave the `next-server` child behind: if so, kill it by its exact PID
(`ss -ltnp` shows the PID on port 3100), never with `pkill -f` on a pattern.
`git status` must show no tracked file modified by the harness.

## Rules

- At most three fix attempts on the same failure, then stop and report to whoever assigned the
  task, with the exact output.
- Flaky test: no retry loop, no `sleep`, no `skip`. Find the cause; otherwise report what was
  observed.
- Known pitfalls in this repository:
  - Saturated machine (8 GB, load 15–35): Chrome killed for lack of memory (`oom-kill`),
    `Page crashed`, `net::ERR_ABORTED`, Playwright `goto` timeouts. Not a code bug: free some
    memory, one heavy task at a time, `--headless` fallback.
  - `127.0.0.1` instead of `localhost`: page without JavaScript (see section 2).
  - `dev-browser`: `page.click(selector)` does not wait; `::-p-text` pseudo-selectors fail ("Node
    is either not clickable"). Click via `page.evaluate`, finding the button by
    `textContent.trim()`. The "NEW" button's text is "New" (uppercased by CSS).
  - A missed click leaves the page half-way: `page.reload()` before replaying.
  - The mock's state lives in memory: `POST /api/__reset` before each flow, otherwise the number of
    cards depends on history.
  - A red "1 Issue" badge in the bottom-left corner of a page is the Next dev overlay counting a
    console error (typically the mock's missing routes above), not a crash; the red full-screen
    error is what the flows look for.
  - `pgrep -af 'next dev -p 3100'` also matches the shell running it; trust `ss -ltnp` (3100/8100)
    and `ps -eo pid,args | grep next-server`, and only kill the PID you started.
  - `npx playwright install` downloads into `~/.cache/ms-playwright` (shared): additive only.

## Last successful run

2026-11-17 — Linux, 8 GB (about 100-700 MB available while running) — main `99b241c` — seen
working through `dev-browser --connect <port>` on the shared Chrome: agent list (5 cards),
agent creation (6th card "Agent verify", no error screen), chat "Support Outillé" (trail
"Reasoned for 4.9s", bar chart Juil./Août/Sept., answer "Septembre dépasse nettement l'objectif...",
a warning that the targets could not be loaded = the failing tool, conversation listed on the
left), marketplace (2 cards, clone dialog), tool box (4 tools, 3 categories), orchestrator (5-agent
table), webhooks (empty state, new-subscription form), BI (1 draft dashboard). Workflows load but
show the mock-has-no-route banners (see the table), and the webhooks Activity tab likewise.
Earlier the same day: `npm run lint:no-undef` (green), `vitest run --maxWorkers=1
src/__tests__/noCommercialScreens.test.js` (21/21), headless fallback for agent list/creation/chat.
**Not verified**: full vitest, clone submission, workflow editor and runs, webhook creation, BI
chart editing. Playwright `marketplace.spec.js` (run twice, 3 tests): 1 of 3 passed the first
time, 0 of 3 the second; every failure is the `Marketplace` heading not found within 5 s while the
screenshot shows the loading spinner (slow first render under memory pressure, not an assertion on
content). Shortly after, the shared Chrome was OOM-killed, so no other spec was attempted.
