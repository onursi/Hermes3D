import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * `E2E_BASE_URL` runs the suite against a server that is already up.
 *
 * Without it the config starts its own `next dev` on port 3000, which fails
 * outright when another dev server holds the `.next/dev` lock — and one
 * usually does here. It also means the tests only ever see a development
 * build, while every performance number in this project is taken from the
 * production build on 3300. Those are different programs.
 *
 *   E2E_BASE_URL=http://localhost:3300 npx playwright test
 */
const externalBaseUrl = process.env.E2E_BASE_URL?.trim();

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: externalBaseUrl || "http://127.0.0.1:3000",
    /**
     * The installed Chrome, not Playwright's bundled Chromium.
     *
     * The bundled browser was never downloaded on this machine, so every spec
     * in this suite failed at launch — not on an assertion, at
     * `browserType.launch`. That is the quiet kind of broken: `npx playwright
     * test` printed failures nobody read as "the tests never ran".
     *
     * Using the real Chrome also means the 3D specs render on the actual Vega
     * 11 rather than on whatever fallback a fresh Chromium picks, which is the
     * difference between testing this machine and testing an idea of it.
     */
    channel: "chrome",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          HERMES_STATE_DIR: path.resolve("./tests/fixtures/gateway-empty-state"),
          NEXT_PUBLIC_GATEWAY_URL: "",
        },
      },
});
