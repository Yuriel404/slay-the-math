/** The core has no dependency on React, browser APIs or persistence. */
export type CardKind = 'attack' | 'defense' | 'generator' | 'transform' | 'utility' | 'power';
export type CardRarity = 'common' | 'uncommon' | 'rare';
export type SlotRule = 'any' | 'prime' | 'even' | 'odd' | 'square' | 'composite';
export interface SlotDefinition { label: string; rule: SlotRule }
export interface EffectDefinition { type: string; params: Record<string, number | string | boolean> }
export interface CardDefinition {
  id: string; name: string; subtitle: string; description: string; cost: number;
  kind: CardKind; symbol: string; slots: SlotDefinition[]; effect: EffectDefinition;
  exhaust?: boolean; engravable?: boolean; oncePerTurn?: boolean; rarity?: CardRarity;
}
export interface CardInstance { id: string; definitionId: string; engraving?: { slot: number; value: number } }
export interface NumberToken { id: string; value: number; source: string; rerollable: boolean }
export interface EnemyDefinition {
  id: string; name: string; subtitle: string; hp: number; behavior: string;
  description: string; symbol: string; params: Record<string, number>;
  /** Presentation hint only: the art layer maps it to a colour family. */
  theme?: string;
}
export interface EnemyIntent { damage: number; formula: string; detail: string; factor?: number; phase: number }
export interface EnemyInstance { id: string; definitionId: string; hp: number; maxHp: number; block: number; intent: EnemyIntent }
export interface RelicDefinition { id: string; name: string; description: string; turnStartNumbers: number[] }
export interface CharacterDefinition { id: string; name: string; description: string; maxHp: number; deck: string[]; relics: string[] }
export interface MapNode { id: string; kind: 'battle' | 'rest' | 'boss'; name: string; description: string; enemies?: string[] }
export type RuleSet = { energy: number; draw: number; handLimit: number; poolCapacity: number; numberMin: number; numberMax: number; effectCap: number; removeCost: number; minDeck: number };
export type RandomStream = 'map' | 'battle' | 'reward' | 'event';
export interface RunStats { cardsPlayed: number; turns: number; damageDealt: number; damageTaken: number; battlesWon: number }
export interface RunState {
  characterId: string; hp: number; maxHp: number; gold: number; deck: CardInstance[];
  relics: string[]; floor: number; visited: string[]; nextId: number; stats: RunStats;
}
export interface BattleState {
  phase: 'player' | 'choice' | 'victory' | 'defeat'; turn: number; energy: number; block: number;
  hand: CardInstance[]; drawPile: CardInstance[]; discardPile: CardInstance[];
  exhaustPile: CardInstance[]; powers: CardInstance[]; tokens: NumberToken[];
  storedTokens: NumberToken[]; enemies: EnemyInstance[]; registerUsed: boolean;
  pendingChoice: { type: 'overflow'; count: number } | null;
}
export interface GameEvent { type: string; message: string; value?: number; targetId?: string; turn?: number }
export interface GameState {
  rulesVersion: number; contentVersion: string; seed: string; revision: number;
  rng: Record<RandomStream, number[]>; run: RunState;
  screen: 'map' | 'battle' | 'reward' | 'rest' | 'won' | 'lost';
  battle: BattleState | null; reward: string[]; logs: GameEvent[];
}
export interface DraftOptions { variable?: number; mode?: 'attack' | 'block'; delta?: number; split?: number; factor?: number }
export interface ActionDraft { cardId: string; tokenIds: (string | null)[]; targetId?: string; options: DraftOptions }
export type ResolvedEffect =
  | { type: 'damage'; amount: number; targetId: string }
  | { type: 'block'; amount: number }
  | { type: 'generate'; values: number[]; source: string }
  | { type: 'draw'; amount: number }
  | { type: 'store'; tokenId: string }
  | { type: 'power'; name: string };
export interface EffectResolution { formula: string; effects: ResolvedEffect[]; error?: string }
export interface PreviewResult {
  valid: boolean; reasons: string[]; formula: string; effects: ResolvedEffect[];
  values: number[]; consumedTokenIds: string[];
}
export interface EffectContext {
  state: GameState; card: CardInstance; definition: CardDefinition; values: number[];
  draft: ActionDraft; target: EnemyInstance | undefined; catalog: Catalog;
}
export interface EffectHandler { resolve(context: EffectContext): EffectResolution }
export interface EnemyBehavior {
  intent(enemy: EnemyInstance, turn: number, definition: EnemyDefinition): EnemyIntent;
  damageMultiplier?(enemy: EnemyInstance, turn: number, values: number[], rawValue: number): { multiplier: number; reason: string };
}
/** Register new content and behavior here; the UI never switches on card IDs. */
export interface Catalog {
  version: string; rules: RuleSet; cards: Record<string, CardDefinition>;
  enemies: Record<string, EnemyDefinition>; characters: Record<string, CharacterDefinition>;
  relics: Record<string, RelicDefinition>; map: MapNode[]; rewardPool: string[];
  effects: Record<string, EffectHandler>; enemyBehaviors: Record<string, EnemyBehavior>;
}
export interface RunConfig { characterId?: string }
export type CommandBody =
  | { type: 'enter-node' }
  | { type: 'play-card'; draft: ActionDraft }
  | { type: 'end-turn' }
  | { type: 'discard-token'; tokenId: string }
  | { type: 'choose-reward'; definitionId: string | null }
  | { type: 'rest-heal' }
  | { type: 'rest-remove'; cardId: string }
  | { type: 'engrave-card'; cardId: string; slot: number; value: number };
export type GameCommand = CommandBody & { expectedRevision?: number };
export type TransitionResult =
  | { accepted: true; state: GameState; events: GameEvent[] }
  | { accepted: false; state: GameState; events: []; reason: string };
