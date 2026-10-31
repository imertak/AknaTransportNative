export function createId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function createToken(): string {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
}

/** "AKN", 2026, 7 -> "AKN-2026-0007" */
export function sequenceNo(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}
