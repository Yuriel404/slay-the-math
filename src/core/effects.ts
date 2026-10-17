import { boundedEffect, factorPairs } from './math';
import type { EffectContext, EffectHandler, EffectResolution, EnemyBehavior } from './types';

function numerical(ctx: EffectContext, raw: number, formula: string, defense = false, slotResult = raw): EffectResolution {
  let result = raw;
  if (!defense && ctx.target) {
    const enemy = ctx.catalog.enemies[ctx.target.definitionId]!;
    const modifier = ctx.catalog.enemyBehaviors[enemy.behavior]?.damageMultiplier?.(ctx.target, ctx.state.battle!.turn, ctx.values, slotResult);
    if (modifier && modifier.multiplier !== 1) { result *= modifier.multiplier; formula += ` × ${modifier.multiplier}（${modifier.reason}）`; }
  }
  const amount = boundedEffect(result, ctx.catalog.rules.effectCap);
  return { formula: `${formula} = ${amount}${defense ? ' 护甲' : ' 伤害'}`,
    effects: defense ? [{ type: 'block', amount }] : [{ type: 'damage', amount, targetId: ctx.target!.id }] };
}
const reject = (error: string): EffectResolution => ({ formula: error, effects: [], error });

/** Handlers only resolve effects. The exact same result feeds preview and execution. */
export const effectHandlers: Record<string, EffectHandler> = {
  generate: { resolve: ({ definition }) => ({ formula: `获得 ${definition.effect.params.value}`, effects: [{ type: 'generate', values: [Number(definition.effect.params.value)], source: definition.name }] }) },
  variable: { resolve: ({ draft, definition }) => {
    const x = draft.options.variable ?? 4;
    if (!Number.isInteger(x) || x < 1 || x > 4) return reject('x 必须是 1～4 的整数');
    return { formula: `x = ${x} → 获得 ${x}、${x}`, effects: [{ type: 'generate', values: [x, x], source: definition.name }] };
  } },
  numerical: { resolve: (ctx) => {
    const [a = 0, b = 0] = ctx.values;
    const operation = ctx.definition.effect.params.operation;
    const multiplier = Number(ctx.definition.effect.params.multiplier ?? 1);
    const defense = ctx.definition.kind === 'defense' || (operation === 'sum' && ctx.draft.options.mode === 'block');
    let raw = a, formula = `${a}`;
    if (operation === 'sum') { raw = a + b; formula = `(${a} + ${b})`; }
    if (operation === 'product') { raw = a * b; formula = `${a} × ${b}`; }
    if (operation === 'square') { raw = a * a; formula = `${a}²`; }
    // Difference never goes negative; the clamp happens before multipliers so preview stays honest.
    if (operation === 'difference') { raw = Math.max(0, a - b); formula = `max(0, ${a} − ${b})`; }
    const slotResult = raw;
    if (multiplier !== 1) { raw *= multiplier; formula += ` × ${multiplier}`; }
    return numerical(ctx, raw, formula, defense, slotResult);
  } },
  adjust: { resolve: ({ values, draft, definition }) => {
    const delta = draft.options.delta ?? 1;
    if (delta !== 1 && delta !== -1) return reject('微调只能选择 +1 或 −1');
    const n = values[0]! + delta;
    return { formula: `${values[0]} ${delta > 0 ? '+ 1' : '− 1'} = ${n}`, effects: [{ type: 'generate', values: [n], source: definition.name }] };
  } },
  double: { resolve: ({ values, definition }) => ({ formula: `${values[0]} × 2 = ${values[0]! * 2}`, effects: [{ type: 'generate', values: [values[0]! * 2], source: definition.name }] }) },
  factor: { resolve: ({ values, draft, definition }) => {
    const n = values[0]!, a = draft.options.factor ?? factorPairs(n)[0]?.[0] ?? 0;
    if (!Number.isInteger(a) || a <= 1 || n % a !== 0 || n / a <= 1) return reject('选择两个均大于 1 的整数因数');
    return { formula: `${n} = ${a} × ${n / a} → 获得 ${a}、${n / a}`, effects: [{ type: 'generate', values: [a, n / a], source: definition.name }] };
  } },
  split: { resolve: ({ values, draft, definition }) => {
    const n = values[0]!, a = draft.options.split ?? Math.floor(n / 2);
    if (!Number.isInteger(a) || a < 0 || a > n) return reject(`拆分必须满足 a + b = ${n}，且 a、b ≥ 0`);
    return { formula: `${n} = ${a} + ${n - a} → 获得 ${a}、${n - a}`, effects: [{ type: 'generate', values: [a, n - a], source: definition.name }] };
  } },
  balance: { resolve: ({ values }) => {
    if (values[0]! + values[1]! !== 10) return reject('两个槽位的数字之和必须等于 10');
    return { formula: `${values[0]} + ${values[1]} = 10 → 抽 2 张牌`, effects: [{ type: 'draw', amount: 2 }] };
  } },
  duplicate: { resolve: ({ values, definition }) => ({ formula: `复制 ${values[0]} → 获得 ${values[0]}、${values[0]}`, effects: [{ type: 'generate', values: [values[0]!, values[0]!], source: definition.name }] }) },
  insight: { resolve: () => ({ formula: '洞察：抽 2 张牌', effects: [{ type: 'draw', amount: 2 }] }) },
  register: { resolve: ({ draft, values }) => ({ formula: `暂存 ${values[0]} → 下回合返还`, effects: [{ type: 'store', tokenId: draft.tokenIds[0]! }] }) },
  remainder: { resolve: () => ({ formula: '启用余项：每回合末，每枚未用筹码造成 1 点群体伤害', effects: [{ type: 'power', name: 'remainder' }] }) },
};

export const enemyBehaviors: Record<string, EnemyBehavior> = {
  arithmetic: { intent: (_e, t, d) => ({ damage: d.params.base! + (t - 1) * d.params.step!, formula: `${d.params.base} + ${d.params.step} × ${t - 1}`, detail: '每回合攻击 +2', phase: 1 }) },
  doubling: { intent: (_e, t) => ({ damage: Math.min(16, 2 ** t), formula: `min(2^${t}, 16)`, detail: '2 → 4 → 8 → 16 → 16', phase: 1 }) },
  parity: {
    intent: (_e, t) => ({ damage: 6, formula: '6', detail: `第 ${t} 回合 · ${t % 2 ? '奇' : '偶'}数结果伤害正常`, phase: 1 }),
    damageMultiplier: (_e, t, _values, raw) => ({ multiplier: raw % 2 === t % 2 ? 1 : 0.5, reason: '奇偶屏障' }),
  },
  sieve: {
    intent: (e, t) => { const phase = e.hp <= e.maxHp / 3 ? 3 : e.hp <= e.maxHp * 2 / 3 ? 2 : 1;
      return { damage: 2 + 2 * phase, formula: `阶段 ${phase}`, detail: `有效槽含 ${[2, 3, 5][(t - 1) % 3]} 的倍数时伤害 ×0.5`, factor: [2, 3, 5][(t - 1) % 3]!, phase }; },
    damageMultiplier: (e, _t, values) => ({ multiplier: values.some(n => n % e.intent.factor! === 0) ? 0.5 : 1, reason: `筛选因子 ${e.intent.factor}` }),
  },
};
