# Archivos corregidos — instrucciones de instalación

---

## PARTE 1 — Correcciones de scroll y de api/upgrade.mjs (primera entrega)

### `fixes/token-index.css` → reemplaza `token/index.css`
Añade la clase `.scrollable` que usaban 4 pantallas pero nunca estaba definida.

### `fixes/token-App.tsx` → reemplaza `token/App.tsx`
Añade `minHeight:0` al contenedor del screen para que el scroll funcione en flex.

### `fixes/api-upgrade.mjs` → reemplaza `api/upgrade.mjs`
Corrige import roto, URL rota de Etherscan, y API key hardcodeada.

---

## PARTE 2 — Backend completo del token mini-app (segunda entrega)

### PASO 1 — Ejecutar el schema SQL en Supabase

Abre **Supabase → SQL Editor** y pega el contenido completo de:

```
fixes/supabase-schema.sql
```

Crea 5 tablas: `tokens`, `airdrops`, `airdrop_claims`, `holdings`, `token_activity`.

---

### PASO 2 — Copiar archivos a tu repositorio

Copia la carpeta `fixes/token/api/` completa a `token/api/` en tu repo:

```
fixes/token/api/
  _supabase.mjs                     → token/api/_supabase.mjs
  tokens.mjs                        → token/api/tokens.mjs
  airdrops.mjs                      → token/api/airdrops.mjs
  user.mjs                          → token/api/user.mjs
  tokens/
    trending.mjs                    → token/api/tokens/trending.mjs
    [id].mjs                        → token/api/tokens/[id].mjs
    [id]/
      activity.mjs                  → token/api/tokens/[id]/activity.mjs
      buy.mjs                       → token/api/tokens/[id]/buy.mjs
      sell.mjs                      → token/api/tokens/[id]/sell.mjs
  airdrops/
    [id]/
      claim.mjs                     → token/api/airdrops/[id]/claim.mjs
  user/
    holdings.mjs                    → token/api/user/holdings.mjs
    activity.mjs                    → token/api/user/activity.mjs
  creator/
    tokens.mjs                      → token/api/creator/tokens.mjs
```

---

### PASO 3 — Reemplazar token/package.json

Copia `fixes/token/package.json` → `token/package.json`

**Qué cambia:** se añade `"@supabase/supabase-js": "^2.45.4"` en `dependencies`.
Vercel necesita este paquete en `dependencies` (no devDependencies) para que
esté disponible en las funciones serverless en producción.

---

### PASO 4 — Variables de entorno en Vercel (proyecto del token app)

El backend del token usa el mismo Supabase que la app principal.
Añade estas variables en el proyecto Vercel del token mini-app:

| Variable                  | Dónde se encuentra                                        |
|---------------------------|-----------------------------------------------------------|
| `SUPABASE_URL`            | Supabase → Settings → API → Project URL                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key          |

> ⚠️ Usa la `service_role` key (no la `anon` key) porque los endpoints
> hacen escrituras y necesitan bypassear Row Level Security.

---

### PASO 5 — Variables de entorno en Vercel (proyecto principal)

Añade también para `api/upgrade.mjs`:

| Variable            | Valor                                |
|---------------------|--------------------------------------|
| `ETHERSCAN_API_KEY` | `B7PCP5XSYD41ZDT96PZ8R1X15CDH5H2US1` (o renovada) |

---

## Qué hace cada endpoint nuevo

| Endpoint                          | Qué hace                                                         |
|-----------------------------------|------------------------------------------------------------------|
| `GET /api/tokens`                 | Lista tokens con filtros (search, sort, limit, offset)           |
| `GET /api/tokens/trending`        | Tokens marcados como trending ordenados por volumen              |
| `GET /api/tokens/:id`             | Token individual por ID                                          |
| `GET /api/tokens/:id/activity`    | Feed de actividad del token (compras, ventas, airdrops)          |
| `POST /api/tokens/:id/buy`        | Registra compra: actualiza holdings, stats del token, actividad  |
| `POST /api/tokens/:id/sell`       | Registra venta: valida balance, actualiza holdings y actividad   |
| `GET /api/airdrops`               | Lista airdrops activos + info de cooldown del usuario            |
| `POST /api/airdrops/:id/claim`    | Reclama airdrop: verifica cooldown, añade tokens a holdings      |
| `GET /api/user`                   | Perfil del usuario con stats (tokens creados, held, valor total) |
| `GET /api/user/holdings`          | Posiciones del usuario con PnL calculado                         |
| `GET /api/user/activity`          | Historial de actividad del usuario                               |
| `POST /api/creator/tokens`        | Crea nuevo token y registra creator como primer holder           |

## Comportamiento del fallback en api.ts

`api.ts` ya tiene `try/catch` en todos los métodos: si el endpoint falla,
la app sigue mostrando datos mock. Una vez que los endpoints existan en Vercel
y las tablas estén creadas en Supabase, la app automáticamente usará los datos reales.
