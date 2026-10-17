/**
 * Visual QA helper (run with `pnpm shots`).
 * Crafts deterministic states through the production kernel, imports them into
 * the real UI, and writes review screenshots to docs/screenshots.
 */
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { catalog } from '../src/content/catalog';
import { applyCommand, createRun } from '../src/core';
import type { CommandBody, GameState } from '../src/core';
import { encodeSave } from '../src/platform/save-schema';

const base = process.env.SHOT_URL ?? 'http://127.0.0.1:4273';
const out = process.env.SHOT_DIR ?? 'docs/screenshots';
await mkdir(out, { recursive: true });

const run = (state: GameState, command: CommandBody): GameState => {
  const result = applyCommand(state, command, catalog);
  if (!result.accepted) throw new Error(`${command.type}: ${result.reason}`);
  return result.state;
};
const enter = (seed: string, floor: number): GameState => {
  const start = createRun({}, seed, catalog);
  start.run.floor = floor;
  start.run.visited = catalog.map.slice(0, floor).map(node => node.id);
  return run(start, { type: 'enter-node' });
};

const browser = await chromium.launch({ channel: process.env.SHOT_CHANNEL ?? 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

async function importState(target: Page, state: GameState) {
  await target.goto(base, { waitUntil: 'networkidle' });
  await target.evaluate(() => indexedDB.deleteDatabase('number-spire'));
  await target.goto(base, { waitUntil: 'networkidle' });
  await target.getByRole('button', { name: '设置与存档', exact: true }).click();
  await target.getByLabel('导入存档文件').setInputFiles({ name: 'shot.json', mimeType: 'application/json', buffer: Buffer.from(encodeSave(state)) });
  await target.waitForTimeout(450);
}

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(350);
await page.screenshot({ path: `${out}/menu-1280.png` });

// --- map ---
await page.getByRole('textbox', { name: '世界种子', exact: true }).fill('VISUAL-QA');
await page.getByRole('button', { name: '开始攀登', exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/map-1280.png` });

// --- single enemy battle, mid-composer ---
await importState(page, enter('VISUAL-QA', 0));
await page.getByRole('button', { name: '选择卡牌 常数', exact: true }).first().click();
await page.getByRole('button', { name: /^确认出牌/ }).click();
await page.waitForTimeout(350);
await page.getByRole('button', { name: '选择卡牌 双联', exact: true }).first().click();
await page.getByRole('button', { name: /自动.*填槽/s }).first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/battle-1280.png` });

// --- two-enemy encounter ---
await importState(page, enter('VISUAL-QA', 1));
await page.getByRole('button', { name: '选择卡牌 打击', exact: true }).first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/battle-twin-1280.png` });

// --- reward ---
const reward = createRun({}, 'VISUAL-QA', catalog);
reward.run.floor = 1; reward.run.gold = 15; reward.run.hp = 52;
reward.run.visited = ['floor-1']; reward.screen = 'reward'; reward.reward = ['square', 'duplicate', 'odd-blade'];
await importState(page, reward);
await page.screenshot({ path: `${out}/reward-1280.png` });

// --- rest ---
const rest = createRun({}, 'VISUAL-QA', catalog);
rest.run.floor = 2; rest.run.hp = 41; rest.run.gold = 40; rest.run.visited = ['floor-1', 'floor-2']; rest.screen = 'rest';
await importState(page, rest);
await page.screenshot({ path: `${out}/rest-1280.png` });
await page.getByRole('button', { name: /^净化/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/rest-remove-1280.png` });

// --- victory ---
const won = createRun({}, 'VISUAL-QA', catalog);
won.screen = 'won'; won.run.floor = catalog.map.length - 1;
won.run.visited = catalog.map.map(node => node.id);
won.run.stats = { cardsPlayed: 48, turns: 26, damageDealt: 214, damageTaken: 63, battlesWon: 5 };
await importState(page, won);
await page.screenshot({ path: `${out}/victory-1280.png` });

// --- compendium ---
await page.getByRole('button', { name: '探索图鉴', exact: true }).first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/compendium-1280.png` });
await page.getByRole('button', { name: '关闭面板', exact: true }).click();

// --- responsive pass over the battle screen ---
await importState(page, enter('VISUAL-QA', 1));
await page.getByRole('button', { name: '选择卡牌 打击', exact: true }).first().click();
for (const [width, height] of [[1920, 1080], [1440, 900], [390, 844]] as const) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(350);
  const size = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  console.log(`viewport ${width}x${height} -> scroll ${size.w}x${size.h}`);
  await page.screenshot({ path: `${out}/battle-${width}.png`, fullPage: true });
}

console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
