import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, isNetworkError } from "../services/api";
import { outbox } from "../services/db";
import { persister, queryClient } from "../services/queryClient";
import type { User } from "../utils/types";

type AuthState = {
  user: User | null;
  onboarded: boolean;
  loading: boolean;
  /** True when we're showing a cached session because the server is unreachable. */
  offlineSession: boolean;
  setSession: (u: User, onboarded: boolean) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(AuthCtx);

const CACHE_KEY = "fp-session";
const readCache = (): { user: User; onboarded: boolean } | null => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offlineSession, setOfflineSession] = useState(false);

  const setSession = useCallback((u: User, ob: boolean) => {
    const prev = readCache();
    if (prev && prev.user.id !== u.id) {
      // Different account on this device: never show the previous user's cached data.
      queryClient.clear();
      outbox.clear();
    }
    setUser(u);
    setOnboarded(ob);
    setOfflineSession(false);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ user: u, onboarded: ob }));
    } catch {
      /* ignore */
    }
  }, []);

  const clear = useCallback(async () => {
    setUser(null);
    setOnboarded(false);
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    queryClient.clear();
    await persister.removeClient();
    await outbox.clear();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: User; onboarded: boolean }>("/auth/me");
      setSession(r.user, r.onboarded);
    } catch (e) {
      if (isNetworkError(e)) {
        // Offline: keep using the last known session so cached screens still open.
        const c = readCache();
        if (c) {
          setUser(c.user);
          setOnboarded(c.onboarded);
          setOfflineSession(true);
        }
      } else if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    await clear();
  }, [clear]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthCtx.Provider value={{ user, onboarded, loading, offlineSession, setSession, refresh, logout }}>{children}</AuthCtx.Provider>
  );
}
