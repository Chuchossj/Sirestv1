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

test('staff roles navigate and complete a restaurant order', async ({ page }) => {
  test.setTimeout(150000);
  const tableId = 'table:e2e-' + tag;
  const menuName = 'QA Menu ' + tag;
  const menuId = 'product:e2e-' + tag;
  const { error } = await db.from(table).insert([
    { key: tableId, value: { id: tableId, number: '88', capacity: 4, status: 'disponible' } },
    { key: menuId, value: { id: menuId, name: menuName, category: 'Platos Fuertes', price: 25000, stock: 30, minStock: 5, image: '' } }
  ]);
  if (error) throw error;
  const roles = ['mesero', 'cocinero', 'cajero', 'cliente'];
  const roleEmail = role => role + '-e2e-' + tag + '@example.com';
  const logout = async () => {
    await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).click();
    await expect(page.locator('#login-email')).toBeVisible();
  };
  await signIn(page, email, 'Panel de Administración');
  await page.getByRole('button', { name: 'Gestión de Usuarios', exact: true }).click();
  for (const role of roles) {
    await page.getByRole('button', { name: 'Nuevo Usuario' }).click();
    const d = page.getByRole('dialog');
    await d.locator('#name').fill('QA ' + role);
    await d.locator('#email').fill(roleEmail(role));
    await d.locator('#password').fill(password);
    await d.locator('#role').selectOption(role);
    await d.getByRole('button', { name: 'Crear Usuario', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: roleEmail(role) })).toBeVisible();
  }
  await logout();
  await signIn(page, roleEmail('mesero'), 'Panel de Mesero');
  await expect(page.getByRole('button', { name: 'Gestión de Usuarios', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Mis Mesas' }).click();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const tabsFit = await page.locator('.sirest-role-tabs').evaluate(list => {
      const bounds = list.getBoundingClientRect();
      return Array.from(list.querySelectorAll('[role=tab]')).every(tab => {
        const r = tab.getBoundingClientRect();
        return r.left >= bounds.left - 1 && r.right <= bounds.right + 1 && r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1;
      });
    });
    expect(tabsFit).toBeTruthy();
  }
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.getByText('#88', { exact: true }).click();
  await page.getByRole('tab', { name: 'Nuevo Pedido' }).click();
  await page.getByPlaceholder('Buscar platos en el menú...').fill(menuName);
  const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: menuName, exact: true }) });
  await card.getByRole('button', { name: 'Agregar', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar a Cocina' }).click();
  await expect(page.getByText(/Pedido enviado a cocina/)).toBeVisible();
  await logout();
  await signIn(page, roleEmail('cocinero'), 'Panel de Cocina');
  await page.getByRole('button', { name: 'Iniciar Preparación' }).click();
  await page.getByRole('button', { name: 'Marcar Listo' }).click();
  await page.getByRole('tab', { name: 'Listas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mesa #88', exact: true })).toBeVisible();
  await logout();
  await signIn(page, roleEmail('mesero'), 'Panel de Mesero');
  await page.getByRole('tab', { name: /Pedidos Listos/ }).click();
  await page.getByRole('button', { name: 'Marcar como Servido' }).click();
  await expect(page.getByRole('button', { name: 'Marcar como Servido' })).toHaveCount(0);
  await logout();
  await signIn(page, roleEmail('cajero'), 'Panel de Caja');
  await page.getByRole('heading', { name: 'Mesa #88', exact: true }).click();
  await page.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await page.locator('#received').fill('50000');
  await page.getByRole('button', { name: /Procesar Pago -/ }).click();
  await expect(page.getByRole('dialog').getByText(/Pago Procesado/)).toBeVisible();
  const { data: orders, error: orderError } = await db.from(table).select('value').like('key', 'order:%');
  if (orderError) throw orderError;
  expect(orders.find(o => o.value.tableId === tableId)?.value.status).toBe('paid');
  await page.evaluate(() => { window.print = () => { (window as any).__receiptText = document.getElementById('sirest-print-receipt')?.textContent; }; });
  await page.getByRole('dialog').getByRole('button', { name: 'Imprimir', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__receiptText)).toContain('Método: efectivo');
  expect(await page.evaluate(() => (window as any).__receiptText)).toContain(menuName);
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  // A second confirmed order exercises the card receipt and historical reprint.
  const cardOrderId = 'order:card-e2e-' + tag;
  const cardFixture = await db.from(table).insert({
    key: cardOrderId,
    value: { id: cardOrderId, tableId, tableNumber: '88', status: 'served', createdBy: 'qa', createdAt: new Date().toISOString(), subtotal: 25000, total: 25000, items: [{ productId: menuId, name: menuName, quantity: 1, price: 25000 }] }
  });
  if (cardFixture.error) throw cardFixture.error;
  await page.getByRole('heading', { name: 'Mesa #88', exact: true }).click();
  await page.getByRole('button', { name: 'Tarjeta', exact: true }).click();
  await page.getByRole('button', { name: /Procesar Pago -/ }).click();
  await expect(page.getByRole('dialog').getByText(/Pago Procesado/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Imprimir', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__receiptText)).toContain('Método: tarjeta');
  expect(await page.evaluate(() => (window as any).__receiptText)).toContain(menuName);
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  const cardPayments = await db.from(table).select('value').like('key', 'payment:%');
  if (cardPayments.error) throw cardPayments.error;
  expect(cardPayments.data.filter(row => row.value.orderId === cardOrderId)).toHaveLength(1);
  await logout();
  await page.goto('/');
  await page.locator('#login-email').fill(roleEmail('cliente'));
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click();
  await expect(page.getByText('Portal del Cliente', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gestión de Usuarios', exact: true })).toHaveCount(0);
});

test('mobile navigation opens and closes without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, email, 'Panel de Administración');
  const fits = async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(await fits()).toBeTruthy();
  await page.getByRole('button', { name: 'Abrir o cerrar menú' }).click();
  await page.getByRole('button', { name: 'Inventario', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gestión de Inventario', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inventario', exact: true })).toHaveCount(0);
  expect(await fits()).toBeTruthy();
});
