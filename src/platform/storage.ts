import Dexie, { type EntityTable } from 'dexie';
import type { Catalog, GameState } from '../core';
import type { LoadResult, ProfileData, SavePort } from './contracts';
import { decodeSave, encodeSave, validateState } from './save-schema';

const emptyProfile = (): ProfileData => ({ seenCards: [], seenEnemies: [], history: [] });
class GameDatabase extends Dexie {
  saves!: EntityTable<{ key: string; json: string }, 'key'>;
  profile!: EntityTable<{ key: string; data: ProfileData }, 'key'>;
  constructor() { super('number-spire'); this.version(1).stores({ saves: 'key', profile: 'key' }); }
}
export class IndexedDbSaveRepository implements SavePort {
  private db = new GameDatabase();
  constructor(private catalog: Catalog) {}
  async load(): Promise<LoadResult> {
    const current = await this.db.saves.get('current');
    if (!current) return { state: null };
    try { return { state: this.import(current.json) }; }
    catch (error) {
      const backup = await this.db.saves.get('backup');
      if (backup) {
        try { return { state: this.import(backup.json), warning: '当前存档无法读取，已恢复最近一次有效备份。原存档仍保留。' }; } catch { /* Keep both raw records. */ }
      }
      throw error;
    }
  }
  async save(state: GameState): Promise<void> {
    validateState(state, this.catalog);
    const json = this.export(state);
    await this.db.transaction('rw', [this.db.saves, this.db.profile], async () => {
      const current = await this.db.saves.get('current');
      if (current) {
        let valid = false;
        try { this.import(current.json); valid = true; } catch { /* Preserve unreadable source separately. */ }
        await this.db.saves.put({ key: valid ? 'backup' : 'unreadable', json: current.json });
      }
      await this.db.saves.put({ key: 'current', json });
      const profile = (await this.db.profile.get('local'))?.data ?? emptyProfile();
      profile.seenCards = [...new Set([...profile.seenCards, ...state.run.deck.map(c => c.definitionId), ...state.reward])];
      profile.seenEnemies = [...new Set([...profile.seenEnemies, ...(state.battle?.enemies.map(e => e.definitionId) ?? [])])];
      if (state.screen === 'won' || state.screen === 'lost') {
        const key = `${state.seed}:${state.revision}:${state.screen}`;
        if (!profile.history.some(h => h.key === key)) profile.history.unshift({ key, seed: state.seed, won: state.screen === 'won', floors: state.run.visited.length, turns: state.run.stats.turns, at: new Date().toISOString() });
        profile.history = profile.history.slice(0, 30);
      }
      await this.db.profile.put({ key: 'local', data: profile });
    });
  }
  async loadProfile() { return (await this.db.profile.get('local'))?.data ?? emptyProfile(); }
  export(state: GameState) { return encodeSave(state); }
  import(text: string) { return decodeSave(text, this.catalog); }
}
/** Useful for a native host, simulator, and deterministic session tests. */
export class MemorySaveRepository implements SavePort {
  private json: string | null = null;
  constructor(private catalog: Catalog) {}
  async load() { return { state: this.json ? this.import(this.json) : null }; }
  async save(state: GameState) { validateState(state, this.catalog); this.json = this.export(state); }
  async loadProfile() { return emptyProfile(); }
  export(state: GameState) { return encodeSave(state); }
  import(text: string) { return decodeSave(text, this.catalog); }
}
