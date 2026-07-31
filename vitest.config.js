import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    include: [
      "src/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "packages/*/src/**/*.{test,spec}.{js,jsx,ts,tsx}",
      // Les briques commerciales portent leurs propres tests. Sans cette
      // ligne, deplacer un composant dans extensions/ ferait disparaitre sa
      // couverture en silence — la suite resterait verte en testant moins.
      // Dans le depot public, extensions/ n'existe pas : le motif ne matche
      // rien et c'est sans effet.
      "extensions/*/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
