import { defineConfig, devices } from "@playwright/test";

/**
 * Variables de entorno requeridas para los tests E2E:
 *   TEST_BASE_URL      - URL del backoffice (default: http://localhost:3000)
 *   TEST_ADMIN_EMAIL   - Email de un usuario admin en Supabase
 *   TEST_ADMIN_PASSWORD - Contraseña del usuario admin
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? "github"
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],

  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,   // si ya está corriendo lo reutiliza, si no lo levanta
    timeout: 120_000,
  },
});
