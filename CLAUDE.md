# scrapper-products

Monorepo con dos apps que se integran con la API de Mercado Libre, todo containerizado.

```
backend/    NestJS 11 — API REST, prefijo global /api, puerto 4100
frontend/   Next.js 16 (App Router, SSR) + Tailwind 4 + shadcn/ui, puerto 3100
postgres    Postgres 18, puerto 5434, volumen postgres_data
```

No hay npm workspaces: cada app tiene su `package.json` y `node_modules` propios.
La raiz solo orquesta (docker compose + scripts con concurrently).

## Puertos

Elegidos para no chocar con el stack `assetfy-platform` que corre en esta maquina
(ocupa 3001, 5001-5004, 5174-5176, 5273, 5433, 4317-4318, 1026, 8026, 1433):

| Servicio        | Host  |
| --------------- | ----- |
| frontend        | 3100  |
| backend         | 4100  |
| postgres        | 5434  |
| panel ngrok     | 4140  |

Se cambian desde el `.env` de la raiz (`FRONTEND_PORT`, `BACKEND_PORT`).

## Comandos

Docker (modo por defecto):

- `npm run docker:up` / `docker:down` / `docker:logs` / `docker:build`
- `npm run tunnel:up` — levanta ngrok (perfil `tunnel`), requiere `NGROK_AUTHTOKEN` en `.env`
- `npm run prod:build` / `prod:up` / `prod:down` — imagenes de produccion

Sin Docker (node local):

- `npm run dev` — backend + frontend con concurrently
- `npm run build` / `npm run lint` / `npm test`

## Docker

- Cada app tiene un Dockerfile multi-stage con targets `development` y `production`.
- `docker-compose.yml` usa el target `development`: bind mount del codigo + volumen
  nombrado para `node_modules`, con hot reload verificado en ambas apps.
- `docker-compose.prod.yml` usa el target `production`: backend con `npm prune --omit=dev`,
  frontend con `output: "standalone"`. Imagenes ~290MB cada una.
- Dentro de compose el frontend habla con el backend por `http://backend:4100/api`.
  El browser lo alcanza por `http://localhost:4100/api`.

## Base de datos

Postgres 18 en compose, con volumen nombrado `postgres_data`. **El mount va en
`/var/lib/postgresql`, no en `/var/lib/postgresql/data`**: desde la 18 la imagen guarda los
datos en un subdirectorio por version y con el mount viejo el contenedor no arranca.

TypeORM 1.x con migraciones versionadas (`synchronize` siempre en false, `migrationsRun: true`
al bootstrap). Las migraciones viven en `backend/src/database/migrations/`.

- `npm run migration:generate -- src/database/migrations/<Nombre>` (necesita la base arriba)
- `npm run migration:run` / `migration:revert` / `migration:show`

La migracion inicial activa `uuid-ossp`: TypeORM genera `uuid_generate_v4()` como default y
en Postgres 18 esa extension no viene activada.

Esquema (`backend/src/database/entities/`):

- `categories` — espejo del arbol de ML. `depth` 0 son las raices. `path` guarda el
  `path_from_root` tal cual para no re-resolverlo.
- `brands` — marca global. La identidad es `ml_value_id` cuando ML lo da (Samsung=206) y el
  `slug` (nombre normalizado sin acentos) cuando no. Indice unico parcial sobre `ml_value_id`.
- `category_brands` — la tabla que acumula. `products` es el ultimo scan, `products_max` el
  maximo historico (asi un scan chico no borra cobertura de uno grande) y `occurrences`
  cuantas corridas vieron la marca.
- `products` — productos de **catalogo** de ML (ids tipo MLA63192943), no publicaciones.
  Salen del mismo barrido que las marcas, asi que persistirlos no cuesta requests extra.
  `domain_id` es canonico; `category_id` es "bajo que categoria lo encontramos", que en
  scans de raices (sin filtro de dominio) puede no ser la categoria canonica de ML.
  El detalle viene en dos niveles:
  - **Gratis** (ya lo devuelve `/products/search`): `attributes` (~85 por producto),
    `pictures`, `short_description`, `tags`, `quality_type`, `parent_id`, fechas de ML.
  - **A demanda** (2 requests, cacheados 24h en `detail_fetched_at`): `permalink` y
    `main_features` de `/products/{id}`, y `listings_count`/`sellers_count`/`price_min`/
    `price_max` de `/products/{id}/items`. Se disparan al pedir `GET /api/catalog/products/:id`.
- `crawler_state` — una sola fila (id=1) con el estado del llenado progresivo, para que
  sobreviva a un reinicio del contenedor.
- `scan_runs` — bitacora de cada peticion: semillas, paginas, muestreados, marcas, duracion.

## Variables de entorno

- `backend/.env` — se valida al bootstrap en `src/config/env.validation.ts`; si falta algo
  la app no levanta. **Contiene secretos reales de ML, esta gitignoreado.**
- `frontend/.env.local` — `API_URL` (server) y `NEXT_PUBLIC_API_URL` (browser, se inlinea
  en build). En Docker, compose los pisa: `process.env` gana sobre `.env.local` en Next.
- `.env` (raiz) — puertos, credenciales de postgres y config de ngrok para compose.

## ngrok

`https://glaring-curtsy-veneering.ngrok-free.dev` es el tunel de desarrollo y **apunta al
backend** (`backend:4100`), porque ML exige HTTPS para el redirect de OAuth y para las
notificaciones/webhooks. Esta en `PUBLIC_URL` y en `ML_REDIRECT_URI`; el redirect tiene que
estar cargado identico en el DevCenter de ML.

## API propia

Dos namespaces con responsabilidades distintas:

- `/api/categories/*` — **proxy en vivo a ML**, no toca la base. Sirve para explorar y depurar.
- `/api/catalog/*` — **todo sale de la base**:
  - `GET  /api/catalog/stats`
  - `GET  /api/catalog/categories?parent=` (sin `parent` devuelve las raices)
  - `GET  /api/catalog/categories/:id` (categoria + hijas + marcas)
  - `GET  /api/catalog/categories/:id/brands`
  - `GET  /api/catalog/brands?limit=&offset=&search=&sort=&dir=`
    (`sort`: `name` | `categories` | `products`; `dir`: `asc` | `desc`)
  - `GET  /api/catalog/products?categoryId=&brandId=&search=&limit=&offset=&sort=&dir=`
    (filtros combinables; `sort`: `name` | `brand` | `category` | `lastSeenAt`)
  - `GET  /api/catalog/products/:id` (detalle; `?refresh=1` fuerza releer de ML)
  - `GET  /api/catalog/crawler` · `POST /api/catalog/crawler/start` · `POST .../stop`
  - `GET  /api/catalog/scans?limit=`
  - `POST /api/catalog/sync` `{depth}` — trae el arbol de ML y lo persiste
  - `POST /api/catalog/categories/:id/scan` `{strategy,seeds,pages}` — scan + persistencia

## Rate limit y llenado progresivo

ML **no publica un RPM**. La doc dice que el limite se aplica **por Client ID** (no por IP) y
**por endpoint**, que el payload no cuenta, y que hay que detectar el 429 y espaciar con
backoff exponencial mas jitter. Se puede pedir aumento de cuota al equipo de integraciones.
La misma doc pide explicitamente **no hacer web crawling** y usar siempre la API.

Por eso el backend se autolimita:

- `RateLimiterService` — token bucket global por el que pasan **todas** las llamadas a ML.
  Se configura con `ML_RATE_LIMIT_PER_SECOND` (default 8) y `ML_RATE_LIMIT_BURST` (default 10).
- `MlApiService` reintenta el 429 hasta 4 veces con backoff exponencial y jitter completo,
  respetando `Retry-After` si viene, y vacia el bucket ante cada 429.
- `CrawlerService` (`@Interval`) llena la base de a poco: toma la categoria que hace mas
  tiempo no se escanea (las nunca escaneadas primero, despues por antiguedad, a igualdad
  la de mas items), la escanea, y espera `delaySeconds`. **Una categoria por vez**, nunca
  en paralelo. Se prende y apaga por API y el estado vive en `crawler_state`.

Medido: 418 requests en las primeras 11 corridas, con rafagas de concurrencia 3-6, **cero 429**.

## Deploy en Railway

Guia completa en `docs/railway.md`. Lo esencial:

- Monorepo **aislado**: tres servicios (postgres, backend, frontend). Root Directory
  `/backend` y `/frontend`, pero el **Config file path va absoluto** (`/backend/railway.json`)
  porque no sigue al Root Directory.
- `railway.json` en cada app con `builder: DOCKERFILE`. Railway construye la **ultima etapa**
  del Dockerfile, que en ambos es `production`.
- Los **`watchPatterns` tambien se escriben desde la raiz del repo** (`/backend/**`,
  `/frontend/**`), no desde el Root Directory. Con `src/**` no matchean nada y cada push
  queda en **SKIPPED** sin mensaje de error. El `dockerfilePath` si es relativo al Root
  Directory.
- La base llega como `DATABASE_URL` y gana sobre las variables sueltas. Las migraciones
  corren solas al arrancar.
- **La red privada no existe durante el build**: por eso `NEXT_PUBLIC_API_URL` apunta al
  dominio publico y `API_URL` a `backend.railway.internal`.
- **Entornos legacy de Railway (pre oct-2025) son solo IPv6**: ahi hace falta `BIND_HOST=::`.
- `SEED_ON_BOOT=true` sincroniza el arbol si `categories` esta vacia; `CRAWLER_AUTOSTART=true`
  prende el crawler. Ambos corren en segundo plano para no colgar el healthcheck.
- **Backend con una sola replica**: el crawler no tiene lock distribuido.

## backend/ (NestJS)

- Config tipada por namespace con `registerAs`: `app.*` y `mercadolibre.*`.
  Leer siempre via `ConfigService.get('mercadolibre.clientId')`, nunca `process.env` directo.
- Prefijo global `/api`. `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted`:
  todo DTO de entrada debe usar class-validator.
- CORS habilitado para `FRONTEND_URL` y `PUBLIC_URL` (el tunel), con credentials.
- Escucha en `0.0.0.0` para ser alcanzable desde fuera del contenedor.
- `isolatedModules` + `emitDecoratorMetadata` activos: los tipos usados en firmas decoradas
  (retornos de controllers, params) deben importarse con `import type`.
- `nest-cli.json` tiene **`deleteOutDir: false`**: en dev `dist/` es un volumen de Docker y
  `nest build` no puede hacerle rmdir (EBUSY). El `dist` del contenedor esta aislado del host
  con el volumen `backend_dist`, si no un `npm run build` local rompe el watch del contenedor.

## Skill de UI

`.claude/skills/ui-consistente/SKILL.md` es la regla de diseño del frontend: **solo componentes
shadcn nativos, cero estilos propios**. Prohibe CSS nuevo, `style={{}}`, valores arbitrarios de
Tailwind y colores crudos (todo va por tokens semanticos). Leerla antes de tocar cualquier
`.tsx` de `frontend/src`.

## frontend/ (Next.js)

- App Router con Server Components. `src/lib/api.ts` es el unico punto de acceso al backend
  desde el servidor; usa `API_URL` y por defecto `cache: "no-store"`.
- El shell es una `Sidebar` de shadcn en `app/layout.tsx` (la barra muestra los contadores de
  `/catalog/stats` y el estado del crawler). Cada pagina se envuelve en `PageShell`, que dibuja
  la barra fija con el `SidebarTrigger` y el breadcrumb: la ruta se arma en el servidor con los
  nombres reales, por eso no vive en el layout. Adentro va `PageHeader` (boton de volver, h1,
  badges, acciones).
- Dos clases de tabla: `LocalTable` (cliente) para listas que ya vienen completas — filtra y
  ordena en el navegador —, y `SortHeader` + `PaginationNav` para las listas paginadas por el
  backend, donde el orden viaja en la query y ordena Postgres, no la pagina.
- Tipos del contrato con el backend en `src/types/api.ts` — mantener en sync con NestJS.
- shadcn/ui preset `radix-nova` (Radix, base color neutral, iconos lucide).
  Agregar componentes con `npx shadcn@latest add <componente>`, no escribirlos a mano.
- `next.config.ts`: `turbopack.root` fijado (hay lockfile en la raiz), `output: "standalone"`
  para la imagen de prod, y `allowedDevOrigins` con `*.ngrok-free.dev`.
- Este Next es la version 16: ante dudas de API, leer `frontend/node_modules/next/dist/docs/`
  antes de escribir codigo. `middleware` esta deprecado a favor de `proxy`.

## API de Mercado Libre — lo que aprendimos probando

- **Casi nada es publico, pero hay dos excepciones verificadas**:
  - `/categories/{id}` y `/categories/{id}/attributes` responden **200 SIN token** (probado
    tambien con un Bearer invalido: siguen dando 200).
  - `/sites` y `/sites/{id}/categories` dan **403 sin token**.
  El resto pasa por token; el de aplicacion (`client_credentials`) dura 6h y alcanza para
  catalogo: sitios, categorias, atributos, technical_specs, products, highlights, trends.
- **`/sites/{site}/search` esta restringido** (403 con token de app, incluso con `seller_id`).
  El search abierto de items ya no es una fuente viable; con el se fue la faceta
  `available_filters.BRAND`, que era la forma clasica de listar marcas por categoria.
- **BRAND no es una lista cerrada.** En `/categories/{id}/attributes` y en
  `/catalog_domains/{domain}` viene `value_type: string`, `hierarchy: PARENT_PK` y
  `values: []`. Igual existe un id canonico por marca (Samsung=206, Motorola=2503,
  Xiaomi=59387), que aparece en los productos de catalogo y en `domain_discovery`.
- **`POST /products/search` con `attributes` exige minimo 3 atributos distintos**: sirve
  para identificar un producto puntual, no para navegar por marca.
- **`/items/{id}` tambien da 403** con token de app, incluso via multiget `/items?ids=`.
  Las publicaciones reales se alcanzan por otro lado: `/products/{id}/items` si responde
  (trae seller_id, precio, condicion por cada publicacion de ese producto de catalogo).
- **`/users/{otro}/items/search` esta restringido**: "Searching another user items is
  restricted". Solo funciona sobre los items propios.
- **Lo que si funciona para marcas** (implementado en `CategoriesService.getBrands()`,
  dos estrategias):
  - `highlights`: `/highlights/{site}/category/{cat}` da los 15 productos mas vendidos;
    resolviendo cada uno con `/products/{id}` sale la marca. Una llamada, poca cobertura
    (3 marcas en Celulares).
  - `catalog` (default): `/products/search` acotado por `domain_id`, usando varias
    semillas. Con seeds=12&pages=20 en Celulares levanta **114 marcas** sobre 4489
    productos, en ~32s.
- **Como armar las semillas**: `/categories/{id}` trae `settings.catalog_domain`
  (MLA1055 -> MLA-CELLPHONES) y `/trends/{site}/{cat}` trae 50 busquedas populares.
  Ojo: los trends estan sesgados a marcas lideres ("celular samsung", "iphone 17 pro"),
  asi que solos dan poca variedad. Mezclarlos con terminos genericos (nombre de la
  categoria y de su padre) es lo que abre el abanico.
- **`/products/search` corta el paginado en offset 1000** (1050 ya da 400). La cobertura
  sale de combinar consultas distintas, no de paginar una sola.
- **Categorias raiz**: su `catalog_domain` es generico (`is_generic: true`,
  `catalogable: NOT_DEFINED`) y filtrar por el devuelve cero productos. `getBrands()` lo
  detecta con una sonda y cae a buscar sin filtro de dominio; el response lo declara en
  `domainFiltered: false` y el resultado es mas ruidoso.
- El catalogo tiene marcas basura ("Teste", "iPhone14", "14 pro" como marca). Son datos
  reales de ML, no un bug nuestro: si molestan hay que filtrarlos aguas abajo.
- **Traer productos por categoria**: si, es lo que hace el scan — `/products/search` acotado
  por `domain_id` (el `catalog_domain` de la categoria).
- **Traer productos por marca**: ML **no tiene un filtro de marca de primera clase**, pero hay
  dos caminos que si funcionan:
  - `GET /products/search?q=<marca>&domain_id=...` — medido sobre 1000 productos de
    `q=Samsung`: **996 eran Samsung (99,6%)**. La contaminacion es minima y se limpia
    filtrando por el atributo BRAND del lado nuestro.
  - `POST /products/search` con `attributes` incluyendo BRAND — preciso, pero **exige 3
    atributos distintos** e **ignora `limit`** (devuelve siempre 10).
  Por eso conviene la via propia: los productos ya quedan persistidos con su `brand_id`,
  y filtrar por marca es un WHERE, no una llamada a ML.
- MLA tiene **32 categorias raiz y 457 de nivel 2** (~173M items).

## MCP

`.mcp.json` registra dos servers:

- **shadcn** (stdio): `npx shadcn@latest mcp -c frontend`. El `-c frontend` es obligatorio,
  el server resuelve `components.json` desde su cwd. Sirve para buscar componentes y bloques
  del registry antes de escribirlos a mano.
- **mercadolibre** (http), el oficial de Mercado Libre (`https://mcp.mercadolibre.com/mcp`),
para consultar la documentacion de la API de ML desde el IDE. Auth OAuth 2.1 con PKCE:
autenticar con `/mcp` en Claude Code. Es read-only sobre documentacion, no ejecuta llamadas
a la API de ML. Expone dos tools: `search_documentation` y `get_documentation_page`
(el parametro `language` solo acepta `en_us` | `es_ar` | `pt_br`).

El server tambien acepta un `Authorization: Bearer <access_token>` de la app de ML, ademas
del flujo OAuth: sirve para consultarlo por HTTP sin pasar por el cliente MCP.
