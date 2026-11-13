# SIREST V2.1

Sistema de gestión de restaurantes con React, TypeScript, Vite y Supabase. Rama de desarrollo: `v2`. Producción permanece en la versión recuperada de V1.

## Cambios V2.1
- Paneles de mesero, cocina, caja y administración con navegación y estilos unificados; pestañas adaptables, mesas accesibles por teclado y tablero de cocina.
- Comprobantes internos de pago impresos desde el navegador, con datos confirmados por el servidor; impresión posterior al cobro y desde el historial del día. El PDF sigue disponible. No constituye facturación electrónica fiscal ni integración con datáfonos.
- Pruebas de regresión de impresión en efectivo y tarjeta, y de pestañas en escritorio/móvil.
- El envío por correo no está implementado; la interfaz ya no afirma que se envió un correo.

## Entorno local reproducible (Windows PowerShell)
Requisitos: Node.js, Docker Desktop iniciado y Git. Trabajar en la carpeta del repositorio, rama `v2`.

```powershell
npm install
if (!(Test-Path supabase/config.toml)) { npx supabase@2.48.3 init }
New-Item -ItemType Directory -Force supabase/functions/make-server-71783a73, supabase/migrations | Out-Null
Copy-Item src/supabase/functions/server/index.tsx supabase/functions/make-server-71783a73/index.ts
Copy-Item src/supabase/functions/server/kv_store.tsx supabase/functions/make-server-71783a73/kv_store.tsx
@'
create table if not exists public.kv_store_71783a73 (key text primary key, value jsonb not null);
alter table public.kv_store_71783a73 enable row level security;
revoke all on table public.kv_store_71783a73 from anon, authenticated, public;
grant select, insert, update, delete on table public.kv_store_71783a73 to service_role;
'@ | Set-Content -Encoding ASCII supabase/migrations/20261112000000_qa_schema.sql
Copy-Item src/supabase/migrations/*.sql supabase/migrations/
npx supabase@2.48.3 start
npx supabase@2.48.3 status -o env | ForEach-Object {
    if ($_ -match '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)="?([^\"]+)"?$') {
        Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2]
    }
}
$env:VITE_SUPABASE_URL = $env:API_URL
$env:VITE_SUPABASE_ANON_KEY = $env:ANON_KEY
npm run dev -- --host 127.0.0.1
```

Abrir http://127.0.0.1:3000. El administrador debe aprovisionarse en Auth y la tabla KV con rol `administrador`; el registro público solo crea clientes. No publicar claves privadas. La configuración local generada queda ignorada en Git; las migraciones originales permanecen en `src/supabase/migrations`.

## Datos de demostración (opcional)
Con las variables locales cargadas, ejecuta lo siguiente. Crea cinco cuentas demo, ocho mesas (101–108) y ocho productos. No sobrescribe datos ni contraseñas existentes.

```powershell
$env:SIREST_DEMO_PASSWORD = [System.Net.NetworkCredential]::new("", (Read-Host "Contraseña demo (mínimo 8 caracteres)" -AsSecureString)).Password
node scripts/seed-demo.mjs
Remove-Item Env:SIREST_DEMO_PASSWORD
```

Los correos son `demo-administrador@sirest.local`, `demo-mesero@sirest.local`, `demo-cocinero@sirest.local`, `demo-cajero@sirest.local` y `demo-cliente@sirest.local`. No ejecutar en producción.

## QA
Con Vite detenido, Supabase local en ejecución y variables API_URL, ANON_KEY y SERVICE_ROLE_KEY cargadas:

```powershell
npx playwright install chromium
npx playwright test --headed
npx playwright show-report
```

Las pruebas crean usuarios y datos de prueba; para CI se usa una base local aislada y nueva. No ejecutar contra producción. GitHub Actions ejecuta el build, pruebas API y Playwright. Para evitar conflictos entre pruebas repetidas, utilizar un entorno de QA limpio, conservando aparte los datos de demostración.

## Pendientes y límites
Ver [Issue #2](https://github.com/Chuchossj/Sirestv1/issues/2). Pendientes: validación manual del nuevo diseño y diálogo de impresión en Windows, confirmar ejecución de las nuevas pruebas de concurrencia, revisión de dependencias y despliegue controlado. Los impuestos y el servicio corresponden a las reglas del prototipo y no han sido validados fiscalmente.
