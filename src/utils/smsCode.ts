const KEYWORD = /(kod|şifre|sifre|parola|code|password)/i;

/**
 * SMS metninden doğrulama kodunu çıkarır. Aday: 4-10 harf/rakamdan oluşan ve en az bir rakam içeren
 * kelime (API'deki SMS kodu kuralıyla aynı). Telefon numarası gibi daha uzun sayılar elenir.
 * "kod/şifre" kelimesinden sonraki ilk aday, yoksa metindeki ilk aday alınır.
 */
export function extractSmsCode(message: string): string | null {
  const candidates = [...message.matchAll(/[A-Za-z0-9]+/g)].filter((m) => m[0].length >= 4 && m[0].length <= 10 && /\d/.test(m[0]));
  if (candidates.length === 0) return null;
  const kw = KEYWORD.exec(message);
  const after = kw ? candidates.find((m) => (m.index ?? 0) > kw.index) : undefined;
  return (after ?? candidates[0])[0];
}
