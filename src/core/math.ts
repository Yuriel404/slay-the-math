import type { SlotRule } from './types';

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
export function matchesSlot(n: number, rule: SlotRule): boolean {
  if (!Number.isInteger(n) || n < 0) return false;
  switch (rule) {
    case 'prime': return isPrime(n);
    case 'even': return n % 2 === 0;
    case 'odd': return n % 2 === 1;
    case 'square': return Number.isInteger(Math.sqrt(n));
    case 'composite': return n > 3 && !isPrime(n);
    default: return true;
  }
}
export function factorPairs(n: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 2; i * i <= n; i++) if (n % i === 0) pairs.push([i, n / i]);
  return pairs;
}
export function boundedEffect(n: number, cap: number): number { return Math.min(cap, Math.max(0, Math.floor(n))); }
/** Reserved for future division cards; rounding occurs at the operation itself. */
export function divideFloor(a: number, b: number): number {
  if (b === 0) throw new RangeError('除数不能为 0');
  return Math.floor(a / b);
}
