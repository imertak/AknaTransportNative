import { DEMO_PASSWORD } from '@/data/seed';
import { createToken } from '@/utils/id';
import { isEmail } from '@/utils/validation';
import type { AuthService } from './contracts';
import { ServiceError } from './errors';
import { mockDb } from './mockDb';

export const mockAuthService: AuthService = {
  async login(email, password) {
    const normalized = email.trim().toLowerCase();
    const user = await mockDb.read((db) => db.users.find((u) => u.email === normalized) ?? null, 450);
    if (!user || password !== DEMO_PASSWORD) {
      throw new ServiceError('invalid_credentials', 'E-posta adresi veya şifre hatalı.');
    }
    if (!user.isActive) throw new ServiceError('forbidden', 'Hesabınız pasif durumda. Yöneticinizle iletişime geçin.');
    return { user, session: { token: createToken(), userId: user.id, issuedAt: new Date().toISOString() } };
  },

  async restore(session) {
    return mockDb.read((db) => db.users.find((u) => u.id === session.userId && u.isActive) ?? null, 0);
  },

  async logout() {
    // API aşamasında token iptali burada yapılacak.
  },

  async requestPasswordReset(email) {
    if (!isEmail(email)) throw new ServiceError('validation', 'Geçerli bir e-posta adresi girin.');
    // Güvenlik gereği kullanıcının var olup olmadığı açığa çıkarılmaz.
    await mockDb.read(() => null, 500);
  },

  async resetPassword() {
    throw new ServiceError('not_implemented', 'Demo modunda şifre sıfırlanamaz.');
  },

  async refresh(session) {
    return session;
  },

  async changePassword() {
    throw new ServiceError('not_implemented', 'Demo modunda şifre değiştirilemez.');
  },
};
