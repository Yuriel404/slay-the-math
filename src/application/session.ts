import { create } from 'zustand';
import { applyCommand, createRun } from '../core';
import type { Catalog, CommandBody, GameEvent, GameState } from '../core';
import type { EventPort, ProfileData, SavePort } from '../platform/contracts';

interface SessionState {
  game: GameState | null; pending: { game: GameState; events: GameEvent[] } | null;
  initialized: boolean; busy: boolean; saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  error: string | null; notice: string | null; profile: ProfileData;
  initialize(): Promise<void>; start(seed: string): Promise<boolean>;
  dispatch(command: CommandBody): Promise<boolean>; retrySave(): Promise<boolean>;
  importSave(text: string): Promise<boolean>; exportSave(): string | null; clearNotice(): void;
}
export function createSession(catalog: Catalog, saves: SavePort, bus: EventPort) {
  return create<SessionState>((set, get) => {
    const persist = async (game: GameState, events: GameEvent[]): Promise<boolean> => {
      set({ busy: true, saveStatus: 'saving', error: null, pending: { game, events } });
      try {
        await saves.save(game);
        // Random draws and rewards only become visible after durable storage succeeds.
        set({ game, pending: null, busy: false, saveStatus: 'saved' });
        bus.publish(events);
        try { set({ profile: await saves.loadProfile() }); } catch { /* Gameplay save remains valid. */ }
        return true;
      } catch (error) {
        set({ busy: false, saveStatus: 'error', error: `保存失败：${error instanceof Error ? error.message : String(error)}。待保存进度已保留，请重试或导出。` });
        return false;
      }
    };
    return {
      game: null, pending: null, initialized: false, busy: false, saveStatus: 'idle', error: null, notice: null,
      profile: { seenCards: [], seenEnemies: [], history: [] },
      async initialize() {
        if (get().initialized || get().busy) return;
        set({ busy: true });
        try {
          const loaded = await saves.load();
          set({ game: loaded.state, notice: loaded.warning ?? null, saveStatus: loaded.state ? 'saved' : 'idle' });
          set({ profile: await saves.loadProfile() });
        } catch (error) { set({ error: `读取存档失败：${error instanceof Error ? error.message : String(error)}` }); }
        finally { set({ initialized: true, busy: false }); }
      },
      async start(seed) {
        if (get().busy || get().pending) return false;
        const cleanSeed = seed.trim() || 'NUMBER-SPIRE';
        return persist(createRun({}, cleanSeed.slice(0, 128), catalog), []);
      },
      async dispatch(command) {
        const { game, busy, pending } = get();
        if (!game || busy || pending) return false;
        const result = applyCommand(game, { ...command, expectedRevision: game.revision }, catalog);
        if (!result.accepted) { set({ notice: result.reason }); return false; }
        return persist(result.state, result.events);
      },
      async retrySave() { const pending = get().pending; return pending && !get().busy ? persist(pending.game, pending.events) : false; },
      async importSave(text) {
        if (get().busy || get().pending) return false;
        try { const state = saves.import(text); return persist(state, []); }
        catch (error) { set({ notice: error instanceof Error ? error.message : String(error) }); return false; }
      },
      exportSave() { const state = get().pending?.game ?? get().game; return state ? saves.export(state) : null; },
      clearNotice() { set({ notice: null }); },
    };
  });
}
