/**
 * Tests E2E para las páginas principales del backoffice.
 * Usan el storageState del admin (generado en global.setup.ts).
 */
import { test, expect } from "@playwright/test";

test.describe("Dashboard (Overview)", () => {
  test("carga el overview con KPIs", async ({ page }) => {
    await page.goto("/backoffice");
    await expect(page).not.toHaveURL(/\/login/);

    // Encabezado principal
    await expect(
      page.locator("main").getByRole("heading", { name: "Overview", level: 2 })
    ).toBeVisible();

    // KPI cards
    await expect(page.getByText("Total eventos")).toBeVisible();
    await expect(page.getByText("Eventos activos")).toBeVisible();
    await expect(page.getByText("Sin géneros")).toBeVisible();
    await expect(page.getByText("Con cover")).toBeVisible();
  });

  test("muestra las secciones de sincronizaciones e issues", async ({
    page,
  }) => {
    await page.goto("/backoffice");
    await expect(page.getByText("Últimas sincronizaciones")).toBeVisible();
    await expect(page.getByText("Issues de calidad abiertos")).toBeVisible();
  });
});

test.describe("Eventos", () => {
  test("carga la página de eventos", async ({ page }) => {
    await page.goto("/backoffice/events");
    await expect(page).not.toHaveURL(/\/login/);
    // La tabla de eventos debe existir (role=table o un heading que la identifique)
    await expect(page.locator("table, [role='table']").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Usuarios", () => {
  test("carga la página de usuarios admin", async ({ page }) => {
    await page.goto("/backoffice/users");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("table, [role='table']").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Navegación de sidebar", () => {
  test("todos los ítems del sidebar son accesibles", async ({ page }) => {
    await page.goto("/backoffice");

    const routes = [
      { href: "/backoffice/events", label: /eventos/i },
      { href: "/backoffice/users", label: /usuarios/i },
      { href: "/backoffice/sync", label: /sync/i },
      { href: "/backoffice/quality", label: /calidad/i },
    ];

    for (const route of routes) {
      await page.goto(route.href);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page).toHaveURL(route.href);
    }
  });
});

test.describe("Protección de rutas", () => {
  test("/ redirige al backoffice cuando hay sesión activa", async ({
    page,
  }) => {
    await page.goto("/");
    // Con sesión activa, la raíz debe llevar al backoffice o directamente cargar contenido protegido
    await expect(page).not.toHaveURL(/\/login/);
  });
});
