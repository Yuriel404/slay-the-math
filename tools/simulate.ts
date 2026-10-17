import { catalog } from '../src/content/catalog';
import { applyCommand, createRun } from '../src/core';
import { decide } from './policies';
import type { Policy } from './policies';

const count = Math.max(1, Math.min(1000, Number(process.argv[2]) || 50));
const prefix = process.argv[3] ?? 'SPIRE-BALANCE';
for (const policy of ['attack', 'defense', 'mixed'] as Policy[]) {
  let wins = 0, rounds = 0, damageTaken = 0, unusedNumbers = 0, unusedEnergy = 0;
  const usage: Record<string, number> = {};
  for (let seed = 0; seed < count; seed++) {
    let state = createRun({}, `${prefix}-${seed}`, catalog);
    for (let step = 0; step < 2000; step++) {
      const command = decide(state, catalog, policy);
      if (!command) break;
      if (command.type === 'end-turn') { unusedNumbers += state.battle!.tokens.length; unusedEnergy += state.battle!.energy; }
      if (command.type === 'play-card') { const id = state.battle!.hand.find(c => c.id === command.draft.cardId)!.definitionId; usage[id] = (usage[id] ?? 0) + 1; }
      const transition = applyCommand(state, command, catalog);
      if (!transition.accepted) throw new Error(transition.reason);
      state = transition.state;
      if (step === 1999) throw new Error('模拟达到步数限制，可能存在循环');
    }
    if (state.screen === 'won') wins++;
    rounds += state.run.stats.turns; damageTaken += state.run.stats.damageTaken;
  }
  console.log(JSON.stringify({ policy, runs: count, wins, winRate: `${(wins / count * 100).toFixed(1)}%`, averageTurns: +(rounds / count).toFixed(2), averageDamageTaken: +(damageTaken / count).toFixed(2), unusedNumbersPerRun: +(unusedNumbers / count).toFixed(2), unusedEnergyPerRun: +(unusedEnergy / count).toFixed(2), cardUsage: usage }, null, 2));
}
