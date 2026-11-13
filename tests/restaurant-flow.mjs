import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.API_URL;
const anon = process.env.ANON_KEY;
const service = process.env.SERVICE_ROLE_KEY;
if (!url || new URL(url).hostname !== "127.0.0.1" || !anon || !service) {
  throw new Error("QA only runs against a local Supabase instance with local keys");
}
const base = url + "/functions/v1/make-server-71783a73";
const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const password = "QA-" + randomUUID();
const tag = randomUUID().slice(0, 8);
const table = "kv_store_71783a73";
let failures = 0;

async function request(path, { method = "GET", token = anon, body, expected = 200 } = {}) {
  const response = await fetch(base + path, {
    method, headers: { Authorization: "Bearer " + token, apikey: anon, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000)
  });
  const raw = await response.text();
  assert.equal(response.status, expected, method + " " + path + ": " + raw.slice(0, 300));
  return JSON.parse(raw);
}
async function login(email) {
  const result = await request("/auth/login", { method: "POST", body: { email, password } });
  assert.ok(result.accessToken);
  return result;
}
async function test(name, fn) {
  try { await fn(); console.log("PASS " + name); }
  catch (error) { failures++; console.error("FAIL " + name + ": " + error.message); }
}
async function staff(admin, role) {
  const email = role + "-" + tag + "@example.com";
  await request("/auth/signup", { method: "POST", token: admin.accessToken, body: { email, password, name: "QA " + role, role } });
  const session = await login(email);
  assert.equal(session.user.role, role);
  return session;
}

// Bootstrap an administrator only inside the disposable local database.
const email = "admin-" + tag + "@example.com";
const { data: created, error: createError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (createError) throw createError;
const id = created.user.id;
const { error: seedError } = await db.from(table).insert([
  { key: "user_profile:" + id, value: { id, email, name: "QA Admin", role: "administrador", active: true } },
  { key: "user_by_email:" + email, value: id },
  { key: "table:qa", value: { id: "table:qa", number: "1", capacity: 4, status: "disponible" } }
]);
if (seedError) throw seedError;

let admin, waiter, cook, cashier, customer, product, order;
await test("Health and authentication", async () => {
  const h = await request("/health");
  assert.equal(h.database, "connected");
  await request("/users", { expected: 401 });
  await request("/auth/login", { method: "POST", body: { email, password: "wrong" }, expected: 401 });
  admin = await login(email);
  assert.equal(admin.user.role, "administrador");
});
await test("Admin creates staff; public registration cannot create admin", async () => {
  await request("/auth/signup", { method: "POST", body: { email: "blocked-" + tag + "@example.com", password, name: "Blocked", role: "administrador" }, expected: 403 });
  waiter = await staff(admin, "mesero");
  cook = await staff(admin, "cocinero");
  cashier = await staff(admin, "cajero");
  const customerEmail = "customer-" + tag + "@example.com";
  await request("/auth/signup", { method: "POST", body: { email: customerEmail, password, name: "QA Client", role: "cliente" } });
  customer = await login(customerEmail);
  assert.equal(customer.user.role, "cliente");
});
await test("Inventory CRUD and permissions", async () => {
  const r = await request("/products", { method: "POST", token: admin.accessToken, body: { name: "QA Burger", category: "Platos Fuertes", price: 25000, stock: 30, minStock: 5 } });
  product = r.product;
  assert.ok(product.id.startsWith("product:"));
  await request("/products/" + product.id, { method: "PUT", token: admin.accessToken, body: { stock: 29 } });
  const list = await request("/products", { token: waiter.accessToken });
  assert.equal(list.products.find(p => p.id === product.id).stock, 29);
  await request("/products/" + product.id, { method: "DELETE", token: waiter.accessToken, expected: 403 });
  const disposable = (await request("/products", { method: "POST", token: admin.accessToken, body: { name: "QA Delete", price: 1000, stock: 1 } })).product;
  await request("/products/" + disposable.id, { method: "DELETE", token: admin.accessToken });
  assert.ok(!(await request("/products", { token: admin.accessToken })).products.some(p => p.id === disposable.id));
});
await test("Waiter creates order; customer cannot see another customer's order", async () => {
  const tables = await request("/tables", { token: waiter.accessToken });
  assert.ok(tables.tables.some(t => t.id === "table:qa"));
  order = (await request("/orders", { method: "POST", token: waiter.accessToken, body: { tableId: "table:qa", tableNumber: "1", items: [{ productId: product.id, name: product.name, quantity: 1, price: 25000 }], total: 25000, status: "pending" } })).order;
  assert.equal(order.createdBy, waiter.user.id);
  assert.equal(order.status, "pending");
  assert.equal(order.subtotal, 25000);
  assert.equal((await request("/products", { token: admin.accessToken })).products.find(p => p.id === product.id).stock, 28);
  assert.equal((await request("/tables", { token: waiter.accessToken })).tables.find(t => t.id === "table:qa").status, "ocupada");
  assert.ok(!(await request("/orders", { token: customer.accessToken })).orders.some(o => o.id === order.id));
  await request("/orders/" + order.id, { method: "PUT", token: customer.accessToken, body: { status: "paid" }, expected: 403 });
});
await test("Reject invalid stock and illegal transitions", async () => {
  await request("/orders", { method: "POST", token: waiter.accessToken, body: { tableId: "table:qa", items: [{ productId: product.id, quantity: 9999 }] }, expected: 409 });
  await request("/orders/" + order.id, { method: "PUT", token: waiter.accessToken, body: { status: "paid" }, expected: 409 });
  await request("/payments", { method: "POST", token: cashier.accessToken, body: { orderId: order.id, paymentMethod: "efectivo", receivedAmount: 50000 }, expected: 409 });
  assert.equal((await request("/products", { token: admin.accessToken })).products.find(p => p.id === product.id).stock, 28);
});
await test("Kitchen sees order and marks it preparing and ready", async () => {
  assert.ok((await request("/orders", { token: cook.accessToken })).orders.some(o => o.id === order.id));
  await request("/orders/" + order.id, { method: "PUT", token: cook.accessToken, body: { status: "preparing" } });
  const r = await request("/orders/" + order.id, { method: "PUT", token: cook.accessToken, body: { status: "ready" } });
  assert.equal(r.order.status, "ready");
  const alerts = await request("/alerts", { token: admin.accessToken });
  assert.ok(alerts.alerts.some(a => a.orderId === order.id && a.type === "order_ready"));
  await request("/orders/" + order.id, { method: "PUT", token: waiter.accessToken, body: { status: "served" } });
});
await test("Cashier collects payment; order and closing reconcile", async () => {
  await request("/payments", { method: "POST", token: waiter.accessToken, body: { orderId: order.id, total: 25000, paymentMethod: "efectivo", receivedAmount: 50000 }, expected: 403 });
  const r = await request("/payments", { method: "POST", token: cashier.accessToken, body: { orderId: order.id, total: 25000, paymentMethod: "efectivo", receivedAmount: 50000 } });
  assert.equal(r.payment.status, "completed");
  assert.equal((await request("/orders", { token: admin.accessToken })).orders.find(o => o.id === order.id).status, "paid");
  const payments = await request("/payments", { token: admin.accessToken });
  assert.equal(payments.payments.filter(p => p.orderId === order.id).length, 1);
  assert.equal(r.payment.total, 32250);
  await request("/payments", { method: "POST", token: cashier.accessToken, body: { orderId: order.id, paymentMethod: "efectivo", receivedAmount: 50000 }, expected: 409 });
  assert.equal((await request("/tables", { token: admin.accessToken })).tables.find(t => t.id === "table:qa").status, "disponible");
  const closing = await request("/cash-closing", { method: "POST", token: cashier.accessToken, body: {} });
  assert.equal(closing.report.totalSales, 32250);
  assert.equal(closing.report.totalCash, 32250);
  assert.equal(closing.report.totalTransactions, 1);
});
await test("Concurrent orders cannot oversell; concurrent payments cannot duplicate", async () => {
  const raceProduct = (await request("/products", { method: "POST", token: admin.accessToken, body: { name: "QA Last Stock", category: "Platos Fuertes", price: 10000, stock: 1, minStock: 0 } })).product;
  async function race(path, token, body) {
    const response = await fetch(base + path, { method: "POST", headers: { Authorization: "Bearer " + token, apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    return { status: response.status, body: await response.json() };
  }
  const orderPayload = { tableId: "table:qa", items: [{ productId: raceProduct.id, quantity: 1 }] };
  const results = await Promise.all([race("/orders", waiter.accessToken, orderPayload), race("/orders", waiter.accessToken, orderPayload)]);
  assert.deepEqual(results.map(r => r.status).sort((a,b)=>a-b), [200,409]);
  const winner = results.find(r => r.status === 200).body.order;
  assert.equal((await request("/products", { token: admin.accessToken })).products.find(p => p.id === raceProduct.id).stock, 0);
  await request("/orders/" + winner.id, { method: "PUT", token: cook.accessToken, body: { status: "preparing" } });
  await request("/orders/" + winner.id, { method: "PUT", token: cook.accessToken, body: { status: "ready" } });
  const paymentPayload = { orderId: winner.id, paymentMethod: "tarjeta", tip: 0 };
  const paid = await Promise.all([race("/payments", cashier.accessToken, paymentPayload), race("/payments", cashier.accessToken, paymentPayload)]);
  assert.deepEqual(paid.map(r => r.status).sort((a,b)=>a-b), [200,409]);
  assert.equal(paid.find(r => r.status === 200).body.payment.total, 12900);
  const payments = await request("/payments", { token: admin.accessToken });
  assert.equal(payments.payments.filter(p => p.orderId === winner.id).length, 1);
  assert.equal((await request("/tables", { token: admin.accessToken })).tables.find(t => t.id === "table:qa").status, "disponible");
});
await test("Deactivated staff cannot log in or use prior token", async () => {
  await request("/users/" + waiter.user.id, { method: "PUT", token: admin.accessToken, body: { active: false } });
  await request("/orders", { token: waiter.accessToken, expected: 403 });
  await request("/auth/login", { method: "POST", body: { email: waiter.user.email, password }, expected: 403 });
});
console.log("QA failures: " + failures);
process.exitCode = failures ? 1 : 0;
