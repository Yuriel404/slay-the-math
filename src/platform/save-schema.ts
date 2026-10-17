import { z } from 'zod';
import { matchesSlot, RULES_VERSION } from '../core';
import type { Catalog, GameState } from '../core';

const int = z.number().int().nonnegative();
const id = z.string().min(1).max(120);
const cardSchema = z.object({ id, definitionId: id, engraving: z.object({ slot: int, value: z.number().int().min(1).max(3) }).optional() });
const tokenSchema = z.object({ id, value: z.number().int(), source: id, rerollable: z.boolean() });
const eventSchema = z.object({ type: id, message: z.string().max(1000), value: z.number().optional(), targetId: id.optional(), turn: int.optional() });
const rngSchema = z.array(z.number().int().min(-2147483648).max(2147483647)).length(4).refine(v => v.some(n => n !== 0), '随机数状态无效');
const gameStateSchema = z.object({
  rulesVersion: int, contentVersion: id, seed: z.string().min(1).max(128), revision: int,
  rng: z.object({ map: rngSchema, battle: rngSchema, reward: rngSchema, event: rngSchema }),
  screen: z.enum(['map', 'battle', 'reward', 'rest', 'won', 'lost']),
  run: z.object({ characterId: id, hp: int, maxHp: z.number().int().positive(), gold: int,
    deck: z.array(cardSchema).min(1).max(200), relics: z.array(id).max(100), floor: int,
    visited: z.array(id).max(200), nextId: z.number().int().positive(),
    stats: z.object({ cardsPlayed: int, turns: int, damageDealt: int, damageTaken: int, battlesWon: int }) }),
  battle: z.object({
    phase: z.enum(['player', 'choice', 'victory', 'defeat']), turn: z.number().int().positive(), energy: int, block: int,
    hand: z.array(cardSchema).max(100), drawPile: z.array(cardSchema).max(200), discardPile: z.array(cardSchema).max(200),
    exhaustPile: z.array(cardSchema).max(200), powers: z.array(cardSchema).max(200),
    tokens: z.array(tokenSchema).max(200), storedTokens: z.array(tokenSchema).max(100),
    enemies: z.array(z.object({ id, definitionId: id, hp: int, maxHp: z.number().int().positive(), block: int,
      intent: z.object({ damage: int, formula: z.string().max(200), detail: z.string().max(500), factor: z.number().int().positive().optional(), phase: z.number().int().positive() }) })).min(1).max(20),
    registerUsed: z.boolean(), pendingChoice: z.object({ type: z.literal('overflow'), count: z.number().int().positive() }).nullable(),
  }).nullable(),
  reward: z.array(id).max(10), logs: z.array(eventSchema).max(150),
});

export function validateState(raw: unknown, catalog: Catalog): GameState {
  const parsed = gameStateSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`存档结构无效：${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`);
  const state: GameState = parsed.data;
  const fail = (message: string): never => { throw new Error(`存档校验失败：${message}`); };
  if (state.rulesVersion !== RULES_VERSION || state.contentVersion !== catalog.version) fail('规则或内容版本不兼容，原存档已保留');
  if (!catalog.characters[state.run.characterId] || state.run.relics.some(r => !catalog.relics[r])) fail('未知角色或遗物');
  if (state.run.hp > state.run.maxHp || state.run.floor > catalog.map.length || (state.screen !== 'won' && state.run.floor >= catalog.map.length)) fail('进度或生命越界');
  const deckIds = new Set(state.run.deck.map(c => c.id));
  if (deckIds.size !== state.run.deck.length) fail('卡牌身份重复');
  for (const card of state.run.deck) {
    const definition = catalog.cards[card.definitionId];
    if (!definition) fail('未知卡牌');
    if (card.engraving && (!definition!.engravable || !definition!.slots[card.engraving.slot] || !matchesSlot(card.engraving.value, definition!.slots[card.engraving.slot]!.rule))) fail('铭刻不符合槽位规则');
  }
  if (state.reward.some(c => !catalog.cards[c]) || new Set(state.reward).size !== state.reward.length) fail('奖励内容无效');
  if (state.screen === 'battle' && !state.battle) fail('缺少战斗状态');
  if (state.battle) {
    const b = state.battle, cards = [...b.hand, ...b.drawPile, ...b.discardPile, ...b.exhaustPile, ...b.powers];
    if (cards.length !== state.run.deck.length || new Set(cards.map(c => c.id)).size !== cards.length) fail('战斗卡牌不守恒');
    if (cards.some(c => !deckIds.has(c.id) || JSON.stringify(c) !== JSON.stringify(state.run.deck.find(d => d.id === c.id)))) fail('战斗卡牌与牌组不一致');
    const tokens = [...b.tokens, ...b.storedTokens];
    if (tokens.some(t => t.value < catalog.rules.numberMin || t.value > catalog.rules.numberMax)) fail('筹码数值越界');
    if (new Set(tokens.map(t => t.id)).size !== tokens.length) fail('筹码身份重复');
    if (b.enemies.some(e => !catalog.enemies[e.definitionId] || e.hp > e.maxHp) || new Set(b.enemies.map(e => e.id)).size !== b.enemies.length) fail('敌人状态无效');
    if (b.energy > catalog.rules.energy || b.hand.length > catalog.rules.handLimit) fail('战斗资源越界');
    if (state.screen === 'battle') {
      if (!['player', 'choice'].includes(b.phase)) fail('行动阶段不匹配');
      const overflow = Math.max(0, b.tokens.length - catalog.rules.poolCapacity);
      if ((overflow > 0) !== (b.phase === 'choice') || (b.pendingChoice?.count ?? 0) !== overflow) fail('弃数选择不匹配');
    }
  }
  const allIds = [...state.run.deck.map(c => c.id), ...(state.battle?.tokens ?? []).map(t => t.id), ...(state.battle?.storedTokens ?? []).map(t => t.id), ...(state.battle?.enemies ?? []).map(e => e.id)];
  if (allIds.some(item => Number(item.split('-').at(-1)) >= state.run.nextId)) fail('身份计数器无效');
  return state;
}

export interface SaveEnvelope { format: 'number-spire'; schemaVersion: number; savedAt: string; state: GameState }
export type SaveMigration = (raw: unknown) => unknown;
/** Register each old envelope version explicitly when introducing a new schema. */
export const saveMigrations = new Map<number, SaveMigration>();
export function encodeSave(state: GameState): string {
  return JSON.stringify({ format: 'number-spire', schemaVersion: 1, savedAt: new Date().toISOString(), state } satisfies SaveEnvelope, null, 2);
}
export function decodeSave(text: string, catalog: Catalog): GameState {
  if (text.length > 2_000_000) throw new Error('存档文件过大（上限 2 MB）');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('无法读取 JSON 存档'); }
  const header = z.object({ format: z.literal('number-spire'), schemaVersion: int, savedAt: z.string(), state: z.unknown() });
  let envelope = header.safeParse(raw);
  if (!envelope.success) throw new Error('这不是有效的数字尖塔存档');
  for (let step = 0; envelope.data.schemaVersion !== 1 && step < 10; step++) {
    const migration = saveMigrations.get(envelope.data.schemaVersion);
    if (!migration) throw new Error(`存档格式 v${envelope.data.schemaVersion} 尚不兼容，原文件未修改`);
    envelope = header.safeParse(migration(envelope.data));
    if (!envelope.success) throw new Error('存档迁移失败，原文件未修改');
  }
  if (envelope.data.schemaVersion !== 1) throw new Error('无法完成存档版本迁移');
  return validateState(envelope.data.state, catalog);
}
