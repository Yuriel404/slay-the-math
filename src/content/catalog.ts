import { effectHandlers, enemyBehaviors } from '../core/effects';
import type { CardDefinition, Catalog, RuleSet, SlotDefinition } from '../core/types';

const any = (label = 'n'): SlotDefinition => ({ label, rule: 'any' });
const cards: CardDefinition[] = [
  { id: 'constant', name: '常数', subtitle: 'CONSTANT', kind: 'generator', cost: 0, rarity: 'common', symbol: '3', description: '获得一枚数字 3。', slots: [], effect: { type: 'generate', params: { value: 3 } } },
  { id: 'variable', name: '变量 x', subtitle: 'VARIABLE', kind: 'generator', cost: 1, rarity: 'common', symbol: 'x', description: '选择 1～4，获得两枚相同的独立筹码。', slots: [], effect: { type: 'variable', params: {} } },
  { id: 'strike', name: '打击', subtitle: 'STRIKE', kind: 'attack', cost: 1, rarity: 'common', symbol: '↗', description: '造成 n 点伤害。', slots: [any()], engravable: true, effect: { type: 'numerical', params: {} } },
  { id: 'defend', name: '防御', subtitle: 'DEFEND', kind: 'defense', cost: 1, rarity: 'common', symbol: '◇', description: '获得 n 点护甲，抵挡本回合伤害。', slots: [any()], engravable: true, effect: { type: 'numerical', params: {} } },
  { id: 'sum', name: '累加', subtitle: 'ACCUMULATE', kind: 'attack', cost: 1, rarity: 'common', symbol: '+', description: '将两个数相加，选择造成伤害或获得护甲。', slots: [any('a'), any('b')], engravable: true, effect: { type: 'numerical', params: { operation: 'sum' } } },
  { id: 'difference', name: '差值', subtitle: 'DIFFERENCE', kind: 'attack', cost: 1, rarity: 'common', symbol: '−', description: '造成 a − b 点伤害，结果不小于 0。', slots: [any('a'), any('b')], engravable: true, effect: { type: 'numerical', params: { operation: 'difference' } } },
  { id: 'product', name: '双联', subtitle: 'MULTIPLY', kind: 'attack', cost: 2, rarity: 'uncommon', symbol: '×', description: '造成两个数的乘积伤害。', slots: [any('a'), any('b')], engravable: true, effect: { type: 'numerical', params: { operation: 'product' } } },
  { id: 'prime-blade', name: '质数之刃', subtitle: 'PRIME BLADE', kind: 'attack', cost: 1, rarity: 'uncommon', symbol: 'p', description: '填入质数，造成其 2 倍的伤害。', slots: [{ label: '质数', rule: 'prime' }], engravable: true, effect: { type: 'numerical', params: { multiplier: 2 } } },
  { id: 'odd-blade', name: '奇刃', subtitle: 'ODD BLADE', kind: 'attack', cost: 1, rarity: 'uncommon', symbol: '∕', description: '填入奇数，造成其 2 倍的伤害。', slots: [{ label: '奇数', rule: 'odd' }], engravable: true, effect: { type: 'numerical', params: { multiplier: 2 } } },
  { id: 'even-wall', name: '偶数壁垒', subtitle: 'EVEN BARRIER', kind: 'defense', cost: 1, rarity: 'uncommon', symbol: 'Ⅱ', description: '填入偶数，获得其 1.5 倍护甲，向下取整。', slots: [{ label: '偶数', rule: 'even' }], engravable: true, effect: { type: 'numerical', params: { multiplier: 1.5 } } },
  { id: 'square-wall', name: '平方壁', subtitle: 'SQUARE WALL', kind: 'defense', cost: 2, rarity: 'rare', symbol: '√', description: '填入完全平方数，获得其 1.5 倍护甲，向下取整。', slots: [{ label: '平方数', rule: 'square' }], engravable: true, effect: { type: 'numerical', params: { multiplier: 1.5 } } },
  { id: 'square', name: '平方', subtitle: 'SQUARE', kind: 'attack', cost: 2, rarity: 'rare', symbol: 'n²', description: '造成 n² 点伤害。消耗。', slots: [any()], engravable: true, exhaust: true, effect: { type: 'numerical', params: { operation: 'square' } } },
  { id: 'adjust', name: '微调', subtitle: 'ADJUST', kind: 'transform', cost: 0, rarity: 'common', symbol: '±', description: '将一枚筹码 +1 或 −1。结果须在 0～99。', slots: [any()], effect: { type: 'adjust', params: {} } },
  { id: 'factor', name: '因式分解', subtitle: 'FACTORIZE', kind: 'transform', cost: 1, rarity: 'uncommon', symbol: '÷', description: '将合数拆成两个均大于 1 的整数因数。', slots: [{ label: '合数', rule: 'composite' }], effect: { type: 'factor', params: {} } },
  { id: 'double', name: '翻倍', subtitle: 'DOUBLE', kind: 'transform', cost: 1, rarity: 'common', symbol: '2n', description: '将一枚筹码 ×2 后放回数字池。', slots: [any()], effect: { type: 'double', params: {} } },
  { id: 'split', name: '拆分', subtitle: 'SPLIT', kind: 'transform', cost: 1, rarity: 'common', symbol: '∴', description: '将 n 拆成两个非负整数，和保持不变。', slots: [any()], effect: { type: 'split', params: {} } },
  { id: 'duplicate', name: '复制', subtitle: 'DUPLICATE', kind: 'transform', cost: 1, rarity: 'rare', symbol: '⧉', description: '消耗一枚筹码，获得两枚该数值的独立筹码。', slots: [any()], effect: { type: 'duplicate', params: {} } },
  { id: 'balance', name: '平衡', subtitle: 'BALANCE', kind: 'utility', cost: 1, rarity: 'uncommon', symbol: '=', description: '两个槽的数字之和等于 10 时，抽 2 张牌。', slots: [any('a'), any('b')], effect: { type: 'balance', params: {} } },
  { id: 'insight', name: '洞察', subtitle: 'INSIGHT', kind: 'utility', cost: 0, rarity: 'common', symbol: '?', description: '抽 2 张牌。消耗。', slots: [], exhaust: true, effect: { type: 'insight', params: {} } },
  { id: 'register', name: '寄存器', subtitle: 'REGISTER', kind: 'utility', cost: 0, rarity: 'uncommon', symbol: '→', description: '暂存一枚筹码，下回合返还。每回合限一次。', slots: [any()], oncePerTurn: true, effect: { type: 'register', params: {} } },
  { id: 'remainder', name: '余项', subtitle: 'REMAINDER', kind: 'power', cost: 1, rarity: 'rare', symbol: 'Σ', description: '每回合末，对所有敌人造成未用筹码数量的伤害。', slots: [], effect: { type: 'remainder', params: {} } },
];

export type CatalogOverrides = Omit<Partial<Catalog>, 'rules'> & { rules?: Partial<RuleSet> };
export function createCatalog(overrides: CatalogOverrides = {}): Catalog {
  const base: Catalog = {
    version: '0.3.0',
    rules: { energy: 3, draw: 5, handLimit: 10, poolCapacity: 6, numberMin: 0, numberMax: 99, effectCap: 99, removeCost: 25, minDeck: 5 },
    cards: Object.fromEntries(cards.map(card => [card.id, card])),
    characters: { algebraist: { id: 'algebraist', name: '代数师', description: '将常数握在手中，让变量成为可能。', maxHp: 60, deck: ['constant', 'constant', 'constant', 'constant', 'variable', 'strike', 'defend', 'defend', 'sum', 'product'], relics: ['constant-table'] } },
    relics: { 'constant-table': { id: 'constant-table', name: '常数表', description: '每回合开始，获得一枚数字 2。', turnStartNumbers: [2] } },
    enemies: {
      slime: { id: 'slime', name: '加法史莱姆', subtitle: 'ADDITIVE SLIME', hp: 24, behavior: 'arithmetic', theme: 'verdant', description: '时间站在它那一边。每拖延一回合，攻击就增加 2。', symbol: '+', params: { base: 4, step: 2 } },
      slimelet: { id: 'slimelet', name: '小史莱姆', subtitle: 'SLIMELING', hp: 10, behavior: 'arithmetic', theme: 'verdant', description: '成对出现。它们缓慢长大，却能被逐个击破。', symbol: '±', params: { base: 2, step: 1 } },
      bug: { id: 'bug', name: '倍增虫', subtitle: 'DOUBLING BUG', hp: 18, behavior: 'doubling', theme: 'violet', description: '攻击会翻倍，直到 16。尽早结束战斗。', symbol: '×', params: {} },
      guardian: { id: 'guardian', name: '奇偶守卫', subtitle: 'PARITY GUARDIAN', hp: 28, behavior: 'parity', theme: 'gold', description: '攻击计算结果与回合奇偶不同时，伤害减半。', symbol: '≡', params: {} },
      sieve: { id: 'sieve', name: '埃氏筛', subtitle: 'SIEVE OF ERATOSTHENES', hp: 72, behavior: 'sieve', theme: 'amethyst', description: '依次筛选 2、3、5 的倍数。任一有效槽值命中筛选，攻击伤害减半。', symbol: '∅', params: {} },
    },
    map: [
      { id: 'floor-1', kind: 'battle', name: '初入原野', description: '加法史莱姆', enemies: ['slime'] },
      { id: 'floor-2', kind: 'battle', name: '分裂原野', description: '小史莱姆 ×2', enemies: ['slimelet', 'slimelet'] },
      { id: 'floor-3', kind: 'rest', name: '静思之地', description: '休息 / 铭刻' },
      { id: 'floor-4', kind: 'battle', name: '倍增之路', description: '倍增虫', enemies: ['bug'] },
      { id: 'floor-5', kind: 'battle', name: '奇偶之门', description: '奇偶守卫', enemies: ['guardian'] },
      { id: 'floor-6', kind: 'rest', name: '塔前篝火', description: '休息 / 铭刻' },
      { id: 'floor-7', kind: 'boss', name: '筛选的尽头', description: '埃氏筛', enemies: ['sieve'] },
    ],
    rewardPool: ['prime-blade', 'odd-blade', 'even-wall', 'square-wall', 'square', 'difference', 'adjust', 'factor', 'double', 'split', 'duplicate', 'balance', 'insight', 'register', 'remainder', 'product', 'sum'],
    effects: effectHandlers, enemyBehaviors,
  };
  return { ...base, ...overrides, rules: { ...base.rules, ...overrides.rules }, cards: { ...base.cards, ...overrides.cards },
    enemies: { ...base.enemies, ...overrides.enemies }, characters: { ...base.characters, ...overrides.characters },
    relics: { ...base.relics, ...overrides.relics }, effects: { ...base.effects, ...overrides.effects }, enemyBehaviors: { ...base.enemyBehaviors, ...overrides.enemyBehaviors } };
}
export const catalog = createCatalog();
export const kindNames = { attack: '攻击', defense: '防御', generator: '产数', transform: '加工', utility: '调度', power: '能力' };
export const rarityNames = { common: '普通', uncommon: '稀有', rare: '传说' } as const;
