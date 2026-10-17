import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { catalog } from '../../src/content/catalog';
import { applyCommand, createRun } from '../../src/core';
import type { CommandBody, GameState } from '../../src/core';
import { encodeSave } from '../../src/platform/save-schema';
import { decide } from '../../tools/policies';
import { fixture } from '../fixtures';

async function importState(page: Page, state: GameState) {
  await page.goto('/');
  await page.getByRole('button', { name: '设置与存档', exact: true }).click();
  await page.getByLabel('导入存档文件').setInputFiles({ name: 'test-save.json', mimeType: 'application/json', buffer: Buffer.from(encodeSave(state)) });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('main')).toHaveAttribute('data-revision', String(state.revision));
}
async function perform(page: Page, state: GameState, command: CommandBody) {
  switch (command.type) {
    case 'enter-node': await page.getByRole('button', { name: `第 ${state.run.floor + 1} 层 ${catalog.map[state.run.floor]!.name}`, exact: true }).click(); break;
    case 'play-card': {
      const card = state.battle!.hand.find(c => c.id === command.draft.cardId)!, def = catalog.cards[card.definitionId]!;
      await page.locator(`[data-card-id="${card.id}"]`).click();
      if (def.effect.type === 'variable') await page.getByRole('button', { name: String(command.draft.options.variable ?? 4), exact: true }).click();
      if (def.effect.params.operation === 'sum' && command.draft.options.mode === 'block') await page.getByRole('button', { name: '获得护甲', exact: true }).click();
      for (let i = 0; i < command.draft.tokenIds.length; i++) {
        const id = command.draft.tokenIds[i]; if (!id) continue;
        await page.getByRole('button', { name: new RegExp(`^槽位 ${i + 1} `) }).click();
        await page.locator(`[data-token-id="${id}"]`).click();
      }
      await page.getByRole('button', { name: /^确认出牌/ }).click(); break;
    }
    case 'end-turn': await page.getByRole('button', { name: '结束回合', exact: true }).click(); break;
    case 'discard-token': await page.locator(`[data-token-id="${command.tokenId}"]`).click(); break;
    case 'choose-reward': await page.getByRole('button', { name: command.definitionId ? `选择 ${catalog.cards[command.definitionId]!.name}` : '跳过奖励，继续攀登 →', exact: true }).click(); break;
    case 'rest-heal': await page.getByRole('button', { name: /^休息/ }).click(); break;
    case 'engrave-card': {
      await page.getByRole('button', { name: /^铭刻/ }).click();
      const name = catalog.cards[state.run.deck.find(c => c.id === command.cardId)!.definitionId]!.name;
      await page.getByRole('button', { name: new RegExp(`^${name}\\s*#${command.cardId.split('-')[1]}$`) }).click();
      await page.getByLabel('铭刻槽位').selectOption(String(command.slot));
      await page.getByRole('button', { name: String(command.value), exact: true }).click();
      await page.getByRole('button', { name: new RegExp(`^确认铭刻 ${command.value}`) }).click(); break;
    }
  }
  const result = applyCommand(state, command, catalog);
  if (!result.accepted) throw new Error(result.reason);
  await expect(page.locator('main')).toHaveAttribute('data-revision', String(result.state.revision));
  return result.state;
}

test('菜单开始、点击填槽、取消与 Enter 确认，不会重复结算', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { state } = fixture(['product', 'constant', 'defend'], [3, 4]);
  await importState(page, state);
  await page.getByRole('button', { name: '选择卡牌 双联', exact: true }).click();
  await page.getByRole('button', { name: /^数字 3，/ }).click();
  await page.getByRole('button', { name: /^数字 4，/ }).click();
  await expect(page.getByLabel('出牌面板')).toContainText('3 × 4 = 12 伤害');
  await page.keyboard.press('Escape');
  await expect(page.locator('main')).toHaveAttribute('data-revision', String(state.revision));
  await expect(page.getByTestId('number-token')).toHaveCount(2);
  await page.getByRole('button', { name: '选择卡牌 双联', exact: true }).click();
  await page.getByRole('button', { name: /自动.*填槽/s }).click();
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-revision', String(state.revision + 1));
  await expect(page.getByRole('button', { name: '选择卡牌 双联', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('number-token')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('拖放和点击得到相同的出牌预览', async ({ page }) => {
  const { state } = fixture(['product'], [3, 4]); await importState(page, state);
  await page.getByRole('button', { name: '选择卡牌 双联', exact: true }).click();
  await page.getByRole('button', { name: /^数字 3，/ }).dragTo(page.getByRole('button', { name: /^槽位 1 / }));
  await page.getByRole('button', { name: /^数字 4，/ }).dragTo(page.getByRole('button', { name: /^槽位 2 / }));
  await expect(page.getByLabel('出牌面板')).toContainText('3 × 4 = 12 伤害');
  await page.getByRole('button', { name: /^确认出牌/ }).click();
  await expect(page.getByTestId('number-token')).toHaveCount(0);
});

test('超容量选择可保存、刷新恢复，并继续弃数', async ({ page }) => {
  const { state } = fixture(['constant'], [0, 1, 2, 3, 4, 5, 6]); state.battle!.phase = 'choice'; state.battle!.pendingChoice = { type: 'overflow', count: 1 };
  await importState(page, state); await page.reload(); await page.getByRole('button', { name: /^继续攀登/ }).click();
  await expect(page.getByTestId('number-token')).toHaveCount(7); await expect(page.getByRole('button', { name: '结束回合', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /^数字 0，/ }).click();
  await expect(page.getByTestId('number-token')).toHaveCount(6); await expect(page.getByRole('button', { name: '结束回合', exact: true })).toBeEnabled();
});

test('当前存档损坏时恢复有效备份，坏导入不覆盖进度', async ({ page }) => {
  const { state } = fixture(['constant']); await importState(page, state);
  await perform(page, state, { type: 'play-card', draft: { cardId: state.battle!.hand[0]!.id, tokenIds: [], options: {} } });
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('number-spire'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => { const tx = database.transaction('saves', 'readwrite'); tx.objectStore('saves').put({ key: 'current', json: 'corrupt' }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); database.close();
  });
  await page.reload(); await expect(page.getByRole('status')).toContainText('有效备份');
  await page.getByRole('button', { name: /^继续攀登/ }).click(); await expect(page.locator('main')).toHaveAttribute('data-revision', String(state.revision));
  await page.getByRole('button', { name: '设置与存档', exact: true }).click();
  await page.getByLabel('导入存档文件').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.getByRole('status')).toContainText('JSON'); await expect(page.locator('main')).toHaveAttribute('data-revision', String(state.revision));
});

test('1280、1920 与窄屏布局完整，保存验收截图', async ({ page }, info) => {
  const screenshots = 'docs/screenshots'; if (info.project.name === 'chrome') await mkdir(screenshots, { recursive: true });
  await page.goto('/'); await expect(page.getByRole('button', { name: '开始攀登', exact: true })).toBeEnabled();
  if (info.project.name === 'chrome') await page.screenshot({ path: `${screenshots}/menu-1280.png` });
  const { state } = fixture(['constant', 'variable', 'strike', 'defend', 'product'], [2, 3, 4]);
  await importState(page, state); await page.getByRole('button', { name: '选择卡牌 双联', exact: true }).click(); await page.getByRole('button', { name: /自动.*填槽/s }).click();
  for (const [width, height] of [[1280, 720], [1920, 1080], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
    expect(dimensions.width).toBeLessThanOrEqual(width);
    if (width >= 1280) {
      expect(dimensions.height).toBeLessThanOrEqual(height);
      for (const label of ['出牌面板', '数字池', '手牌']) { const box = await page.getByLabel(label, { exact: true }).boundingBox(); expect(box!.y + box!.height).toBeLessThanOrEqual(height); }
    }
    await expect(page.getByRole('button', { name: /^确认出牌/ })).toBeVisible();
    if (info.project.name === 'chrome') await page.screenshot({ path: `${screenshots}/battle-${width}.png`, fullPage: true });
  }
});

test('铭刻永久保存，并在下一战自动填入固定槽', async ({ page }) => {
  const initial = createRun({}, 'ENGRAVE', catalog); initial.run.floor = 2;
  initial.run.visited = catalog.map.slice(0, 2).map(node => node.id);
  const entered = applyCommand(initial, { type: 'enter-node' }, catalog);
  if (!entered.accepted) throw new Error(entered.reason);
  let state = entered.state; await importState(page, state);
  const product = state.run.deck.find(card => card.definitionId === 'product')!;
  state = await perform(page, state, { type: 'engrave-card', cardId: product.id, slot: 0, value: 3 });
  await page.getByRole('button', { name: '本次牌组', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('刻 3');
  await page.getByRole('button', { name: '关闭面板', exact: true }).click();
  state = await perform(page, state, { type: 'enter-node' });
  if (!state.battle!.hand.some(card => card.id === product.id)) state = await perform(page, state, { type: 'end-turn' });
  await page.locator(`[data-card-id="${product.id}"]`).click();
  await expect(page.getByRole('button', { name: /^槽位 1 / })).toContainText('已铭刻');
  await page.getByRole('button', { name: /^数字 2，/ }).click();
  await expect(page.getByRole('button', { name: /^确认出牌/ })).toBeEnabled();
  await page.getByRole('button', { name: '设置与存档', exact: true }).click();
  await page.getByLabel('减少动画', { exact: true }).check();
  await page.getByRole('button', { name: '关闭面板', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-revision', String(state.revision));
  await expect(page.getByRole('button', { name: /^确认出牌/ })).toBeEnabled();
  await page.reload(); await page.getByRole('button', { name: /^继续攀登/ }).click();
  await page.locator(`[data-card-id="${product.id}"]`).click();
  await expect(page.getByRole('button', { name: /^槽位 1 / })).toContainText('已铭刻');
});

test('失败后能够重新开始新对局', async ({ page }) => {
  const { state } = fixture(['constant']); state.run.hp = 1;
  await importState(page, state);
  await perform(page, state, { type: 'end-turn' });
  await expect(page.getByRole('heading', { name: '这次的解，留在了途中。', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '开启新的攀登', exact: true }).click();
  await page.getByRole('button', { name: '开始攀登', exact: true }).click();
  await expect(page.getByRole('heading', { name: '整数原野', exact: true })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('data-revision', '0');
});

test('从菜单完成六层攀登，包括奖励、休息和首领战', async ({ page }) => {
  await page.goto('/'); await page.getByRole('textbox', { name: '世界种子', exact: true }).fill('SPIRE-BALANCE-0');
  await page.getByRole('button', { name: '开始攀登', exact: true }).click();
  let state = createRun({}, 'SPIRE-BALANCE-0', catalog); const screens = new Set<string>(); const commands = new Set<string>();
  for (let step = 0; step < 400; step++) {
    const command = decide(state, catalog, 'mixed'); if (!command) break;
    screens.add(state.screen); commands.add(command.type); state = await perform(page, state, command);
  }
  expect(state.screen).toBe('won'); expect([...screens]).toEqual(expect.arrayContaining(['map', 'battle', 'reward', 'rest'])); expect(commands.has('rest-heal') || commands.has('engrave-card')).toBe(true);
  await expect(page.getByRole('heading', { name: '此刻，你就是最优解。', exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: '探索图鉴', exact: true }).first().click(); await page.getByRole('button', { name: '攀登记录', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('初次登顶 · 已达成');
});
