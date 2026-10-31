import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { canUseViewMode, defaultViewMode } from '@/constants/permissions';
import { authService } from '@/services';
import { setTokenProvider } from '@/services/http';
import { STORAGE_KEYS, secureStorage, storage } from '@/services/storage';
import { loadAll, resetDataStore } from '@/store';
import type { Session, User, ViewMode } from '@/types';

type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  viewMode: ViewMode;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  setViewMode(mode: ViewMode): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const [viewMode, setViewModeState] = useState<ViewMode>('driver');
  const session = useRef<Session | null>(null);

  useEffect(() => {
    setTokenProvider(() => session.current?.token ?? null);
    (async () => {
      try {
        const raw = await secureStorage.get(STORAGE_KEYS.session);
        const saved = raw ? (JSON.parse(raw) as Session) : null;
        const restored = saved ? await authService.restore(saved) : null;
        if (saved && restored) {
          session.current = saved;
          const storedMode = await storage.getJSON<ViewMode>(STORAGE_KEYS.viewMode);
          await loadAll();
          setUser(restored);
          setViewModeState(storedMode && canUseViewMode(restored, storedMode) ? storedMode : defaultViewMode(restored));
          setStatus('signedIn');
          return;
        }
      } catch {
        // bozuk oturum kaydı: girişe yönlendir
      }
      setStatus('signedOut');
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    session.current = result.session;
    await secureStorage.set(STORAGE_KEYS.session, JSON.stringify(result.session));
    await loadAll();
    const mode = defaultViewMode(result.user);
    await storage.setJSON(STORAGE_KEYS.viewMode, mode);
    setUser(result.user);
    setViewModeState(mode);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    const current = session.current;
    session.current = null;
    await Promise.all([secureStorage.remove(STORAGE_KEYS.session), storage.remove(STORAGE_KEYS.viewMode)]);
    if (current) authService.logout(current).catch(() => {});
    resetDataStore();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      if (!user || !canUseViewMode(user, mode)) return;
      setViewModeState(mode);
      storage.setJSON(STORAGE_KEYS.viewMode, mode).catch(() => {});
    },
    [user],
  );

  const value = useMemo(() => ({ status, user, viewMode, signIn, signOut, setViewMode }), [status, user, viewMode, signIn, signOut, setViewMode]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Oturum açmış kullanıcıyı döndürür; korumalı ekranlarda kullanılır. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser requires a signed-in user');
  return user;
}
