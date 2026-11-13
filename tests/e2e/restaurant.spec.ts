import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url = process.env.API_URL!;
const db = createClient(url, process.env.SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = randomUUID().slice(0, 8);
const password = 'E2E-' + randomUUID();
const email = 'admin-e2e-' + tag + '@example.com';
const name = 'Hamburguesa E2E ' + tag;
const table = 'kv_store_71783a73';

test.beforeAll(async () => {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  const result = await db.from(table).insert([
    { key: 'user_profile:' + id, value: { id, email, name: 'QA Admin', role: 'administrador', active: true } },
    { key: 'user_by_email:' + email, value: id }
  ]);
  if (result.error) throw result.error;
});
test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', route => route.abort());
});
async function signIn(page, mail, heading) {
  await page.goto('/');
  await page.locator('#login-email').fill(mail);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}
test('invalid login on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill('incorrect-test-value');
  await page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click();
  await expect(page.getByText(/Credenciales inválidas/)).toBeVisible();
});
test('administrator creates inventory item and verifies persistence', async ({ page }) => {
  await signIn(page, email, 'Panel de Administración');
  await page.getByRole('button', { name: 'Inventario', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar Producto' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#name').fill(name);
  await dialog.locator('#price').fill('25000');
  await dialog.locator('#stock').fill('30');
  await dialog.locator('#minStock').fill('5');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible();
  const { data, error } = await db.from(table).select('value').like('key', 'product:%');
  if (error) throw error;
  expect(data.some(row => row.value.name === name && row.value.stock === 30)).toBeTruthy();
  await page.getByRole('button', { name: 'Reportes y Análisis', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reportes y Análisis', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).click();
  await expect(page.locator('#login-email')).toBeVisible();
});
