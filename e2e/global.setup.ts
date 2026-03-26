/**
 * Setup global: inicia sesión una vez y guarda el estado de autenticación.
 * Se ejecuta antes de todos los tests (proyecto "setup" en playwright.config.ts).
 *
 * Requiere:
 *   TEST_ADMIN_EMAIL    - email del admin en Supabase
 *   TEST_ADMIN_PASSWORD - contraseña del admin
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";

const AUTH_FILE = path.join(__dirname, ".auth/admin.json");

setup("autenticar admin", async ({ page }) => {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Falta TEST_ADMIN_EMAIL o TEST_ADMIN_PASSWORD en el entorno. " +
        "Crea un archivo .env.test con esas variables."
    );
  }

  await page.goto("/login");
  await page.getByPlaceholder("admin@grub.pe").fill(email);
  await page.getByPlaceholder("Tu contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar al backoffice" }).click();

  // Espera redirección tras login exitoso
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: AUTH_FILE });
});
