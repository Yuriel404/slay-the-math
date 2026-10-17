import type { GameEvent, GameState } from '../core';

export interface ProfileData { seenCards: string[]; seenEnemies: string[]; history: { key: string; seed: string; won: boolean; floors: number; turns: number; at: string }[] }
export interface LoadResult { state: GameState | null; warning?: string }
/** Implement this port for cloud saves, a native shell or in-memory testing. */
export interface SavePort {
  load(): Promise<LoadResult>;
  save(state: GameState): Promise<void>;
  loadProfile(): Promise<ProfileData>;
  export(state: GameState): string;
  import(text: string): GameState;
}
/** Presentation consumes events; it never changes battle results. */
export interface AudioPort { unlock(): Promise<void>; play(event: GameEvent): void; setEnabled(enabled: boolean): void }
export interface EventPort { publish(events: GameEvent[]): void; subscribe(listener: (event: GameEvent) => void): () => void }
export class GameEventBus implements EventPort {
  private listeners = new Set<(event: GameEvent) => void>();
  publish(events: GameEvent[]) { for (const event of events) for (const listener of this.listeners) listener(event); }
  subscribe(listener: (event: GameEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}
