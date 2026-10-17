import type { Catalog, GameState } from '../core';
import type { LoadResult, ProfileData, SavePort } from './contracts';
import { decodeSave, encodeSave, validateState } from './save-schema';

const emptyProfile = (): ProfileData => ({ seenCards: [], seenEnemies: [], history: [] });

/** True only inside the Tauri WebView; the browser build keeps using IndexedDB. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: call } = await import('@tauri-apps/api/core');
  return call<T>(command, args);
}

/**
 * Desktop save slot.
 *
 * Documents live in the platform app-data folder as plain JSON, so a player can
 * back up or move a run without touching a database. Writes go through the Rust
 * host, which writes a temp file and renames it into place; a crash mid-write
 * therefore leaves the previous valid document intact.
 */
export class DesktopSaveRepository implements SavePort {
  constructor(private catalog: Catalog) {}

  private async read(name: string): Promise<string | null> {
    return invoke<string | null>('store_read', { name });
  }

  async load(): Promise<LoadResult> {
    const current = await this.read('current');
    if (!current) return { state: null };
    try {
      return { state: this.import(current) };
    } catch (error) {
      const backup = await this.read('backup');
      if (backup) {
        try {
          return { state: this.import(backup), warning: '当前存档无法读取，已恢复最近一次有效备份。原存档仍保留。' };
        } catch { /* Both documents stay on disk for manual recovery. */ }
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async save(state: GameState): Promise<void> {
    validateState(state, this.catalog);
    const json = this.export(state);
    const current = await this.read('current');
    if (current) {
      let valid = false;
      try { this.import(current); valid = true; } catch { /* Keep the unreadable copy separately. */ }
      await invoke('store_write', { name: valid ? 'backup' : 'unreadable', contents: current });
    }
    await invoke('store_write', { name: 'current', contents: json });

    const profile = await this.loadProfile();
    profile.seenCards = [...new Set([...profile.seenCards, ...state.run.deck.map(card => card.definitionId), ...state.reward])];
    profile.seenEnemies = [...new Set([...profile.seenEnemies, ...(state.battle?.enemies.map(enemy => enemy.definitionId) ?? [])])];
    if (state.screen === 'won' || state.screen === 'lost') {
      const key = `${state.seed}:${state.revision}:${state.screen}`;
      if (!profile.history.some(entry => entry.key === key)) {
        profile.history.unshift({ key, seed: state.seed, won: state.screen === 'won', floors: state.run.visited.length, turns: state.run.stats.turns, at: new Date().toISOString() });
      }
      profile.history = profile.history.slice(0, 30);
    }
    await invoke('store_write', { name: 'profile', contents: JSON.stringify(profile) });
  }

  async loadProfile(): Promise<ProfileData> {
    try {
      const raw = await this.read('profile');
      if (!raw) return emptyProfile();
      const parsed = JSON.parse(raw) as Partial<ProfileData>;
      return {
        seenCards: Array.isArray(parsed.seenCards) ? parsed.seenCards : [],
        seenEnemies: Array.isArray(parsed.seenEnemies) ? parsed.seenEnemies : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
      };
    } catch { return emptyProfile(); }
  }

  export(state: GameState): string { return encodeSave(state); }
  import(text: string): GameState { return decodeSave(text, this.catalog); }
}

/** Native "save as" dialog; returns false when the player cancels. */
export async function desktopExportJson(contents: string, suggestedName: string): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({ defaultPath: suggestedName, filters: [{ name: '数字尖塔存档', extensions: ['json'] }] });
  if (!path) return false;
  await invoke('file_write', { path, contents });
  return true;
}

/** Native "open" dialog; returns null when the player cancels. */
export async function desktopImportJson(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ multiple: false, directory: false, filters: [{ name: '数字尖塔存档', extensions: ['json'] }] });
  const path = typeof selected === 'string' ? selected : Array.isArray(selected) ? selected[0] : null;
  if (!path) return null;
  return invoke<string>('file_read', { path });
}

/** Folder that holds the automatic save, so the settings panel can point at it. */
export async function desktopSaveLocation(): Promise<string | null> {
  try { return await invoke<string>('store_location'); } catch { return null; }
}
