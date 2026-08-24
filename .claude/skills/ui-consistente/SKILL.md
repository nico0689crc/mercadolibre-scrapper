---
name: ui-consistente
description: Reglas de UI para el frontend de scrapper-products. Usar SIEMPRE antes de crear o editar cualquier archivo .tsx en frontend/src, agregar un componente, o tocar globals.css. Impone shadcn/ui nativo sin estilos propios.
---

# UI consistente — scrapper-products

Regla que manda sobre todo lo demas: **la UI se arma con componentes shadcn/ui nativos.
No se escriben estilos propios.** Si algo no se puede resolver con un componente de shadcn
mas sus variantes, la respuesta es buscar el componente que falta en el registry, no inventar CSS.

## Antes de escribir el primer JSX

1. Fijate que hay instalado: `ls frontend/src/components/ui/`
2. Si falta algo, buscalo en el registry con el **MCP de shadcn** (`search_items_in_registries`,
   `list_items_in_registries`, `get_item_examples_from_registries`) — no lo escribas a mano.
3. Instalalo con el CLI, nunca copiando codigo:
   ```bash
   cd frontend && npx shadcn@latest add <componente>
   ```
4. Recien ahi escribi la pagina.

El proyecto usa el preset **`radix-nova`** (primitivas Radix, base color `neutral`, iconos
`lucide-react`, fuente Geist). Esta declarado en `frontend/components.json` — no lo cambies.

## Prohibido

- **Archivos `.css` nuevos.** El unico CSS del proyecto es `frontend/src/app/globals.css`,
  y ahi solo viven los tokens que genero shadcn. No se agregan reglas a mano.
- **`style={{ ... }}` inline.** Sin excepciones.
- **Valores arbitrarios de Tailwind**: nada de `w-[347px]`, `text-[13px]`, `bg-[#1a1a1a]`,
  `p-[7px]`. Si necesitas un valor que no esta en la escala, el layout esta mal planteado.
- **Colores crudos**: nunca `text-white`, `bg-black`, `text-gray-500`, `border-zinc-200`,
  ni hex. Rompen el tema oscuro.
- **Reescribir los archivos de `components/ui/`** para cambiar como se ven. Son la base
  compartida: si un caso necesita otra pinta, usa las `variant` y `size` que ya expone el
  componente, o composicion.
- **Librerias de UI ajenas** (MUI, Chakra, Bootstrap, styled-components, emotion).

## Colores: solo tokens semanticos

| Uso | Clases |
|---|---|
| Fondo de pagina | `bg-background text-foreground` |
| Superficie elevada | `bg-card text-card-foreground` |
| Texto secundario | `text-muted-foreground` |
| Fondo apagado | `bg-muted` |
| Acento / hover | `bg-accent text-accent-foreground` |
| Accion primaria | `bg-primary text-primary-foreground` |
| Destructivo | `bg-destructive text-white` |
| Bordes | `border-border`, inputs `border-input` |
| Foco | `ring-ring` |

Todos se adaptan solos a claro/oscuro. Un color fuera de esta tabla es un bug.

## Espaciado y tamaños

Escala de Tailwind, y en la practica casi siempre estos: `gap-2 gap-4 gap-6`,
`p-4 p-6`, `space-y-4 space-y-6`. Anchos por contenedor (`max-w-5xl mx-auto`), no por pixel.
Layout con `flex` y `grid`, nunca con margenes negativos ni posiciones absolutas para acomodar.

## Composicion por tipo de pantalla

- **Listado** → `Table` dentro de `Card`. Si la tabla necesita orden, filtro o paginado,
  no lo escribas: pedile al MCP el bloque `data-table` y sus ejemplos.
- **Metricas** → `Card` con `CardHeader`/`CardTitle`/`CardContent` en un `grid`.
- **Detalle** → `Card` + `Separator` + `Badge` para estados.
- **Jerarquia / navegacion** → `Breadcrumb` para el path, `Sidebar` para el menu.
- **Carga** → `Skeleton` con la forma del contenido real. Nunca un spinner suelto ni "Cargando...".
- **Vacio** → `Card` con titulo, una linea de explicacion y el `Button` de la accion que lo resuelve.
- **Error** → `Alert` con `variant="destructive"`.
- **Feedback de una accion** → `toast` de `sonner` (el `Toaster` ya esta en el layout raiz).
- **Accion peligrosa o lenta** → `AlertDialog` para confirmar.

## Trampas de anidado que rompen la hidratacion

Varios componentes de shadcn renderizan tags con reglas estrictas de HTML. Anidarlos mal no
falla en el build: falla en el browser con `<x> cannot be a descendant of <y>` y rompe la
hidratacion.

- **`BreadcrumbSeparator` es un `<li>`, igual que `BreadcrumbItem`.** Van como **hermanos**
  dentro del `BreadcrumbList`, nunca uno adentro del otro. Al mapear, envolve el par en un
  `<Fragment key={...}>`:
  ```tsx
  <Fragment key={step.id}>
    <BreadcrumbSeparator />
    <BreadcrumbItem>…</BreadcrumbItem>
  </Fragment>
  ```
- `CardDescription` y `AlertDescription` son `<p>`: no metas `<div>` ni otro `<p>` adentro.
- `Button asChild` con un `<Link>` adentro esta bien; `<Button>` dentro de `<Button>` o
  `<Link>` dentro de `<Link>` no.

Para verificarlo sin abrir el browser, curlea la pagina y busca el tag repetido sin cerrar.

## Server Components primero

El proyecto es App Router con SSR. Los datos se leen en el Server Component usando
`frontend/src/lib/api.ts`. `"use client"` se pone **solo** en el componente que realmente
necesita estado o eventos, lo mas abajo posible en el arbol, no en la pagina entera.

## Iconos

Solo `lucide-react`. Tamaño `size-4` dentro de botones y celdas, `size-5` en titulos.
Un icono decorativo lleva `aria-hidden="true"`; uno que es la unica etiqueta de un boton
necesita `sr-only` con el texto.

## Checklist antes de dar por terminada una pantalla

- [ ] `grep -rn "style={{\|#[0-9a-fA-F]\{6\}\|text-white\|bg-black\|text-gray-\|-\[" frontend/src` no devuelve nada nuevo
- [ ] Todo componente visual sale de `@/components/ui/*`
- [ ] Se ve bien en claro y en oscuro
- [ ] Tiene estado de carga, vacio y error
- [ ] La tabla ancha scrollea sola, la pagina no scrollea horizontal
- [ ] No hay anidados invalidos (`li` en `li`, `p` en `p`, `a` en `a`) en el HTML renderizado
- [ ] `cd frontend && npm run build && npx eslint` pasan
