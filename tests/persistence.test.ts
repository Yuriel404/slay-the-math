import { describe, expect, it } from 'vitest';
import { catalog } from '../src/content/catalog';
import { createSession } from '../src/application/session';
import { applyCommand, createRun } from '../src/core';
import { GameEventBus } from '../src/platform/contracts';
import { decodeSave, encodeSave, saveMigrations, validateState } from '../src/platform/save-schema';
import { MemorySaveRepository } from '../src/platform/storage';
import { decide } from '../tools/policies';
import { fixture, runCommand } from './fixtures';

describe('存档格式、迁移和复现', () => {
  it('完整序列化并恢复待弃数状态', () => {
    const { state } = fixture(['variable'], [0, 1, 2, 3, 4, 5, 6]);
    state.battle!.phase = 'choice'; state.battle!.pendingChoice = { type: 'overflow', count: 1 };
    const restored = decodeSave(encodeSave(state), catalog);
    expect(restored).toEqual(state); expect(restored.battle!.pendingChoice?.count).toBe(1);
  });
  it('存档恢复与连续运行产生相同的抽牌和奖励', () => {
    let live = createRun({}, 'SPIRE-BALANCE-0', catalog);
    for (let i = 0; i < 20; i++) { const cmd = decide(live, catalog, 'mixed'); if (cmd) live = runCommand(live, cmd, catalog); }
    let restored = decodeSave(encodeSave(live), catalog);
    for (let i = 0; i < 500; i++) {
      const cmd = decide(live, catalog, 'mixed'); if (!cmd) break;
      live = runCommand(live, cmd, catalog); restored = runCommand(restored, cmd, catalog); expect(restored).toEqual(live);
    }
    expect(live.screen).toBe('won');
  });
  it('拒绝损坏、未知版本和超大文件，保留传入原文', () => {
    const original = encodeSave(createRun({}, 'SAVE', catalog)), envelope = JSON.parse(original);
    expect(() => decodeSave('{', catalog)).toThrow('JSON');
    envelope.schemaVersion = 99; expect(() => decodeSave(JSON.stringify(envelope), catalog)).toThrow('不兼容');
    expect(() => decodeSave('x'.repeat(2_000_001), catalog)).toThrow('过大');
    expect(decodeSave(original, catalog).seed).toBe('SAVE');
  });
  it('支持按版本注册显式迁移', () => {
    const state = createRun({}, 'MIGRATION', catalog), envelope = JSON.parse(encodeSave(state)); envelope.schemaVersion = 0;
    saveMigrations.set(0, raw => ({ ...(raw as object), schemaVersion: 1 }));
    try { expect(decodeSave(JSON.stringify(envelope), catalog)).toEqual(state); }
    finally { saveMigrations.delete(0); }
  });
  it('拒绝重复身份、非法牌堆归属、铭刻和随机数状态', () => {
    const { state } = fixture(['strike', 'defend'], [3]);
    const duplicate = structuredClone(state); duplicate.battle!.hand[1] = duplicate.battle!.hand[0]!;
    expect(() => validateState(duplicate, catalog)).toThrow('不守恒');
    const invalid = structuredClone(state); invalid.run.deck[0]!.engraving = { slot: 4, value: 3 };
    expect(() => validateState(invalid, catalog)).toThrow('铭刻');
    const zero = structuredClone(state); zero.rng.battle = [0, 0, 0, 0];
    expect(() => validateState(zero, catalog)).toThrow('随机数');
  });
  it('拒绝不兼容内容版本', () => { const state = createRun({}, 'VERSION', catalog); state.contentVersion = '9.0'; expect(() => validateState(state, catalog)).toThrow('版本不兼容'); });
});

describe('串行会话与保存失败恢复', () => {
  it('保存前不显示新结果，重复确认不会重复推进状态', async () => {
    const repo = new MemorySaveRepository(catalog), bus = new GameEventBus();
    const store = createSession(catalog, repo, bus); await store.getState().start('CONCURRENCY');
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const save = repo.save.bind(repo); repo.save = async state => { await gate; await save(state); };
    const before = store.getState().game!, pending = store.getState().dispatch({ type: 'enter-node' });
    expect(store.getState().game).toBe(before); expect(store.getState().busy).toBe(true);
    expect(await store.getState().dispatch({ type: 'enter-node' })).toBe(false);
    release(); expect(await pending).toBe(true); expect(store.getState().game!.revision).toBe(1);
  });
  it('保存失败保留待存进度，可导出并重试，事件只发布一次', async () => {
    const repo = new MemorySaveRepository(catalog), bus = new GameEventBus(), seen: string[] = [];
    bus.subscribe(event => seen.push(event.type));
    const store = createSession(catalog, repo, bus); await store.getState().start('SAVE-FAIL');
    const save = repo.save.bind(repo); repo.save = async () => { throw new Error('磁盘空间不足'); };
    const before = store.getState().game!;
    expect(await store.getState().dispatch({ type: 'enter-node' })).toBe(false);
    expect(store.getState().game).toBe(before); expect(store.getState().pending!.game.screen).toBe('battle'); expect(store.getState().saveStatus).toBe('error'); expect(seen).toHaveLength(0);
    expect(decodeSave(store.getState().exportSave()!, catalog).screen).toBe('battle');
    expect(await store.getState().dispatch({ type: 'enter-node' })).toBe(false);
    repo.save = save; expect(await store.getState().retrySave()).toBe(true);
    expect(store.getState().game!.screen).toBe('battle'); expect(seen.filter(type => type === 'battle-started')).toHaveLength(1);
  });
  it('坏存档导入不覆盖当前会话', async () => {
    const store = createSession(catalog, new MemorySaveRepository(catalog), new GameEventBus());
    await store.getState().start('SAFE'); const before = store.getState().game;
    expect(await store.getState().importSave('broken')).toBe(false); expect(store.getState().game).toBe(before);
  });
  it('初始化能加载存档，且状态变化与内核一致', async () => {
    const repo = new MemorySaveRepository(catalog), initial = createRun({}, 'INIT', catalog); await repo.save(initial);
    const store = createSession(catalog, repo, new GameEventBus()); await store.getState().initialize();
    expect(store.getState().game).toEqual(initial); expect(store.getState().initialized).toBe(true);
    const result = applyCommand(initial, { type: 'enter-node' }, catalog); await store.getState().dispatch({ type: 'enter-node' });
    expect(store.getState().game).toEqual(result.state);
  });
});
