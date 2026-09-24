import { test, expect } from "@playwright/test";
import { signIn, shot, assertNoErrorScreen } from "./session.js";

/**
 * Widget "Prévision" du dashboard builder — parcours réel au navigateur,
 * cœur simulé par des routes Playwright (le lot B n'existe pas encore
 * dans cet environnement). Couvre un rendu succès (bandes de confiance +
 * badge de fiabilité), une erreur 400 avec champ concerné, et un 503
 * "service non configuré".
 */

const DASHBOARD_ID = "forecast-dash-1";
const CHART_ID = "forecast-chart-1";

const HISTORY = [
  { date: "2024-01-01", value: 100 },
  { date: "2024-02-01", value: 108 },
  { date: "2024-03-01", value: 115 },
  { date: "2024-04-01", value: 120 },
  { date: "2024-05-01", value: 130 },
  { date: "2024-06-01", value: 128 },
];

const RAW_ROWS = HISTORY.map((h) => ({ date: h.date, sales: h.value }));

const SUCCESS_RESPONSE = {
  status: "success",
  api_version: "1",
  frequency: "month",
  duration_ms: 42,
  warnings: [],
  series: [
    {
      group: null,
      model: "prophet",
      history: HISTORY,
      forecast: [
        { date: "2024-07-01", value: 134, lower_80: 126, upper_80: 142, lower_95: 120, upper_95: 148 },
        { date: "2024-08-01", value: 138, lower_80: 128, upper_80: 148, lower_95: 121, upper_95: 155 },
        { date: "2024-09-01", value: 141, lower_80: 129, upper_80: 153, lower_95: 120, upper_95: 162 },
      ],
      metrics: { mape: 0.08, smape: 0.079, mase: 0.7, rmse: 11.2, holdout_points: 6 },
      baseline: { model: "snaive", metrics: { mape: 0.12, smape: 0.11, mase: 1.0, rmse: 15.0 } },
      beats_baseline: true,
      reliability: "good",
      warnings: [],
    },
  ],
};

const ERROR_400 = {
  status: "error",
  errors: [
    { field: "date_var", message: "Colonne 'dat' absente ; colonnes disponibles : date, sales" },
  ],
};

const ERROR_503 = {
  status: "error",
  errors: [{ field: null, message: "Service de prévision non configuré (TH2FORECAST_URL)" }],
};

function dashboardPayload() {
  return {
    id: DASHBOARD_ID,
    title: "Ventes — démo prévision",
    description: null,
    status: "published",
    agent_id: null,
    components: [
      {
        id: "comp-1",
        component_type: "chart",
        position: { col: 0, row: 0, width: 12, height: 7 },
        chart: { chart_id: CHART_ID, title_override: "Ventes mensuelles" },
      },
    ],
  };
}

function chartDataPayload() {
  return {
    id: CHART_ID,
    title: "Ventes mensuelles",
    chart_type: "forecast",
    rows: RAW_ROWS,
    config: {
      date_var: "date",
      target_var: "sales",
      group_var: null,
      horizon: 3,
      frequency: "month",
      models: ["prophet"],
      confidence_levels: [0.8, 0.95],
    },
    source: { source_type: "csv" },
  };
}

async function mockDashboardRoutes(page) {
  await page.route(`**/api/v1/dashboards/${DASHBOARD_ID}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dashboardPayload()) }),
  );
  await page.route(`**/api/v1/dashboards/${DASHBOARD_ID}/agent`, (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not found" }) }),
  );
  await page.route(`**/api/v1/charts/${CHART_ID}/data*`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(chartDataPayload()) }),
  );
}

test.describe("Forecast widget", () => {
  test("renders history + forecast, confidence bands and the reliability badge (light theme)", async ({ page }) => {
    await signIn(page, "/bi");
    await page.evaluate(() => localStorage.setItem("theme", "light"));
    await mockDashboardRoutes(page);
    await page.route("**/api/v1/forecast", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SUCCESS_RESPONSE) }),
    );

    await page.goto(`/bi/${DASHBOARD_ID}`);
    await assertNoErrorScreen(page, "au chargement du dashboard");

    await expect(page.getByText("Reliable").or(page.getByText("Fiable"))).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /export csv|exporter/i })).toBeVisible();
    // Légende du graphique : Réel / Prévision / Intervalle 80% / Intervalle 95%.
    await expect(page.getByText(/^(réel|actual)$/i)).toBeVisible();
    await expect(page.getByText(/^(prévision|forecast)$/i)).toBeVisible();
    await expect(page.getByText(/intervalle 80|80% interval/i)).toBeVisible();
    await expect(page.getByText(/intervalle 95|95% interval/i)).toBeVisible();

    await shot(page, "forecast-widget-success-light");
  });

  test("renders in dark theme with a visible split between history and forecast", async ({ page }) => {
    await signIn(page, "/bi");
    await mockDashboardRoutes(page);
    await page.route("**/api/v1/forecast", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SUCCESS_RESPONSE) }),
    );

    await page.goto(`/bi/${DASHBOARD_ID}`);
    await assertNoErrorScreen(page, "au chargement du dashboard (sombre)");
    await expect(page.getByText("Reliable").or(page.getByText("Fiable"))).toBeVisible({ timeout: 15_000 });

    await shot(page, "forecast-widget-success-dark");
  });

  test("shows an actionable error naming the field on a 400 from the core", async ({ page }) => {
    await signIn(page, "/bi");
    await mockDashboardRoutes(page);
    await page.route("**/api/v1/forecast", (route) =>
      route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify(ERROR_400) }),
    );

    await page.goto(`/bi/${DASHBOARD_ID}`);
    await assertNoErrorScreen(page, "sur erreur 400");
    await expect(
      page.getByText(/la prévision n'a pas pu être calculée|the forecast could not be computed/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/colonne 'dat' absente/i)).toBeVisible();
    // Champ traduit en libellé métier — jamais le nom technique brut du contrat.
    await expect(page.getByText(/colonne date|date column/i)).toBeVisible();
    await expect(page.getByText(/^date_var$/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /modifier la configuration|edit configuration/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /réessayer|retry/i })).toBeVisible();

    await shot(page, "forecast-widget-error-400");
  });

  test("shows a clear 'service not configured' message on a 503, centered with edit/retry actions", async ({ page }) => {
    await signIn(page, "/bi");
    await mockDashboardRoutes(page);
    await page.route("**/api/v1/forecast", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify(ERROR_503) }),
    );

    await page.goto(`/bi/${DASHBOARD_ID}`);
    await assertNoErrorScreen(page, "sur erreur 503");
    await expect(
      page.getByText(/la prévision n'a pas pu être calculée|the forecast could not be computed/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/service de prévision non configuré/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /modifier la configuration|edit configuration/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /réessayer|retry/i })).toBeVisible();

    await shot(page, "forecast-widget-error-503");
  });
});
