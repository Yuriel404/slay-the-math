import { enumerateDrafts, matchesSlot, previewAction } from '../src/core';
import type { Catalog, CommandBody, GameState } from '../src/core';

export type Policy = 'attack' | 'defense' | 'mixed';
/** Baseline heuristics for comparing balance changes; deliberately not an oracle. */
export function decide(state: GameState, catalog: Catalog, policy: Policy): CommandBody | null {
  if (state.screen === 'won' || state.screen === 'lost') return null;
  if (state.screen === 'map') return { type: 'enter-node' };
  if (state.screen === 'reward') {
    const priorities = policy === 'defense' ? ['even-wall', 'prime-blade', 'square', 'remainder', 'adjust'] : ['square', 'prime-blade', 'adjust', 'product', 'remainder'];
    return { type: 'choose-reward', definitionId: priorities.find(id => state.reward.includes(id)) ?? state.reward[0] ?? null };
  }
  if (state.screen === 'rest') {
    if (state.run.hp <= state.run.maxHp * .75) return { type: 'rest-heal' };
    const card = state.run.deck.find(c => !c.engraving && catalog.cards[c.definitionId]!.engravable && catalog.cards[c.definitionId]!.kind === 'attack');
    if (card) {
      const slot = catalog.cards[card.definitionId]!.slots.findIndex(s => matchesSlot(3, s.rule));
      if (slot >= 0) return { type: 'engrave-card', cardId: card.id, slot, value: 3 };
    }
    return { type: 'rest-heal' };
  }
  const battle = state.battle!;
  if (battle.phase === 'choice') return { type: 'discard-token', tokenId: [...battle.tokens].sort((a, b) => a.value - b.value)[0]!.id };
  const incoming = battle.enemies.filter(e => e.hp > 0).reduce((n, e) => n + e.intent.damage, 0);
  const candidates = battle.hand.flatMap(card => {
    const def = catalog.cards[card.definitionId]!;
    const modes = def.effect.params.operation === 'sum' ? ['attack', 'block'] as const : ['attack'] as const;
    return modes.flatMap(mode => enumerateDrafts(state, card.id, catalog, { mode, variable: 4, delta: 1 }).map(draft => {
      const preview = previewAction(state, draft, catalog);
      let score = -1;
      for (const effect of preview.effects) {
        if (effect.type === 'damage') {
          const hp = battle.enemies.find(e => e.id === effect.targetId)!.hp;
          score = Math.min(hp, effect.amount) * (policy === 'defense' ? .8 : 1) + (effect.amount >= hp ? 150 : 0);
        }
        if (effect.type === 'block') score = Math.min(Math.max(0, incoming - battle.block), effect.amount) * (policy === 'attack' ? .22 : policy === 'defense' ? 1.6 : .72);
        if (effect.type === 'generate') {
          const canSpendAfter = battle.hand.some(c => c.id !== card.id && ['attack', 'defense', 'transform'].includes(catalog.cards[c.definitionId]!.kind) && catalog.cards[c.definitionId]!.cost <= battle.energy - def.cost);
          score = def.effect.type === 'generate' ? 100 : canSpendAfter ? def.effect.type === 'variable' ? 30 : def.cost === 0 ? 12 : 2 : -1;
        }
        if (effect.type === 'draw') score = battle.energy > 1 ? 6 : 0;
        if (effect.type === 'power') score = 4;
        if (effect.type === 'store') score = .1 + preview.values[0]! / 100;
      }
      // Favor efficient attacks while preserving the lethal bonus.
      if (score > 0 && score < 100 && preview.effects.some(e => e.type === 'damage' || e.type === 'block')) score /= Math.max(1, def.cost);
      return { draft, score };
    }));
  }).sort((a, b) => b.score - a.score);
  return candidates[0] && candidates[0].score > 0 ? { type: 'play-card', draft: candidates[0].draft } : { type: 'end-turn' };
}
