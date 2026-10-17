import { xoroshiro128plus, uniformIntDistribution } from 'pure-rand';
import type { GameState, RandomStream } from './types';

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h | 0;
}
export function createRandomStreams(seed: string): GameState['rng'] {
  return Object.fromEntries(['map', 'battle', 'reward', 'event'].map(stream =>
    [stream, [...xoroshiro128plus(hashSeed(`${seed}:${stream}`)).getState!()]])) as GameState['rng'];
}
export function randomInt(state: GameState, stream: RandomStream, min: number, max: number): number {
  const rng = xoroshiro128plus.fromState(state.rng[stream]);
  const [value, next] = uniformIntDistribution(min, max, rng);
  state.rng[stream] = [...next.getState!()];
  return value;
}
export function shuffle<T>(state: GameState, stream: RandomStream, values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(state, stream, 0, i);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
