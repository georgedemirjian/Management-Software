import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// Rewritten from shadcn's setState-in-effect version onto
// useSyncExternalStore: same behavior (false on the server, live media-query
// tracking on the client) without the extra effect render.
function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
}
