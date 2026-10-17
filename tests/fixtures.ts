import { createCatalog, catalog } from '../src/content/catalog';
import { applyCommand, createRun } from '../src/core';
import type { ActionDraft, Catalog, GameState } from '../src/core';

export function fixture(ids: string[], values: number[] = [], enemy = 'slime'): { state: GameState; content: Catalog } {
  const character = { ...catalog.characters.algebraist!, deck: ids };
  const content = createCatalog({ characters: { algebraist: character }, map: [{ id: 'test', kind: 'battle', name: '测试', description: '测试', enemies: [enemy] }, ...catalog.map.slice(1)] });
  const result = applyCommand(createRun({}, 'TEST', content), { type: 'enter-node' }, content);
  if (!result.accepted) throw new Error(result.reason);
  const state = result.state, b = state.battle!;
  b.hand = structuredClone(state.run.deck); b.drawPile = []; b.tokens = values.map(value => ({ id: `token-${state.run.nextId++}`, value, source: '测试', rerollable: false }));
  return { state, content };
}
export function draftFor(state: GameState, index = 0, options: ActionDraft['options'] = {}): ActionDraft {
  const card = state.battle!.hand[index]!;
  return { cardId: card.id, tokenIds: state.battle!.tokens.map(t => t.id), targetId: state.battle!.enemies[0]!.id, options };
}
export function runCommand(state: GameState, command: Parameters<typeof applyCommand>[1], content: Catalog): GameState {
  const result = applyCommand(state, command, content);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
