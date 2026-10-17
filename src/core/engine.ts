import { matchesSlot, boundedEffect } from './math';
import { createRandomStreams, shuffle } from './random';
import type { ActionDraft, BattleState, CardInstance, Catalog, GameCommand, GameEvent, GameState, PreviewResult, RunConfig, TransitionResult } from './types';

export const RULES_VERSION = 1;
const uid = (state: GameState, prefix: string) => `${prefix}-${state.run.nextId++}`;
const makeCard = (state: GameState, definitionId: string): CardInstance => ({ id: uid(state, 'card'), definitionId });
const emit = (events: GameEvent[], type: string, message: string, extra: Partial<GameEvent> = {}) => events.push({ type, message, ...extra });

export function createRun(config: RunConfig, seed: string, catalog: Catalog): GameState {
  const character = catalog.characters[config.characterId ?? 'algebraist'];
  if (!character) throw new Error('未知角色');
  if (!catalog.map.length) throw new Error('地图不能为空');
  const state: GameState = {
    rulesVersion: RULES_VERSION, contentVersion: catalog.version, seed, revision: 0,
    rng: createRandomStreams(seed), screen: 'map', battle: null, reward: [], logs: [],
    run: { characterId: character.id, hp: character.maxHp, maxHp: character.maxHp, gold: 0, deck: [],
      relics: [...character.relics], floor: 0, visited: [], nextId: 1,
      stats: { cardsPlayed: 0, turns: 0, damageDealt: 0, damageTaken: 0, battlesWon: 0 } },
  };
  state.run.deck = character.deck.map(id => makeCard(state, id));
  return state;
}

export function previewAction(state: GameState, draft: ActionDraft, catalog: Catalog): PreviewResult {
  const invalid = (reasons: string[], values: number[] = []): PreviewResult => ({ valid: false, reasons, formula: reasons[0] ?? '', effects: [], values, consumedTokenIds: [] });
  const battle = state.battle;
  if (state.screen !== 'battle' || !battle || battle.phase !== 'player') return invalid([battle?.pendingChoice ? '请先弃置超出容量的筹码' : '当前不是玩家行动阶段']);
  const card = battle.hand.find(c => c.id === draft.cardId);
  if (!card) return invalid(['这张卡牌已不在手中']);
  const definition = catalog.cards[card.definitionId];
  if (!definition) return invalid(['未找到卡牌定义']);
  const reasons: string[] = [], values: number[] = [], consumedTokenIds: string[] = [];
  if (battle.energy < definition.cost) reasons.push(`能量不足：需要 ${definition.cost}，当前 ${battle.energy}`);
  if (definition.oncePerTurn && battle.registerUsed) reasons.push('寄存器每回合只能使用一次');
  if (draft.tokenIds.length !== definition.slots.length) reasons.push('槽位数量不正确');
  definition.slots.forEach((slot, i) => {
    let value: number | undefined;
    if (card.engraving?.slot === i) {
      value = card.engraving.value;
      if (draft.tokenIds[i]) reasons.push('铭刻槽位无需放入筹码');
    } else {
      const tokenId = draft.tokenIds[i];
      const token = battle.tokens.find(t => t.id === tokenId);
      if (!token) { reasons.push(`请填入${slot.label === 'n' ? '数字' : slot.label}槽位`); return; }
      if (consumedTokenIds.includes(token.id)) reasons.push('同一枚筹码不能重复填入');
      consumedTokenIds.push(token.id); value = token.value;
    }
    if (value === undefined || value < catalog.rules.numberMin || value > catalog.rules.numberMax || !matchesSlot(value, slot.rule)) reasons.push(`槽位「${slot.label}」条件不满足`);
    values.push(value ?? 0);
  });
  const needsTarget = definition.kind === 'attack' && !(definition.effect.params.operation === 'sum' && draft.options.mode === 'block');
  const target = draft.targetId !== undefined ? battle.enemies.find(e => e.id === draft.targetId && e.hp > 0) : (battle.enemies.filter(e => e.hp > 0).length === 1 ? battle.enemies.find(e => e.hp > 0) : undefined);
  if (needsTarget && !target) reasons.push('请选择一个存活的敌人');
  if (reasons.length) return invalid([...new Set(reasons)], values);
  const handler = catalog.effects[definition.effect.type];
  if (!handler) return invalid([`未注册效果：${definition.effect.type}`]);
  const resolution = handler.resolve({ state, card, definition, values, draft, target, catalog });
  if (resolution.error) return invalid([resolution.error], values);
  for (const effect of resolution.effects) {
    if (effect.type === 'generate' && effect.values.some(n => !Number.isInteger(n) || n < catalog.rules.numberMin || n > catalog.rules.numberMax)) return invalid([`加工结果必须在 ${catalog.rules.numberMin}～${catalog.rules.numberMax} 之间，无法确认`], values);
  }
  return { valid: true, reasons: [], formula: resolution.formula, effects: resolution.effects, values, consumedTokenIds };
}

function generate(state: GameState, values: number[], source: string, events: GameEvent[]) {
  const battle = state.battle!;
  for (const value of values) battle.tokens.push({ id: uid(state, 'token'), value, source, rerollable: false });
  emit(events, 'numbers-generated', `${source}：获得 ${values.join('、')}`, { turn: battle.turn });
}
function checkOverflow(battle: BattleState, catalog: Catalog) {
  const count = battle.tokens.length - catalog.rules.poolCapacity;
  battle.pendingChoice = count > 0 ? { type: 'overflow', count } : null;
  battle.phase = count > 0 ? 'choice' : 'player';
}
function draw(state: GameState, count: number, catalog: Catalog, events: GameEvent[]) {
  const b = state.battle!;
  for (let i = 0; i < count; i++) {
    if (!b.drawPile.length && b.discardPile.length) {
      b.drawPile = shuffle(state, 'battle', b.discardPile); b.discardPile = [];
      emit(events, 'shuffle', '弃牌堆洗入抽牌堆');
    }
    const card = b.drawPile.pop();
    if (!card) break;
    if (b.hand.length >= catalog.rules.handLimit) { b.discardPile.push(card); emit(events, 'hand-overflow', '手牌已满，抽到的卡进入弃牌堆'); }
    else b.hand.push(card);
  }
}
function beginTurn(state: GameState, catalog: Catalog, events: GameEvent[]) {
  const b = state.battle!;
  b.block = 0; b.energy = catalog.rules.energy; b.registerUsed = false; b.phase = 'player';
  for (const id of state.run.relics) {
    const relic = catalog.relics[id];
    if (relic?.turnStartNumbers.length) generate(state, relic.turnStartNumbers, relic.name, events);
  }
  b.tokens.push(...b.storedTokens); b.storedTokens = [];
  draw(state, catalog.rules.draw, catalog, events);
  for (const enemy of b.enemies) {
    const definition = catalog.enemies[enemy.definitionId]!;
    enemy.intent = catalog.enemyBehaviors[definition.behavior]!.intent(enemy, b.turn, definition);
  }
  state.run.stats.turns++;
  emit(events, 'turn-started', `第 ${b.turn} 回合开始`, { turn: b.turn });
  checkOverflow(b, catalog);
}
function enterBattle(state: GameState, catalog: Catalog, events: GameEvent[]) {
  const node = catalog.map[state.run.floor]!;
  state.battle = { phase: 'player', turn: 1, energy: 0, block: 0, hand: [],
    drawPile: shuffle(state, 'battle', structuredClone(state.run.deck)), discardPile: [], exhaustPile: [], powers: [],
    tokens: [], storedTokens: [], enemies: [], registerUsed: false, pendingChoice: null };
  state.battle.enemies = (node.enemies ?? []).map(id => {
    const definition = catalog.enemies[id]!;
    return { id: uid(state, 'enemy'), definitionId: id, hp: definition.hp, maxHp: definition.hp, block: 0,
      intent: { damage: 0, formula: '', detail: '', phase: 1 } };
  });
  state.screen = 'battle';
  emit(events, 'battle-started', `进入 ${node.name}`);
  beginTurn(state, catalog, events);
}
function damageEnemy(state: GameState, enemyId: string, amount: number, events: GameEvent[]) {
  const enemy = state.battle!.enemies.find(e => e.id === enemyId && e.hp > 0);
  if (!enemy) return;
  const blocked = Math.min(enemy.block, amount); enemy.block -= blocked;
  const damage = Math.min(enemy.hp, amount - blocked); enemy.hp -= damage;
  state.run.stats.damageDealt += damage;
  emit(events, 'damage-dealt', `造成 ${damage} 点伤害${blocked ? `（抵挡 ${blocked}）` : ''}`, { targetId: enemy.id, value: damage, turn: state.battle!.turn });
}
function checkVictory(state: GameState, catalog: Catalog, events: GameEvent[]): boolean {
  if (state.battle!.enemies.some(e => e.hp > 0)) return false;
  state.battle!.phase = 'victory'; state.battle!.pendingChoice = null;
  state.run.stats.battlesWon++;
  const node = catalog.map[state.run.floor]!;
  state.run.visited.push(node.id); state.run.gold += node.kind === 'boss' ? 35 : 15;
  if (node.kind === 'boss' || state.run.floor === catalog.map.length - 1) { state.screen = 'won'; state.reward = []; }
  else { state.screen = 'reward'; state.reward = shuffle(state, 'reward', [...new Set(catalog.rewardPool)]).slice(0, 3); }
  emit(events, 'battle-won', '战斗胜利', { turn: state.battle!.turn });
  return true;
}
function nextNode(state: GameState, catalog: Catalog) {
  state.run.floor++; state.battle = null; state.reward = [];
  state.screen = state.run.floor >= catalog.map.length ? 'won' : 'map';
}

export function applyCommand(original: GameState, command: GameCommand, catalog: Catalog): TransitionResult {
  const refuse = (reason: string): TransitionResult => ({ accepted: false, state: original, events: [], reason });
  if (command.expectedRevision !== undefined && command.expectedRevision !== original.revision) return refuse('状态已经更新，请勿重复确认');
  // Validate against the original before cloning. Invalid commands cannot advance RNG.
  let preview: PreviewResult | undefined;
  if (command.type === 'play-card') {
    preview = previewAction(original, command.draft, catalog);
    if (!preview.valid) return refuse(preview.reasons.join('；'));
  }
  const state = structuredClone(original), events: GameEvent[] = [];
  const b = state.battle;
  switch (command.type) {
    case 'enter-node': {
      if (state.screen !== 'map') return refuse('当前无法进入地图节点');
      const node = catalog.map[state.run.floor];
      if (!node) return refuse('没有可进入的节点');
      if (node.kind === 'rest') { state.screen = 'rest'; emit(events, 'rest-entered', `抵达 ${node.name}`); }
      else enterBattle(state, catalog, events);
      break;
    }
    case 'play-card': {
      const card = b!.hand.find(c => c.id === command.draft.cardId)!;
      const definition = catalog.cards[card.definitionId]!;
      const consumed = b!.tokens.filter(t => preview!.consumedTokenIds.includes(t.id));
      b!.hand = b!.hand.filter(c => c.id !== card.id);
      b!.tokens = b!.tokens.filter(t => !preview!.consumedTokenIds.includes(t.id));
      b!.energy -= definition.cost; state.run.stats.cardsPlayed++;
      emit(events, 'card-played', `${definition.name} · ${preview!.formula}`, { turn: b!.turn });
      for (const effect of preview!.effects) {
        switch (effect.type) {
          case 'damage': damageEnemy(state, effect.targetId, effect.amount, events); break;
          case 'block': b!.block = boundedEffect(b!.block + effect.amount, Number.MAX_SAFE_INTEGER); emit(events, 'block-gained', `获得 ${effect.amount} 点护甲`, { value: effect.amount }); break;
          case 'generate': generate(state, effect.values, effect.source, events); break;
          case 'draw': draw(state, effect.amount, catalog, events); break;
          case 'store': {
            const token = consumed.find(t => t.id === effect.tokenId)!;
            b!.storedTokens.push(token); b!.registerUsed = true;
            emit(events, 'number-stored', `暂存数字 ${token.value}`); break;
          }
          case 'power': emit(events, 'power-activated', `${definition.name} 生效`); break;
        }
      }
      if (definition.kind === 'power') b!.powers.push(card);
      else if (definition.exhaust) b!.exhaustPile.push(card);
      else b!.discardPile.push(card);
      if (!checkVictory(state, catalog, events)) checkOverflow(b!, catalog);
      break;
    }
    case 'discard-token': {
      if (state.screen !== 'battle' || b?.phase !== 'choice' || !b.pendingChoice) return refuse('当前无需弃数');
      const token = b.tokens.find(t => t.id === command.tokenId);
      if (!token) return refuse('这枚筹码已不存在');
      b.tokens = b.tokens.filter(t => t.id !== token.id);
      emit(events, 'number-discarded', `弃置数字 ${token.value}`); checkOverflow(b, catalog); break;
    }
    case 'end-turn': {
      if (state.screen !== 'battle' || b?.phase !== 'player') return refuse('请先完成当前选择');
      const stacks = b.powers.filter(c => catalog.cards[c.definitionId]?.effect.type === 'remainder').length;
      if (stacks) {
        const damage = boundedEffect(stacks * b.tokens.length, catalog.rules.effectCap);
        emit(events, 'turn-end-effect', `余项：每个敌人受到 ${damage} 点伤害`);
        for (const enemy of b.enemies) damageEnemy(state, enemy.id, damage, events);
        if (checkVictory(state, catalog, events)) break;
      }
      b.discardPile.push(...b.hand); b.hand = []; b.tokens = [];
      for (const enemy of b.enemies.filter(e => e.hp > 0)) {
        const blocked = Math.min(b.block, enemy.intent.damage); b.block -= blocked;
        const damage = Math.min(state.run.hp, enemy.intent.damage - blocked);
        state.run.hp -= damage; state.run.stats.damageTaken += damage;
        emit(events, 'damage-taken', `敌方攻击 ${enemy.intent.damage} · 抵挡 ${blocked} · 失去 ${damage} 生命`, { value: damage, targetId: enemy.id, turn: b.turn });
        if (state.run.hp <= 0) { b.phase = 'defeat'; state.screen = 'lost'; emit(events, 'run-lost', '本次攀登结束'); break; }
      }
      if (state.screen !== 'lost') { b.turn++; beginTurn(state, catalog, events); }
      break;
    }
    case 'choose-reward': {
      if (state.screen !== 'reward') return refuse('当前没有卡牌奖励');
      if (command.definitionId !== null && !state.reward.includes(command.definitionId)) return refuse('该卡牌不在奖励中');
      if (command.definitionId) { state.run.deck.push(makeCard(state, command.definitionId)); emit(events, 'reward-chosen', `获得卡牌 ${catalog.cards[command.definitionId]!.name}`); }
      else emit(events, 'reward-skipped', '跳过卡牌奖励');
      nextNode(state, catalog); break;
    }
    case 'rest-heal': {
      if (state.screen !== 'rest') return refuse('当前不在休息点');
      const healed = Math.min(state.run.maxHp - state.run.hp, Math.floor(state.run.maxHp * 0.3));
      state.run.hp += healed; state.run.visited.push(catalog.map[state.run.floor]!.id);
      emit(events, 'healed', `休息：回复 ${healed} 点生命`, { value: healed }); nextNode(state, catalog); break;
    }
    case 'rest-remove': {
      if (state.screen !== 'rest') return refuse('当前不在休息点');
      if (state.run.gold < catalog.rules.removeCost) return refuse(`金币不足：移除需要 ${catalog.rules.removeCost}，当前 ${state.run.gold}`);
      const card = state.run.deck.find(c => c.id === command.cardId);
      if (!card) return refuse('这张卡牌不在牌组中');
      if (state.run.deck.length <= catalog.rules.minDeck) return refuse(`牌组至少保留 ${catalog.rules.minDeck} 张卡牌`);
      state.run.deck = state.run.deck.filter(c => c.id !== command.cardId);
      state.run.gold -= catalog.rules.removeCost;
      state.run.visited.push(catalog.map[state.run.floor]!.id);
      emit(events, 'card-removed', `移除 ${catalog.cards[card.definitionId]!.name}（−${catalog.rules.removeCost} 金币）`, { value: catalog.rules.removeCost });
      nextNode(state, catalog); break;
    }
    case 'engrave-card': {
      if (state.screen !== 'rest') return refuse('铭刻只能在休息点进行');
      const card = state.run.deck.find(c => c.id === command.cardId);
      if (!card || card.engraving) return refuse('此卡牌无法再次铭刻');
      const def = catalog.cards[card.definitionId]!, slot = def.slots[command.slot];
      if (!def.engravable || !slot) return refuse('只能铭刻攻防卡的有效槽位');
      if (![1, 2, 3].includes(command.value) || !matchesSlot(command.value, slot.rule)) return refuse('铭刻值须为符合槽位条件的 1、2 或 3');
      card.engraving = { slot: command.slot, value: command.value };
      state.run.visited.push(catalog.map[state.run.floor]!.id);
      emit(events, 'card-engraved', `${def.name} 的第 ${command.slot + 1} 槽铭刻 ${command.value}`); nextNode(state, catalog); break;
    }
    default: return refuse('未知游戏命令');
  }
  state.revision++; state.logs = [...state.logs, ...events].slice(-150);
  return { accepted: true, state, events };
}

/** Enumerate legal physical token assignments without mutating state or RNG. */
export function enumerateDrafts(state: GameState, cardId: string, catalog: Catalog, options: ActionDraft['options'] = {}): ActionDraft[] {
  const card = state.battle?.hand.find(c => c.id === cardId);
  if (!card) return [];
  const definition = catalog.cards[card.definitionId]!, drafts: ActionDraft[] = [];
  const targets = definition.kind === 'attack' && options.mode !== 'block' ? state.battle!.enemies.filter(e => e.hp > 0).map(e => e.id) : [undefined];
  function fill(tokenIds: (string | null)[], slotIndex: number) {
    if (slotIndex === definition.slots.length) {
      for (const targetId of targets) {
        const draft: ActionDraft = { cardId, tokenIds, targetId, options };
        if (previewAction(state, draft, catalog).valid) drafts.push(draft);
      }
      return;
    }
    if (card!.engraving?.slot === slotIndex) { fill([...tokenIds, null], slotIndex + 1); return; }
    for (const token of state.battle!.tokens) {
      if (!tokenIds.includes(token.id) && matchesSlot(token.value, definition.slots[slotIndex]!.rule)) fill([...tokenIds, token.id], slotIndex + 1);
    }
  }
  fill([], 0); return drafts;
}
