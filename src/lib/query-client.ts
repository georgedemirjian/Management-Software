import { isServer, QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query client factory, following the official App Router pattern:
 * the server creates a fresh client per render pass (no state shared across
 * requests), while the browser reuses a singleton (no refetch storms when
 * React suspends and remounts the tree).
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A non-zero staleTime prevents data from refetching the moment it
        // hydrates on the client after SSR.
        staleTime: 30 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }

  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
