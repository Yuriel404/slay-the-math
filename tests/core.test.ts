import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { catalog, createCatalog } from '../src/content/catalog';
import { applyCommand, boundedEffect, createRun, divideFloor, enumerateDrafts, factorPairs, forecastIntents, intentAt, isPrime, matchesSlot, previewAction } from '../src/core';
import { validateState } from '../src/platform/save-schema';
import { decide } from '../tools/policies';
import { draftFor, fixture, runCommand } from './fixtures';

describe('数学与槽位边界', () => {
  it('正确区分零、质数、合数、奇偶与平方数', () => {
    expect([0, 1, 2, 3, 4, 97].map(isPrime)).toEqual([false, false, true, true, false, true]);
    expect(matchesSlot(0, 'even')).toBe(true); expect(matchesSlot(0, 'square')).toBe(true);
    expect(matchesSlot(1, 'composite')).toBe(false); expect(matchesSlot(4, 'composite')).toBe(true);
    expect(matchesSlot(-1, 'any')).toBe(false); expect(matchesSlot(1.5, 'any')).toBe(false);
    expect(factorPairs(12)).toEqual([[2, 6], [3, 4]]);
  });
  it('除法在运算步骤取整，除零明确拒绝', () => { expect(divideFloor(7, 2)).toBe(3); expect(() => divideFloor(2, 0)).toThrow('除数'); });
  it('最终修饰统一取整并遵守上限', () => { expect(boundedEffect(-2, 99)).toBe(0); expect(boundedEffect(3.9, 99)).toBe(3); expect(boundedEffect(1000, 99)).toBe(99); });
});

describe('筹码、预览与命令', () => {
  it('相同数值的独立筹码可以分别消费，同一身份不能重复', () => {
    const { state, content } = fixture(['product'], [3, 3]);
    const draft = draftFor(state), preview = previewAction(state, draft, content);
    expect(preview.valid).toBe(true); expect(preview.effects[0]).toMatchObject({ amount: 9 });
    const duplicate = { ...draft, tokenIds: [draft.tokenIds[0]!, draft.tokenIds[0]!] };
    const bad = applyCommand(state, { type: 'play-card', draft: duplicate }, content);
    expect(bad.accepted).toBe(false); expect(bad.state).toBe(state);
    const next = runCommand(state, { type: 'play-card', draft }, content);
    expect(next.battle!.tokens).toHaveLength(0); expect(next.battle!.enemies[0]!.hp).toBe(15);
  });
  it('预览与取消不修改资源或随机数，非法命令也不修改状态', () => {
    const { state, content } = fixture(['strike'], [3]); const before = structuredClone(state);
    previewAction(state, draftFor(state), content); expect(state).toEqual(before);
    const bad = applyCommand(state, { type: 'play-card', draft: { ...draftFor(state), tokenIds: [] } }, content);
    expect(bad.state).toBe(state); expect(state).toEqual(before);
  });
  it('重复确认和旧版本命令只能生效一次', () => {
    const { state, content } = fixture(['constant']); const draft = { ...draftFor(state), tokenIds: [] };
    const next = runCommand(state, { type: 'play-card', draft, expectedRevision: state.revision }, content);
    expect(applyCommand(next, { type: 'play-card', draft, expectedRevision: state.revision }, content).accepted).toBe(false);
    expect(next.battle!.tokens).toHaveLength(1);
  });
  it('能量不足时不消费筹码', () => { const { state, content } = fixture(['product'], [3, 3]); state.battle!.energy = 1; expect(previewAction(state, draftFor(state), content).reasons[0]).toContain('能量不足'); });
  it('明确指定无效目标时拒绝出牌', () => {
    const { state, content } = fixture(['strike'], [3]);
    expect(previewAction(state, { ...draftFor(state), targetId: 'missing' }, content).valid).toBe(false);
  });
  it.each([
    ['strike', [7], 7], ['product', [11, 11], 99], ['square', [12], 99], ['prime-blade', [3], 6],
  ] as const)('%s 的预览和实际伤害一致', (id, values, expected) => {
    const { state, content } = fixture([id], [...values], 'sieve'); state.battle!.enemies[0]!.intent.factor = 5;
    const preview = previewAction(state, draftFor(state), content); expect(preview.valid).toBe(true);
    expect(preview.effects[0]).toMatchObject({ amount: expected });
    const next = runCommand(state, { type: 'play-card', draft: draftFor(state) }, content);
    expect(72 - next.battle!.enemies[0]!.hp).toBe(Math.min(72, expected));
  });
});

describe('卡牌规则', () => {
  it('常数与变量生成独立筹码，并正确扣费', () => {
    const { state, content } = fixture(['constant', 'variable']);
    let next = runCommand(state, { type: 'play-card', draft: { ...draftFor(state), tokenIds: [] } }, content);
    const draft = { ...draftFor(next), tokenIds: [], options: { variable: 4 } };
    next = runCommand(next, { type: 'play-card', draft }, content);
    expect(next.battle!.tokens.map(t => t.value)).toEqual([3, 4, 4]); expect(new Set(next.battle!.tokens.map(t => t.id)).size).toBe(3); expect(next.battle!.energy).toBe(2);
    expect(previewAction(fixture(['variable']).state, { ...draft, options: { variable: 5 } }, content).valid).toBe(false);
  });
  it('累加能切换攻防，防御护甲在下一回合清零', () => {
    const { state, content } = fixture(['sum'], [3, 3]);
    const next = runCommand(state, { type: 'play-card', draft: draftFor(state, 0, { mode: 'block' }) }, content);
    expect(next.battle!.block).toBe(6);
    const turn = runCommand(next, { type: 'end-turn' }, content);
    expect(turn.run.hp).toBe(60); expect(turn.battle!.block).toBe(0); expect(turn.battle!.energy).toBe(3);
  });
  it('防御和偶数壁垒正确结算，零是合法偶数', () => {
    for (const [id, n, expected] of [['defend', 3, 3], ['even-wall', 2, 3], ['even-wall', 0, 0]] as const) {
      const { state, content } = fixture([id], [n]);
      expect(previewAction(state, draftFor(state), content).effects[0]).toMatchObject({ type: 'block', amount: expected });
    }
    const { state, content } = fixture(['prime-blade'], [0]); expect(previewAction(state, draftFor(state), content).valid).toBe(false);
  });
  it('平方进入消耗区，余项进入能力区', () => {
    const square = fixture(['square'], [3]); const sq = runCommand(square.state, { type: 'play-card', draft: draftFor(square.state) }, square.content);
    expect(sq.battle!.exhaustPile).toHaveLength(1); expect(sq.battle!.discardPile).toHaveLength(0);
    const remainder = fixture(['remainder']); const r = runCommand(remainder.state, { type: 'play-card', draft: { ...draftFor(remainder.state), tokenIds: [] } }, remainder.content);
    expect(r.battle!.powers).toHaveLength(1);
  });
  it.each([['adjust', 0, { delta: -1 }], ['adjust', 99, { delta: 1 }], ['double', 50, {}], ['factor', 3, {}], ['split', 3, { split: 4 }]])('%s 拒绝越界或非法运算', (id, n, options) => {
    const { state, content } = fixture([String(id)], [Number(n)]);
    expect(previewAction(state, draftFor(state, 0, options as {}), content).valid).toBe(false);
  });
  it.each([['adjust', 3, { delta: -1 }, [2]], ['double', 4, {}, [8]], ['factor', 12, { factor: 3 }, [3, 4]], ['split', 0, { split: 0 }, [0, 0]], ['split', 5, { split: 1 }, [1, 4]]])('%s 正确加工数字', (id, n, options, expected) => {
    const { state, content } = fixture([String(id)], [Number(n)]);
    const next = runCommand(state, { type: 'play-card', draft: draftFor(state, 0, options as {}) }, content);
    expect(next.battle!.tokens.map(t => t.value)).toEqual(expected); expect(next.battle!.tokens.every(t => !t.rerollable)).toBe(true);
  });
  it('平衡必须等于 10，结算中的卡不参与洗牌', () => {
    const { state, content } = fixture(['balance', 'constant', 'strike'], [6, 4]);
    state.battle!.discardPile = state.battle!.hand.splice(1);
    const next = runCommand(state, { type: 'play-card', draft: draftFor(state) }, content);
    expect(next.battle!.hand).toHaveLength(2); expect(next.battle!.hand.some(c => c.definitionId === 'balance')).toBe(false); expect(next.battle!.discardPile[0]!.definitionId).toBe('balance');
    const wrong = fixture(['balance'], [3, 3]); expect(previewAction(wrong.state, draftFor(wrong.state), wrong.content).valid).toBe(false);
  });
  it('超过手牌上限的抽牌进入弃牌堆', () => {
    const { state, content } = fixture(['balance', ...Array.from({ length: 11 }, () => 'constant')], [6, 4]);
    const b = state.battle!; b.drawPile = b.hand.splice(10);
    const next = runCommand(state, { type: 'play-card', draft: draftFor(state) }, content);
    expect(next.battle!.hand).toHaveLength(10); expect(next.battle!.discardPile).toHaveLength(2);
  });
  it('寄存器保留同一身份，下回合返还，且每回合限一次', () => {
    const { state, content } = fixture(['register', 'register'], [3, 4]);
    const first = state.battle!.tokens[0]!;
    let next = runCommand(state, { type: 'play-card', draft: { ...draftFor(state), tokenIds: [first.id] } }, content);
    expect(next.battle!.storedTokens[0]!.id).toBe(first.id);
    expect(previewAction(next, { ...draftFor(next), tokenIds: [next.battle!.tokens[0]!.id] }, content).valid).toBe(false);
    next = runCommand(next, { type: 'end-turn' }, content);
    expect(next.battle!.tokens.some(t => t.id === first.id)).toBe(true); expect(next.battle!.registerUsed).toBe(false);
  });
  it('余项在敌方行动前结算，击杀后立即胜利', () => {
    const { state, content } = fixture(['remainder'], [2, 3, 4]); state.battle!.enemies[0]!.hp = 3;
    let next = runCommand(state, { type: 'play-card', draft: { ...draftFor(state), tokenIds: [] } }, content);
    next = runCommand(next, { type: 'end-turn' }, content); expect(next.screen).toBe('reward'); expect(next.run.hp).toBe(60);
  });
});

describe('敌人、超容量和成长流程', () => {
  it('超容量进入强制选择，弃数前无法出牌或结束回合', () => {
    const { state, content } = fixture(['variable', 'constant'], [0, 1, 2, 3, 4]);
    let next = runCommand(state, { type: 'play-card', draft: { ...draftFor(state), tokenIds: [] } }, content);
    expect(next.battle!.phase).toBe('choice'); expect(next.battle!.pendingChoice?.count).toBe(1);
    expect(applyCommand(next, { type: 'end-turn' }, content).accepted).toBe(false);
    next = runCommand(next, { type: 'discard-token', tokenId: next.battle!.tokens[0]!.id }, content);
    expect(next.battle!.phase).toBe('player'); expect(next.battle!.tokens).toHaveLength(6);
  });
  it('敌人按固定规律攻击，倍增上限 16', () => {
    const bug = catalog.enemyBehaviors.doubling!, def = catalog.enemies.bug!;
    const { state } = fixture(['constant'], [], 'bug');
    expect([1, 2, 3, 4, 5, 6].map(t => bug.intent(state.battle!.enemies[0]!, t, def).damage)).toEqual([2, 4, 8, 16, 16, 16]);
  });
  it('奇偶守卫使用槽内计算结果判断，质数倍率随后生效', () => {
    const { state, content } = fixture(['prime-blade'], [3], 'guardian');
    expect(previewAction(state, draftFor(state), content).effects[0]).toMatchObject({ amount: 6 });
    state.battle!.turn = 2; expect(previewAction(state, draftFor(state), content).effects[0]).toMatchObject({ amount: 3 });
    const product = fixture(['product'], [2, 3], 'guardian'); expect(previewAction(product.state, draftFor(product.state), product.content).effects[0]).toMatchObject({ amount: 3 });
  });
  it('埃氏筛包含铭刻槽，阶段变化不改写已公布意图', () => {
    const { state, content } = fixture(['strike', 'strike'], [50, 50], 'sieve');
    let next = state;
    for (let i = 0; i < 2; i++) next = runCommand(next, { type: 'play-card', draft: { ...draftFor(next), tokenIds: [next.battle!.tokens[0]!.id] } }, content);
    expect(next.battle!.enemies[0]!.hp).toBe(22); expect(next.battle!.enemies[0]!.intent.damage).toBe(4);
    next = runCommand(next, { type: 'end-turn' }, content); expect(next.run.hp).toBe(56); expect(next.battle!.enemies[0]!.intent).toMatchObject({ damage: 8, factor: 3, phase: 3 });
    const engraved = fixture(['product'], [3], 'sieve'); engraved.state.battle!.hand[0]!.engraving = { slot: 0, value: 2 };
    expect(previewAction(engraved.state, { ...draftFor(engraved.state), tokenIds: [null, engraved.state.battle!.tokens[0]!.id] }, engraved.content).effects[0]).toMatchObject({ amount: 3 });
  });
  it('击杀敌人后立即发三张不同奖励，不再承受攻击', () => {
    const { state, content } = fixture(['strike'], [24]);
    const next = runCommand(state, { type: 'play-card', draft: draftFor(state) }, content);
    expect(next.screen).toBe('reward'); expect(next.run.hp).toBe(60); expect(new Set(next.reward).size).toBe(3);
    const picked = runCommand(next, { type: 'choose-reward', definitionId: next.reward[0]! }, content);
    expect(picked.run.deck).toHaveLength(2); expect(picked.screen).toBe('map'); expect(picked.run.floor).toBe(1);
  });
  it('休息回复 30%，铭刻限制条件且不能重复', () => {
    const state = createRun({}, 'REST', catalog); state.run.floor = 2; state.run.hp = 31;
    const rest = runCommand(state, { type: 'enter-node' }, catalog);
    expect(runCommand(rest, { type: 'rest-heal' }, catalog).run.hp).toBe(49);
    const card = rest.run.deck.find(c => c.definitionId === 'product')!;
    const engraved = runCommand(rest, { type: 'engrave-card', cardId: card.id, slot: 1, value: 3 }, catalog);
    expect(engraved.run.deck.find(c => c.id === card.id)!.engraving).toEqual({ slot: 1, value: 3 });
    engraved.screen = 'rest'; expect(applyCommand(engraved, { type: 'engrave-card', cardId: card.id, slot: 0, value: 2 }, catalog).accepted).toBe(false);
    expect(applyCommand(rest, { type: 'engrave-card', cardId: card.id, slot: 0, value: 4 }, catalog).accepted).toBe(false);
  });
  it('失败终止战斗，不能继续发命令', () => {
    const { state, content } = fixture(['constant']); state.run.hp = 1;
    const next = runCommand(state, { type: 'end-turn' }, content); expect(next.screen).toBe('lost'); expect(next.battle!.phase).toBe('defeat'); expect(applyCommand(next, { type: 'end-turn' }, content).accepted).toBe(false);
  });
});

describe('v0.3 新增卡牌与遭遇', () => {
  it('差值造成 a−b 且不小于 0', () => {
    const hit = fixture(['difference'], [7, 3]);
    const preview = previewAction(hit.state, draftFor(hit.state), hit.content);
    expect(preview.valid).toBe(true); expect(preview.effects[0]).toMatchObject({ type: 'damage', amount: 4 });
    const reversed = fixture(['difference'], [3, 7]);
    expect(previewAction(reversed.state, draftFor(reversed.state), reversed.content).effects[0]).toMatchObject({ amount: 0 });
  });
  it('奇刃只接受奇数并双倍结算', () => {
    const odd = fixture(['odd-blade'], [5]);
    expect(previewAction(odd.state, draftFor(odd.state), odd.content).effects[0]).toMatchObject({ amount: 10 });
    const even = fixture(['odd-blade'], [4]);
    expect(previewAction(even.state, draftFor(even.state), even.content).valid).toBe(false);
  });
  it('平方壁只接受完全平方数并按 1.5 倍向下取整', () => {
    for (const [n, expected] of [[9, 13], [4, 6], [0, 0]] as const) {
      const { state, content } = fixture(['square-wall'], [n]);
      expect(previewAction(state, draftFor(state), content).effects[0]).toMatchObject({ type: 'block', amount: expected });
    }
    const invalid = fixture(['square-wall'], [8]);
    expect(previewAction(invalid.state, draftFor(invalid.state), invalid.content).valid).toBe(false);
  });
  it('洞察抽 2 张并进入消耗区', () => {
    const { state, content } = fixture(['insight', 'constant', 'constant', 'strike'], []);
    const b = state.battle!; b.drawPile = b.hand.splice(1);
    const next = runCommand(state, { type: 'play-card', draft: { ...draftFor(state), tokenIds: [] } }, content);
    expect(next.battle!.hand).toHaveLength(2);
    expect(next.battle!.exhaustPile.map(c => c.definitionId)).toEqual(['insight']);
  });
  it('复制消耗一枚筹码并返回两枚独立身份的同值筹码', () => {
    const { state, content } = fixture(['duplicate'], [6]);
    const next = runCommand(state, { type: 'play-card', draft: draftFor(state) }, content);
    expect(next.battle!.tokens.map(t => t.value)).toEqual([6, 6]);
    expect(new Set(next.battle!.tokens.map(t => t.id)).size).toBe(2);
  });
  it('双敌遭遇只结算目标，全部死亡才胜利', () => {
    const character = { ...catalog.characters.algebraist!, deck: ['strike', 'strike', 'strike'] };
    const content = createCatalog({
      characters: { algebraist: character },
      map: [{ id: 'twin', kind: 'battle', name: '双子', description: '', enemies: ['slimelet', 'slimelet'] }, ...catalog.map.slice(1)],
    } as never);
    const entered = applyCommand(createRun({}, 'TWIN', content), { type: 'enter-node' }, content);
    if (!entered.accepted) throw new Error(entered.reason);
    const state = entered.state, b = state.battle!;
    b.hand = structuredClone(state.run.deck); b.drawPile = [];
    b.tokens = [7, 5, 12].map(value => ({ id: `token-${state.run.nextId++}`, value, source: '测试', rerollable: false }));
    const [left, right] = b.enemies;
    expect(b.enemies).toHaveLength(2); expect(left!.hp).toBe(10); expect(right!.hp).toBe(10);
    // Always aim an attack card at an explicit target with an explicit token.
    const strike = (current: typeof state, targetId: string) => {
      const card = current.battle!.hand.find(c => catalog.cards[c.definitionId]!.kind === 'attack')!;
      return { type: 'play-card' as const, draft: { cardId: card.id, tokenIds: [current.battle!.tokens[0]!.id], targetId, options: {} } };
    };
    const first = runCommand(state, strike(state, left!.id), content);
    expect(first.battle!.enemies[0]!.hp).toBe(3); expect(first.battle!.enemies[1]!.hp).toBe(10); expect(first.screen).toBe('battle');
    const second = runCommand(first, strike(first, left!.id), content);
    expect(second.battle!.enemies[0]!.hp).toBe(0); expect(second.battle!.enemies[1]!.hp).toBe(10); expect(second.screen).toBe('battle');
    const third = runCommand(second, strike(second, right!.id), content);
    expect(third.battle!.enemies[1]!.hp).toBe(0); expect(third.screen).toBe('reward');
  });
  it('意图预测与已公布意图共用同一纯函数', () => {
    const { state } = fixture(['constant'], [], 'slime');
    const before = structuredClone(state), enemy = state.battle!.enemies[0]!;
    expect(intentAt(catalog, enemy, state.battle!.turn)!.damage).toBe(enemy.intent.damage);
    expect(forecastIntents(catalog, enemy, state.battle!.turn + 1, 3).map(step => step.damage)).toEqual([6, 8, 10]);
    expect(state).toEqual(before);
  });
  it('净化按费用移除卡牌，金币不足或牌组过短时拒绝', () => {
    const rich = createRun({}, 'REMOVE', catalog);
    rich.run.floor = 2; rich.run.gold = catalog.rules.removeCost;
    const rest = runCommand(rich, { type: 'enter-node' }, catalog);
    const card = rest.run.deck.find(c => c.definitionId === 'constant')!;
    const next = runCommand(rest, { type: 'rest-remove', cardId: card.id }, catalog);
    expect(next.run.deck.some(c => c.id === card.id)).toBe(false);
    expect(next.run.gold).toBe(0); expect(next.screen).toBe('map'); expect(next.run.floor).toBe(3);
    validateState(next, catalog);

    const poor = createRun({}, 'REMOVE', catalog); poor.run.floor = 2; poor.run.gold = 0;
    const poorRest = runCommand(poor, { type: 'enter-node' }, catalog);
    expect(applyCommand(poorRest, { type: 'rest-remove', cardId: poorRest.run.deck[0]!.id }, catalog).accepted).toBe(false);

    const small = createRun({}, 'REMOVE', catalog); small.run.floor = 2; small.run.gold = 99;
    small.run.deck = small.run.deck.slice(0, catalog.rules.minDeck);
    const smallRest = runCommand(small, { type: 'enter-node' }, catalog);
    expect(applyCommand(smallRest, { type: 'rest-remove', cardId: smallRest.run.deck[0]!.id }, catalog).accepted).toBe(false);
  });
  it('新增卡牌都进入奖励池且具备稀有度', () => {
    for (const id of ['difference', 'odd-blade', 'square-wall', 'insight', 'duplicate']) {
      expect(catalog.rewardPool).toContain(id);
      expect(catalog.cards[id]?.rarity).toBeTruthy();
    }
  });
});

describe('性质与确定性验收', () => {  it('任意合法命令序列保持资源非负、卡牌守恒和筹码唯一', () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 30 }), fc.array(fc.nat(1000), { minLength: 1, maxLength: 100 }), (seed, choices) => {
      let state = createRun({}, seed, catalog);
      for (const n of choices) {
        let command = decide(state, catalog, 'mixed'); if (!command) break;
        if (state.screen === 'battle' && state.battle!.phase === 'player') {
          const drafts = state.battle!.hand.flatMap(c => [...enumerateDrafts(state, c.id, catalog), ...enumerateDrafts(state, c.id, catalog, { mode: 'block' })]);
          command = n % 4 && drafts.length ? { type: 'play-card', draft: drafts[n % drafts.length]! } : { type: 'end-turn' };
        }
        state = runCommand(state, command, catalog); validateState(state, catalog);
        expect(state.run.hp).toBeGreaterThanOrEqual(0); expect(state.battle?.energy ?? 0).toBeGreaterThanOrEqual(0);
      }
    }), { numRuns: 60 });
  });
  it('同种子、同命令序列得到相同结果', () => {
    let a = createRun({}, 'REPLAY', catalog), b = createRun({}, 'REPLAY', catalog);
    for (let i = 0; i < 300; i++) {
      const command = decide(a, catalog, 'mixed'); if (!command) break;
      a = runCommand(a, command, catalog); b = runCommand(b, command, catalog); expect(a).toEqual(b);
    }
  });
});
