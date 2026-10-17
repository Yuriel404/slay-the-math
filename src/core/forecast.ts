import type { Catalog, EnemyInstance, EnemyIntent } from './types';

/**
 * Projection of an enemy's upcoming intents.
 *
 * The engine publishes `EnemyIntent` into the state at the start of every turn.
 * Calling `intent()` again with a later turn number reuses the exact same pure
 * behaviour code, so the forecast can never drift from the real resolution, and
 * it never touches the RNG state.
 */
export interface IntentForecast {
  turn: number;
  damage: number;
  factor?: number;
  detail: string;
  formula: string;
}

export function intentAt(catalog: Catalog, enemy: EnemyInstance, turn: number): EnemyIntent | null {
  const definition = catalog.enemies[enemy.definitionId];
  const behavior = definition ? catalog.enemyBehaviors[definition.behavior] : undefined;
  return definition && behavior ? behavior.intent(enemy, turn, definition) : null;
}

export function forecastIntents(catalog: Catalog, enemy: EnemyInstance, fromTurn: number, count: number): IntentForecast[] {
  const forecasts: IntentForecast[] = [];
  for (let index = 0; index < count; index++) {
    const turn = fromTurn + index;
    const intent = intentAt(catalog, enemy, turn);
    if (!intent) break;
    forecasts.push({ turn, damage: intent.damage, factor: intent.factor, detail: intent.detail, formula: intent.formula });
  }
  return forecasts;
}

/** Total damage the living enemies will deal on the next resolution of `end-turn`. */
export function incomingDamage(enemies: EnemyInstance[]): number {
  return enemies.filter(enemy => enemy.hp > 0).reduce((total, enemy) => total + enemy.intent.damage, 0);
}
