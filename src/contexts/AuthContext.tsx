import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { canUseViewMode, defaultViewMode } from '@/constants/permissions';
import { authService } from '@/services';
import { setTokenProvider, setTokenRefresher } from '@/services/http';
import { STORAGE_KEYS, secureStorage, storage } from '@/services/storage';
import { loadAll, resetDataStore } from '@/store';
import type { Session, User, ViewMode } from '@/types';

/**
 * passwordChange: yönetici tarafından verilen geçici şifreyle giriş yapıldı;
 * kullanıcı yeni şifresini belirleyene kadar diğer ekranlara erişemez.
 */
type AuthStatus = 'restoring' | 'signedOut' | 'passwordChange' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  viewMode: ViewMode;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  setViewMode(mode: ViewMode): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const [viewMode, setViewModeState] = useState<ViewMode>('driver');
  const session = useRef<Session | null>(null);

  const saveSession = useCallback(async (next: Session) => {
    session.current = next;
    await secureStorage.set(STORAGE_KEYS.session, JSON.stringify(next));
  }, []);

  const clearLocal = useCallback(async () => {
    session.current = null;
    await Promise.all([secureStorage.remove(STORAGE_KEYS.session), storage.remove(STORAGE_KEYS.viewMode)]).catch(() => {});
    resetDataStore();
    setUser(null);
    setStatus('signedOut');
  }, []);

  /** Oturum açıldıktan sonra verileri yükler ve doğru ekrana geçer. */
  const enter = useCallback(async (signedInUser: User, storedMode: ViewMode | null) => {
    setUser(signedInUser);
    if (signedInUser.mustChangePassword) {
      setStatus('passwordChange');
      return;
    }
    await loadAll(true);
    if (!session.current) return; // yükleme sırasında oturum düştü
    const mode = storedMode && canUseViewMode(signedInUser, storedMode) ? storedMode : defaultViewMode(signedInUser);
    await storage.setJSON(STORAGE_KEYS.viewMode, mode);
    setViewModeState(mode);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    setTokenProvider(() => session.current?.token ?? null);
    // Erişim token'ı süresi dolunca yenilenir; yenilenemezse oturum kapatılır.
    setTokenRefresher(async () => {
      const current = session.current;
      if (!current) return null;
      try {
        const next = await authService.refresh(current);
        if (session.current !== current) return session.current?.token ?? null; // bu arada çıkış/giriş yapıldı
        await saveSession(next);
        return next.token;
      } catch {
        if (session.current === current) await clearLocal();
        return null;
      }
    });
    (async () => {
      // Eski sürümlerin cihazda bıraktığı demo verileri temizle.
      storage.remove(STORAGE_KEYS.legacyMockDb).catch(() => {});
      try {
        const raw = await secureStorage.get(STORAGE_KEYS.session);
        const saved = raw ? (JSON.parse(raw) as Session) : null;
        if (saved) {
          session.current = saved; // restore isteği bu token ile yapılır
          const restored = await authService.restore(saved);
          if (restored && session.current) {
            await enter(restored, await storage.getJSON<ViewMode>(STORAGE_KEYS.viewMode));
            return;
          }
        }
      } catch {
        // bozuk oturum kaydı veya sunucuya ulaşılamadı: girişe yönlendir
      }
      session.current = null;
      setStatus('signedOut');
    })();
    return () => setTokenRefresher(null);
  }, [clearLocal, enter, saveSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await authService.login(email, password);
      await saveSession(result.session);
      await enter(result.user, null);
    },
    [enter, saveSession],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const result = await authService.changePassword(currentPassword, newPassword);
      await saveSession(result.session);
      await enter(result.user, await storage.getJSON<ViewMode>(STORAGE_KEYS.viewMode));
    },
    [enter, saveSession],
  );

  const signOut = useCallback(async () => {
    const current = session.current;
    await clearLocal();
    if (current) authService.logout(current).catch(() => {});
  }, [clearLocal]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      if (!user || !canUseViewMode(user, mode)) return;
      setViewModeState(mode);
      storage.setJSON(STORAGE_KEYS.viewMode, mode).catch(() => {});
    },
    [user],
  );

  const value = useMemo(
    () => ({ status, user, viewMode, signIn, signOut, changePassword, setViewMode }),
    [status, user, viewMode, signIn, signOut, changePassword, setViewMode],
  );
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
