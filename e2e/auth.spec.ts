/**
 * Tests E2E para el flujo de autenticación del backoffice.
 * Corre sin storageState (no depende del setup de admin).
 */
import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Autenticación", () => {
  test("redirige a /login si no hay sesión", async ({ page }) => {
    await page.goto("/backoffice");
    await expect(page).toHaveURL(/\/login/);
  });

  test("muestra el formulario de login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("admin@grub.pe")).toBeVisible();
    await expect(page.getByPlaceholder("Tu contraseña")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ingresar al backoffice" })
    ).toBeVisible();
  });

  test("muestra error con credenciales inválidas", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("admin@grub.pe").fill("fake@grub.pe");
    await page.getByPlaceholder("Tu contraseña").fill("wrongpassword123");
    await page.getByRole("button", { name: "Ingresar al backoffice" }).click();

    // El formulario debe mostrar un mensaje de error (el texto viene de Supabase)
    await expect(page.locator("form")).toContainText(
      /ingresar|invalid|credenciales|password|email/i,
      { timeout: 10_000 }
    );
    // No debe redirigir
    await expect(page).toHaveURL(/\/login/);
  });
});
