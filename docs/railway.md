# Deploy en Railway

El repo es un **monorepo aislado**: `backend/` y `frontend/` no comparten codigo ni
`node_modules`, cada uno tiene su Dockerfile. En Railway eso son **tres servicios**:

| Servicio   | Root Directory | Config file             |
| ---------- | -------------- | ----------------------- |
| `postgres` | —              | (plugin de Railway)     |
| `backend`  | `/backend`     | `/backend/railway.json` |
| `frontend` | `/frontend`    | `/frontend/railway.json`|

> El **Config file path se escribe absoluto** y NO sigue al Root Directory. Es el error
> mas comun: poner `railway.json` a secas y que Railway no lo encuentre.

> Lo mismo pasa con los **watch paths**: son patrones estilo gitignore contra los paths del
> repo, no del Root Directory. Con `src/**` no matchean nada y **cada push queda en SKIPPED**
> sin explicacion; van `/backend/**` y `/frontend/**`. El `dockerfilePath`, en cambio, si es
> relativo al Root Directory.

Los `railway.json` ya estan en el repo con `builder: DOCKERFILE`, healthcheck y watch paths.
Railway construye la **ultima etapa** del Dockerfile, que en ambos es `production` — no hace
falta configurar target.

## 1. Postgres

Agregar el plugin de Postgres. Expone `DATABASE_URL`, que el backend prefiere sobre las
variables sueltas (`src/config/database.config.ts`). Las migraciones corren solas al
arrancar (`migrationsRun: true`), no hace falta un `preDeployCommand`.

## 2. Variables del backend

```
NODE_ENV=production
PORT=4100                  # fijo, para poder referenciarlo desde el frontend
BIND_HOST=::               # ver nota de IPv6 mas abajo
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_SSL=false         # true solo si conectas por el proxy externo

FRONTEND_URL=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
PUBLIC_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}

ML_CLIENT_ID=...
ML_CLIENT_SECRET=...
ML_REDIRECT_URI=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api/auth/mercadolibre/callback
ML_SITE_ID=MLA
ML_AUTH_DOMAIN=https://auth.mercadolibre.com.ar
ML_API_URL=https://api.mercadolibre.com

# Seed automatico
SEED_ON_BOOT=true
SEED_DEPTH=2
CRAWLER_AUTOSTART=true
CRAWLER_DELAY_SECONDS=60
```

El `ML_REDIRECT_URI` tiene que quedar cargado identico en el DevCenter de ML.

## 3. Variables del frontend

```
NODE_ENV=production
HOSTNAME=::
API_URL=http://backend.railway.internal:4100/api
NEXT_PUBLIC_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api
```

> **`${{backend.PORT}}` no resuelve.** PORT lo inyecta Railway en el contenedor, pero no es
> una variable del servicio referenciable desde otro. Si la usas, `API_URL` queda como
> `http://backend.railway.internal:/api` y el frontend falla con `fetch failed` — con la
> pagina respondiendo 200 y la tabla vacia, que es lo dificil de diagnosticar.
> La solucion es fijar `PORT=4100` en el backend y escribir el puerto literal aca.

- `API_URL` la usan los Server Components: va por la **red privada**, sin salir a internet.
- `NEXT_PUBLIC_API_URL` la usa el browser: tiene que ser la URL **publica**.

**`NEXT_PUBLIC_*` se inlinea en build.** El Dockerfile ya la recibe como `ARG`, y Railway
expone las variables del servicio como build args, asi que funciona — pero cambiarla
**exige un redeploy**, no alcanza con reiniciar.

## 4. Dos trampas de Railway

**La red privada no existe durante el build.** Si el build necesitara pegarle al backend
fallaria. El nuestro no lo hace, pero es la razon por la que `NEXT_PUBLIC_API_URL` apunta al
dominio publico y no a `.railway.internal`.

**IPv6 en entornos legacy.** Los entornos creados antes de octubre de 2025 tienen red privada
**solo IPv6**: ahi el servicio debe escuchar en `::` o es inalcanzable. Por eso el backend
tiene `BIND_HOST` (default `0.0.0.0` para Docker local). En entornos nuevos funcionan ambos,
pero `::` es dual-stack y cubre los dos casos. Para el frontend, el equivalente es
`HOSTNAME=::` (el Dockerfile lo fija en `0.0.0.0`).

## 5. El seed automatico

`BootstrapService` corre en `onApplicationBootstrap`:

1. Si `SEED_ON_BOOT=true` **y la tabla `categories` esta vacia**, sincroniza el arbol
   (`SEED_DEPTH=2` son 489 categorias en MLA, ~20s). Si ya hay datos, no hace nada.
2. Si `CRAWLER_AUTOSTART=true`, prende el crawler.

Corre **en segundo plano a proposito**: si bloqueara el arranque, el healthcheck de Railway
marcaria el deploy como fallido mientras sincroniza.

**Un solo replica para el backend.** El crawler no tiene lock distribuido: con dos replicas,
las dos escanearian en paralelo y duplicarian el consumo contra ML. Si necesitas escalar el
backend, hay que sacar el crawler a un servicio aparte (Railway soporta `cronSchedule` en el
`railway.json` para eso).

## 6. Que NO se deploya

`docker-compose.yml`, `docker-compose.prod.yml` y el servicio `ngrok` son solo para local.
En Railway el HTTPS lo da la plataforma, asi que el tunel no hace falta.
