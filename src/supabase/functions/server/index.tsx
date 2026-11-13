import { Hono } from "npm:hono@4.7.11";
import { cors } from "npm:hono@4.7.11/cors";
import { logger } from "npm:hono@4.7.11/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger(console.log));

// Crear cliente Supabase
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Función de utilidad para reintentos
async function retryOperation<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Intento ${i + 1} falló, reintentando en ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Backoff exponencial
    }
  }
  throw new Error("Todos los reintentos fallaron");
}

// ==================== INICIALIZACIÓN DEL SISTEMA ====================

// Endpoint para inicializar datos de prueba

// Authorization is enforced on the server, not just in the UI.
app.use("/make-server-71783a73/*", async (c, next) => {
  const path = decodeURIComponent(c.req.path.replace("/make-server-71783a73", ""));
  const method = c.req.method;
  if (method === "OPTIONS" || path === "/health" || path === "/auth/login" || path === "/auth/signup") return next();
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await kv.get("user_profile:" + data.user.id);
  if (!profile || profile.active === false) return c.json({ error: "Cuenta no autorizada" }, 403);
  const role = profile.role;
  const staff = ["administrador", "mesero", "cajero", "cocinero"];
  let allowed = false;
  if (["/auth/session", "/profile"].includes(path)) allowed = true;
  else if (path === "/configuration") allowed = method === "GET" || role === "administrador";
  else if (path === "/products" || path.startsWith("/products/")) allowed = method === "GET" || role === "administrador";
  else if (path === "/users" || path.startsWith("/users/")) allowed = role === "administrador" || (role === "cajero" && method === "GET");
  else if (path === "/staff-status") allowed = role === "administrador";
  else if (path === "/tables" || path.startsWith("/tables/")) allowed = method === "GET" || ["administrador", "mesero", "cajero"].includes(role);
  else if (path === "/orders" || path.startsWith("/orders/")) allowed = method === "GET" || (method === "POST" && ["administrador", "mesero", "cliente"].includes(role)) || (method === "PUT" && staff.includes(role));
  else if (path === "/payments" || path.startsWith("/cash-closing")) allowed = ["administrador", "cajero"].includes(role);
  else if (path === "/alerts" || path.startsWith("/alerts/")) allowed = staff.includes(role);
  if (!allowed) return c.json({ error: "Acceso no autorizado" }, 403);
  const prefixes: Record<string, string> = { products: "product:", tables: "table:", orders: "order:", alerts: "alert:" };
  const [, resource, id] = path.split("/");
  if (id && prefixes[resource] && !id.startsWith(prefixes[resource])) return c.json({ error: "Identificador inválido" }, 400);
  await next();
});
app.get("/make-server-71783a73/health", async (c) => {
  await kv.get("system_configuration");
  return c.json({ success: true, database: "connected" });
});

// ==================== AUTENTICACIÓN ====================

// Registro de usuario
app.post("/make-server-71783a73/auth/signup", async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    if (!["cliente", "administrador", "mesero", "cajero", "cocinero"].includes(role)) return c.json({ error: "Rol inválido" }, 400);

    // Validar que solo admin puede crear usuarios con ciertos roles
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];
    
    let requestingUser = null;
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data } = await supabase.auth.getUser(token);
      if (data?.user) {
        const userData = await kv.get(`user_profile:${data.user.id}`);
        requestingUser = userData;
      }
    }

    // Solo administradores pueden crear usuarios de staff
    if (role !== "cliente" && (!requestingUser || requestingUser.role !== "administrador" || requestingUser.active === false)) {
      return c.json({ error: "Solo administradores pueden crear usuarios de staff" }, 403);
    }

    // Crear usuario en Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email ya que no hay servidor de email configurado
      user_metadata: { name, role }
    });

    if (error) {
      console.error("Error al crear usuario:", error);
      return c.json({ error: error.message }, 400);
    }

    // Guardar perfil del usuario en KV
    const userProfile = {
      id: data.user.id,
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
      phone: "",
      avatar: "",
      active: true // Usuario activo por defecto
    };

    await kv.set(`user_profile:${data.user.id}`, userProfile);
    await kv.set(`user_by_email:${email}`, data.user.id);

    return c.json({ 
      success: true, 
      user: { id: data.user.id, email, name, role } 
    });
  } catch (error) {
    console.error("Error en signup:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Login de usuario
app.post("/make-server-71783a73/auth/login", async (c) => {
  try {
    const { email, password } = await c.req.json();

    // Crear cliente temporal para login (sin SERVICE_ROLE_KEY)
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error("Error al iniciar sesión:", error);
      return c.json({ error: "Credenciales inválidas" }, 401);
    }

    // Obtener perfil del usuario
    const userProfile = await kv.get(`user_profile:${data.user.id}`);

    // Verificar si el usuario está activo
    if (!userProfile) return c.json({ error: "Perfil no configurado. Contacte al administrador." }, 403);
    if (userProfile.active === false) {
      return c.json({ 
        error: `Cuenta desactivada. Motivo: ${userProfile.deactivationNote || "No especificado"}` 
      }, 403);
    }

    return c.json({
      success: true,
      accessToken: data.session.access_token,
      user: userProfile || {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || "",
        role: "cliente"
      }
    });
  } catch (error) {
    console.error("Error en login:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Verificar sesión activa
app.get("/make-server-71783a73/auth/session", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    
    if (!token) {
      return c.json({ error: "No token provided" }, 401);
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return c.json({ error: "Invalid session" }, 401);
    }

    const userProfile = await kv.get(`user_profile:${data.user.id}`);

    return c.json({
      success: true,
      user: userProfile || {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || "",
        role: "cliente"
      }
    });
  } catch (error) {
    console.error("Error verificando sesión:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== PERFIL DE USUARIO ====================

app.get("/make-server-71783a73/profile", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const profile = await kv.get(`user_profile:${user.id}`);
    return c.json({ success: true, profile });
  } catch (error) {
    console.error("Error obteniendo perfil:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-71783a73/profile", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { name, phone, avatar } = await c.req.json();
    const updates = Object.fromEntries(Object.entries({ name, phone, avatar }).filter(([,v]) => v !== undefined));
    const currentProfile = await kv.get(`user_profile:${user.id}`) || {};
    
    const updatedProfile = {
      ...currentProfile,
      ...updates,
      id: user.id, // No permitir cambiar ID
      role: currentProfile.role, // No permitir cambiar rol desde perfil
      updatedAt: new Date().toISOString()
    };

    await kv.set(`user_profile:${user.id}`, updatedProfile);

    return c.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error("Error actualizando perfil:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== GESTIÓN DE USUARIOS ====================

// Listar todos los usuarios
app.get("/make-server-71783a73/users", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Verificar que el usuario es administrador
    const profile = await kv.get(`user_profile:${user.id}`);
    if (!profile || !["administrador", "cajero"].includes(profile.role)) {
      return c.json({ error: "Acceso no autorizado" }, 403);
    }

    // Obtener todos los perfiles de usuarios con reintentos
    const userProfiles = await retryOperation(() => kv.getByPrefix("user_profile:"), 3, 500) || [];
    
    return c.json({ success: true, users: profile.role === "cajero" ? userProfiles.filter(u => u.role === "mesero").map(u => ({ id: u.id, name: u.name, role: u.role })) : userProfiles });
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    return c.json({ error: error.message, users: [] }, 500);
  }
});

// Actualizar usuario (activar/desactivar, etc.)
app.put("/make-server-71783a73/users/:userId", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Verificar que el usuario es administrador
    const profile = await kv.get(`user_profile:${user.id}`);
    if (!profile || profile.role !== "administrador") {
      return c.json({ error: "Solo administradores pueden modificar usuarios" }, 403);
    }

    const userId = c.req.param("userId");
    const updates = await c.req.json();
    
    const currentProfile = await kv.get(`user_profile:${userId}`);
    if (!currentProfile) {
      return c.json({ error: "Usuario no encontrado" }, 404);
    }

    // Construir perfil actualizado
    const updatedProfile = {
      ...currentProfile,
      ...updates,
      id: userId, // No permitir cambiar ID
      updatedAt: new Date().toISOString(),
      updatedBy: user.id
    };

    // Si se está desactivando el usuario, agregar información adicional
    if (updates.active === false && updates.deactivationNote) {
      updatedProfile.deactivatedAt = new Date().toISOString();
      updatedProfile.deactivatedBy = user.id;
    }

    // Si se está reactivando el usuario, limpiar información de desactivación
    if (updates.active === true) {
      delete updatedProfile.deactivationNote;
      delete updatedProfile.deactivatedAt;
      delete updatedProfile.deactivatedBy;
      updatedProfile.reactivatedAt = new Date().toISOString();
      updatedProfile.reactivatedBy = user.id;
    }

    await kv.set(`user_profile:${userId}`, updatedProfile);

    return c.json({ success: true, user: updatedProfile });
  } catch (error) {
    console.error("Error actualizando usuario:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== CONFIGURACIÓN DEL SISTEMA ====================

app.get("/make-server-71783a73/configuration", async (c) => {
  try {
    const config = await kv.get("system_configuration") || {
      restaurantName: "SIREST - Globatech",
      address: "Calle Principal #123",
      phone: "+57 300 123 4567",
      email: "info@globatech.com",
      taxRate: 19,
      currency: "COP",
      timezone: "America/Bogota"
    };

    return c.json({ success: true, configuration: config });
  } catch (error) {
    console.error("Error obteniendo configuración:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-71783a73/configuration", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Verificar que el usuario es administrador
    const profile = await kv.get(`user_profile:${user.id}`);
    if (!profile || profile.role !== "administrador") {
      return c.json({ error: "Solo administradores pueden modificar la configuración" }, 403);
    }

    const updates = await c.req.json();
    await kv.set("system_configuration", {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id
    });

    return c.json({ success: true, configuration: updates });
  } catch (error) {
    console.error("Error actualizando configuración:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== PRODUCTOS/INVENTARIO ====================

app.get("/make-server-71783a73/products", async (c) => {
  try {
    const products = await retryOperation(() => kv.getByPrefix("product:"), 3, 500) || [];
    return c.json({ success: true, products: products.map(p => p) });
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    return c.json({ error: error.message, products: [] }, 500);
  }
});

app.post("/make-server-71783a73/products", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const product = await c.req.json();
    const productId = `product:${Date.now()}`;
    
    const newProduct = {
      ...product,
      id: productId,
      createdAt: new Date().toISOString(),
      createdBy: user.id
    };

    await kv.set(productId, newProduct);

    return c.json({ success: true, product: newProduct });
  } catch (error) {
    console.error("Error creando producto:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-71783a73/products/:id", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const productId = c.req.param("id");
    const updates = await c.req.json();
    
    const currentProduct = await kv.get(productId);
    if (!currentProduct) {
      return c.json({ error: "Producto no encontrado" }, 404);
    }

    const updatedProduct = {
      ...currentProduct,
      ...updates,
      id: productId,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id
    };

    await kv.set(productId, updatedProduct);

    return c.json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error("Error actualizando producto:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-71783a73/products/:id", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const productId = c.req.param("id");
    await kv.del(productId);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error eliminando producto:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== MESAS ====================

app.get("/make-server-71783a73/tables", async (c) => {
  try {
    const tables = await retryOperation(() => kv.getByPrefix("table:"), 3, 500) || [];
    return c.json({ success: true, tables: tables.map(t => t) });
  } catch (error) {
    console.error("Error obteniendo mesas:", error);
    return c.json({ error: error.message, tables: [] }, 500);
  }
});

app.put("/make-server-71783a73/tables/:id", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const tableId = c.req.param("id");
    const updates = await c.req.json();
    
    const currentTable = await kv.get(tableId) || {};

    const updatedTable = {
      ...currentTable,
      ...updates,
      id: tableId,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id
    };

    await kv.set(tableId, updatedTable);

    return c.json({ success: true, table: updatedTable });
  } catch (error) {
    console.error("Error actualizando mesa:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== PEDIDOS ====================

app.get("/make-server-71783a73/orders", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data } = await supabase.auth.getUser(token);
    const profile = await kv.get(`user_profile:${data.user.id}`);
    const orders = await retryOperation(() => kv.getByPrefix("order:"), 3, 500) || [];
    return c.json({ success: true, orders: profile.role === "cliente" ? orders.filter(o => o.customerId === data.user.id || o.createdBy === data.user.id) : orders });
  } catch (error) {
    console.error("Error obteniendo pedidos:", error);
    return c.json({ error: error.message, orders: [] }, 500);
  }
});

app.post("/make-server-71783a73/orders", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    
    
    const token = authHeader?.split(" ")[1];
    console.log("Token extracted:", token ? "Present" : "Missing");
    
    if (!token) {
      console.error("No token provided in Authorization header");
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error("Error validating token:", error);
      return c.json({ error: `Unauthorized - ${error.message}` }, 401);
    }

    if (!user?.id) {
      console.error("No user found for token");
      return c.json({ error: "Unauthorized - Invalid user" }, 401);
    }

    

    const order = await c.req.json();
    const profile = await kv.get(`user_profile:${user.id}`);
    if (profile.role === "cliente") { order.customerId = user.id; order.customerEmail = user.email; order.status = "pending"; }
    const orderId = `order:${Date.now()}`;
    
    const newOrder = {
      ...order,
      id: orderId,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      status: order.status || "pending"
    };

    await kv.set(orderId, newOrder);

    // Crear alerta para nuevo pedido
    const alertId = `alert:${Date.now()}`;
    await kv.set(alertId, {
      id: alertId,
      type: "new_order",
      message: `Nuevo pedido para Mesa ${order.tableNumber}`,
      orderId: orderId,
      createdAt: new Date().toISOString(),
      read: false
    });

    console.log("Order created successfully:", orderId);
    return c.json({ success: true, order: newOrder });
  } catch (error) {
    console.error("Error creando pedido:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-71783a73/orders/:id", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const orderId = c.req.param("id");
    const updates = await c.req.json();
    
    const currentOrder = await kv.get(orderId);
    if (!currentOrder) {
      return c.json({ error: "Pedido no encontrado" }, 404);
    }

    const updatedOrder = {
      ...currentOrder,
      ...updates,
      id: orderId,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id
    };

    await kv.set(orderId, updatedOrder);

    // Crear alerta si el pedido está listo
    if (updates.status === "ready" && currentOrder.status !== "ready") {
      const alertId = `alert:${Date.now()}`;
      await kv.set(alertId, {
        id: alertId,
        type: "order_ready",
        message: `Pedido listo para Mesa ${updatedOrder.tableNumber}`,
        orderId: orderId,
        createdAt: new Date().toISOString(),
        read: false
      });
    }

    return c.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Error actualizando pedido:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== ALERTAS ====================

app.get("/make-server-71783a73/alerts", async (c) => {
  try {
    const alerts = await retryOperation(() => kv.getByPrefix("alert:"), 3, 500) || [];
    return c.json({ success: true, alerts: alerts.filter(a => !a.read) });
  } catch (error) {
    console.error("Error obteniendo alertas:", error);
    return c.json({ error: error.message, alerts: [] }, 500);
  }
});

app.put("/make-server-71783a73/alerts/:id/read", async (c) => {
  try {
    const alertId = c.req.param("id");
    const alert = await kv.get(alertId);
    
    if (!alert) {
      return c.json({ error: "Alerta no encontrada" }, 404);
    }

    await kv.set(alertId, { ...alert, read: true });
    return c.json({ success: true });
  } catch (error) {
    console.error("Error marcando alerta:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== PAGOS ====================

app.post("/make-server-71783a73/payments", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payment = await c.req.json();
    if (typeof payment.orderId !== "string" || !payment.orderId.startsWith("order:")) return c.json({ error: "Pedido inválido" }, 400);
    const paymentId = `payment:${Date.now()}`;
    
    const newPayment = {
      ...payment,
      id: paymentId,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      status: "completed"
    };

    await kv.set(paymentId, newPayment);

    // Actualizar el pedido a pagado
    if (payment.orderId) {
      const order = await kv.get(payment.orderId);
      if (order) {
        await kv.set(payment.orderId, { ...order, status: "paid", paidAt: new Date().toISOString() });
      }
    }

    return c.json({ success: true, payment: newPayment });
  } catch (error) {
    console.error("Error procesando pago:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-71783a73/payments", async (c) => {
  try {
    const payments = await retryOperation(() => kv.getByPrefix("payment:"), 3, 500) || [];
    return c.json({ success: true, payments: payments.map(p => p) });
  } catch (error) {
    console.error("Error obteniendo pagos:", error);
    return c.json({ error: error.message, payments: [] }, 500);
  }
});

// ==================== REPORTES DE CAJA ====================

app.post("/make-server-71783a73/cash-closing", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const closingData = await c.req.json();
    const closingId = `cash_closing:${Date.now()}`;
    
    const payments = await retryOperation(() => kv.getByPrefix("payment:"), 3, 500) || [];
    const todayPayments = payments.filter(p => {
      const paymentDate = new Date(p.createdAt).toDateString();
      return paymentDate === new Date().toDateString();
    });

    const totalSales = todayPayments.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalCash = todayPayments.filter(p => p.paymentMethod === "efectivo").reduce((sum, p) => sum + (p.total || 0), 0);
    const totalCard = todayPayments.filter(p => p.paymentMethod === "tarjeta").reduce((sum, p) => sum + (p.total || 0), 0);
    
    const closingReport = {
      ...closingData,
      id: closingId,
      date: new Date().toISOString(),
      totalSales,
      totalCash,
      totalCard,
      totalTransactions: todayPayments.length,
      closedBy: user.id
    };

    await kv.set(closingId, closingReport);

    return c.json({ success: true, report: closingReport });
  } catch (error) {
    console.error("Error creando cierre de caja:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-71783a73/cash-closings", async (c) => {
  try {
    const closings = await retryOperation(() => kv.getByPrefix("cash_closing:"), 3, 500) || [];
    return c.json({ success: true, closings: closings.map(c => c) });
  } catch (error) {
    console.error("Error obteniendo cierres de caja:", error);
    return c.json({ error: error.message, closings: [] }, 500);
  }
});

// ==================== ESTADO DEL PERSONAL ====================

app.get("/make-server-71783a73/staff-status", async (c) => {
  try {
    const token = c.req.header("Authorization")?.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const profile = await kv.get(`user_profile:${user.id}`);
    if (!profile || profile.role !== "administrador") {
      return c.json({ error: "Solo administradores pueden ver estado del personal" }, 403);
    }

    const users = await kv.getByPrefix("user_profile:") || [];
    const staff = users.filter(u => u.role !== "cliente" && u.role !== "administrador");
    
    const staffStatus = staff.map(s => {
      const statusData = {
        id: s.id,
        name: s.name,
        role: s.role,
        status: "activo", // En producción esto vendría de un sistema de asistencia
        shift: s.role === "cocinero" ? "11:00 - 22:00" : s.role === "mesero" ? "10:00 - 20:00" : "09:00 - 17:00",
        performance: Math.floor(Math.random() * 30) + 70 // Simulado
      };
      return statusData;
    });

    return c.json({ success: true, staff: staffStatus });
  } catch (error) {
    console.error("Error obteniendo estado del personal:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== INICIALIZACIÓN ====================

// Endpoint para inicializar datos de ejemplo
Deno.serve(app.fetch);
