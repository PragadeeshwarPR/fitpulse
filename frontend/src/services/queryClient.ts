import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { ApiError } from "./api";
import { kv } from "./db";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Serve cached data immediately and when offline; refetch in background.
      networkMode: "offlineFirst",
      staleTime: 30_000,
      gcTime: 7 * 24 * 3_600_000,
      retry: (count, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
    mutations: { networkMode: "always" },
  },
});

/** Persists the query cache to IndexedDB so screens open with data while offline. */
export const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (k) => (await kv.get<string>(k)) ?? null,
    setItem: (k, v) => kv.set(k, v),
    removeItem: (k) => kv.del(k),
  },
  key: "rq-cache",
  throttleTime: 1000,
});

// Only persist per-user data that's useful offline (not AI chats or search results).
export const PERSIST_KEYS = new Set(["dashboard", "food", "water", "activities", "sleep", "body", "profile", "achievements", "analytics", "foodRecent", "foodFavorites"]);
