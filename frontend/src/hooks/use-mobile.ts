import * as React from "react"

const MOBILE_BREAKPOINT = 768

// El hook que genera shadcn arranca el estado dentro de un useEffect, y la
// regla react-hooks/set-state-in-effect lo marca como error. useSyncExternalStore
// hace lo mismo sin setState: en el servidor devuelve false y en el navegador
// lee el ancho real ya en el primer render.
function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}
