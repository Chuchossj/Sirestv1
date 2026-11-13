# SIREST V.1

Sistema de gestión de restaurantes. React, TypeScript, Vite y Supabase.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Para compilar: `npm run build`.

## Backend recuperado

- Proyecto Supabase: `kfzlfkuehouubrkpfmft`.
- Edge Function: `make-server-71783a73`.
- Tabla: `public.kv_store_71783a73` (RLS habilitada, acceso por service role desde el backend).
- Variables opcionales: `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_ANON_KEY` (solo clave pública).

El registro público crea únicamente clientes. El administrador inicial debe aprovisionarse desde Supabase Auth y recibir un perfil de administrador en la tabla KV; no se crean usuarios con contraseñas públicas ni se inicializan datos al abrir la app. El backend requiere autorización por rol en rutas privadas. No se deben guardar claves service_role en el frontend.

## Verificación pendiente

Probar inicio de sesión, permisos, inventario, mesas, pedidos, cocina, pagos y cierre de caja en una sesión real. El código original contiene módulos simulados (notificaciones, recuperación de contraseña y algunos reportes); requieren revisión antes de uso en producción.
