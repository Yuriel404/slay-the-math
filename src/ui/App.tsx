import { useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { audio, desktop, useSession } from '../application/runtime';
import { desktopExportJson, desktopImportJson, desktopSaveLocation } from '../platform/desktop';
import { catalog } from '../content/catalog';
import { Battle } from './Battle';
import { Compendium, HelpContent, LogContent, Modal, PileContent } from './Dialogs';
import { EndScreen, MapScreen, Menu, RestScreen, RewardScreen } from './Screens';
import { Icon } from './Art';
import styles from './Game.module.css';

type Dialog = 'deck' | 'draw' | 'discard' | 'exhaust' | 'log' | 'map' | 'compendium' | 'settings' | 'help' | 'new-run';
const dialogTitles: Record<Dialog, string> = { deck: '本次牌组', draw: '抽牌堆', discard: '弃牌堆', exhaust: '消耗区', log: '战斗记录', map: '攀登路线', compendium: '探索图鉴', settings: '设置与存档', help: '玩法指南', 'new-run': '开始新的攀登' };
function readPreferences() {
  const fallback = { reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches, sound: false };
  try { const stored = JSON.parse(localStorage.getItem('number-spire-preferences') ?? '{}') as Record<string, unknown>; return { reducedMotion: typeof stored.reducedMotion === 'boolean' ? stored.reducedMotion : fallback.reducedMotion, sound: typeof stored.sound === 'boolean' ? stored.sound : false }; } catch { return fallback; }
}
export function App() {
  const session = useSession(), game = session.game;
  const [menu, setMenu] = useState(true), [dialog, setDialog] = useState<Dialog | null>(null), [seed, setSeed] = useState('SPIRE-001');
  const [preferences, setPreferences] = useState(readPreferences), [fileError, setFileError] = useState<string | null>(null);
  const [saveLocation, setSaveLocation] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { void useSession.getState().initialize(); }, []);
  useEffect(() => { audio.setEnabled(preferences.sound); try { localStorage.setItem('number-spire-preferences', JSON.stringify(preferences)); } catch { /* Gameplay storage reports its own errors. */ } }, [preferences]);
  useEffect(() => { if (session.notice) { const timer = setTimeout(() => session.clearNotice(), 6500); return () => clearTimeout(timer); } }, [session.notice, session.clearNotice]);
  useEffect(() => { if (desktop && dialog === 'settings' && !saveLocation) void desktopSaveLocation().then(setSaveLocation); }, [dialog, saveLocation]);
  async function start() { void audio.unlock(); if (await session.start(seed)) { setMenu(false); setDialog(null); } }
  function requestStart() { if (game && !['won', 'lost'].includes(game.screen)) setDialog('new-run'); else void start(); }
  async function exportSave() {
    const data = session.exportSave();
    if (!data) return;
    const fileName = `number-spire-${(game?.seed ?? 'save').replace(/[^a-z0-9-]/gi, '_')}.json`;
    if (desktop) {
      try { await desktopExportJson(data, fileName); }
      catch (error) { setFileError(`导出失败：${String(error)}`); }
      return;
    }
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function applyImport(text: string) {
    const success = await session.importSave(text);
    if (success) { setDialog(null); setMenu(false); setFileError(null); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) { setFileError('文件过大，请选择 2 MB 以内的 JSON 存档。'); return; }
    try { await applyImport(await file.text()); }
    catch (error) { setFileError(`导入失败：${String(error)}`); }
  }
  async function importFromDialog() {
    if (!desktop) { fileInput.current?.click(); return; }
    try {
      const text = await desktopImportJson();
      if (text) await applyImport(text);
    } catch (error) { setFileError(`导入失败：${String(error)}`); }
  }
  const activeGame = !menu && game;
  const busy = session.busy || !!session.pending;
  return <MotionConfig reducedMotion={preferences.reducedMotion ? 'always' : 'user'}><div className={styles.app} data-reduced-motion={preferences.reducedMotion}>
    <div className={styles.appShell} inert={dialog ? true : undefined}>
      <aside className={styles.sidebar}><button className={styles.logo} aria-label="返回主菜单" onClick={() => setMenu(true)}><Icon name="tower" size={29} /></button><div className={styles.navItems}><button className={!menu && game?.screen === 'map' ? styles.navActive : ''} disabled={!game} title="攀登路线" aria-label="攀登路线" onClick={() => setDialog('map')}><Icon name="map" /><span>路线</span></button><button title="本次牌组" aria-label="本次牌组" disabled={!game} onClick={() => setDialog('deck')}><Icon name="cards" /><span>牌组</span></button><button title="探索图鉴" aria-label="探索图鉴" onClick={() => setDialog('compendium')}><Icon name="book" /><span>图鉴</span></button></div><div className={styles.navBottom}><span className={styles.sidebarVersion}>V0.3</span><button title="设置与存档" aria-label="设置与存档" onClick={() => setDialog('settings')}><Icon name="settings" /></button></div></aside>
      <div className={styles.workspace}><header className={styles.topbar}><button className={styles.brand} onClick={() => setMenu(true)}><b>数字尖塔</b><span>NUMBER SPIRE</span></button>{activeGame ? <div className={styles.topStats}><div className={styles.healthStat}><Icon name="heart" size={18} /><b>{game.run.hp}<small>/ {game.run.maxHp}</small></b><span className={styles.topHealthBar}><i style={{ width: `${game.run.hp / game.run.maxHp * 100}%` }} /></span></div><div className={styles.energyStat}><Icon name="bolt" size={17} /><b>{game.battle?.energy ?? catalog.rules.energy}<small>/ {catalog.rules.energy}</small></b></div><div title="常数表：每回合开始获得一枚数字 2" className={styles.relicStat}>2<span>常数表</span></div><div className={styles.goldStat}><Icon name="coin" size={17} />{game.run.gold}</div></div> : <span className={styles.topTag}>一场关于数字与选择的攀登</span>}<div className={styles.topRight}><span className={`${styles.saveStatus} ${session.saveStatus === 'error' ? styles.saveError : ''}`}><i />{session.saveStatus === 'saving' ? '保存中' : session.saveStatus === 'saved' ? '已自动保存' : session.saveStatus === 'error' ? '保存失败' : '本地游戏'}</span>{activeGame && <span className={styles.floorStat}>{String(game.run.floor + 1).padStart(2, '0')}<small>/ {String(catalog.map.length).padStart(2, '0')} 层</small></span>}<button className={styles.iconButton} title={preferences.sound ? '关闭音效' : '开启音效'} aria-label={preferences.sound ? '关闭音效' : '开启音效'} onClick={() => { const next = !preferences.sound; audio.setEnabled(next); setPreferences({ ...preferences, sound: next }); if (next) void audio.unlock(); }}><Icon name="sound" size={18} />{!preferences.sound && <span className={styles.mutedSlash} />}</button></div></header>
        {session.error && <div className={styles.errorBanner} role="alert"><span>{session.error}</span>{session.pending && <button disabled={session.busy} onClick={async () => { const success = await session.retrySave(); if (success && !session.game) setMenu(false); }}>重试保存</button>}<button disabled={!game && !session.pending} onClick={() => void exportSave()}>导出进度</button></div>}
        <main className={styles.main} data-revision={game?.revision ?? 0}>{menu || !game ? <Menu seed={seed} setSeed={setSeed} onStart={requestStart} onContinue={() => setMenu(false)} onHelp={() => setDialog('help')} onBook={() => setDialog('compendium')} /> : game.screen === 'map' ? <MapScreen state={game} /> : game.screen === 'battle' ? <Battle state={game} reducedMotion={preferences.reducedMotion} keyboardEnabled={!dialog} openDialog={setDialog} /> : game.screen === 'reward' ? <RewardScreen state={game} /> : game.screen === 'rest' ? <RestScreen state={game} /> : <EndScreen state={game} onNewRun={() => { setMenu(true); setSeed(Math.random().toString(36).slice(2, 10).toUpperCase()); }} />}</main>
      </div>
    </div>
    {session.notice && <div className={styles.toast} role="status"><Icon name="help" size={18} /><span>{session.notice}</span><button aria-label="关闭提示" onClick={session.clearNotice}><Icon name="close" size={16} /></button></div>}
    {dialog && <Modal title={dialogTitles[dialog]} onClose={() => { setDialog(null); setFileError(null); }} wide={['compendium', 'deck', 'draw', 'discard', 'exhaust', 'map'].includes(dialog)}>
      {['deck', 'draw', 'discard', 'exhaust'].includes(dialog) ? <PileContent type={dialog as 'deck' | 'draw' | 'discard' | 'exhaust'} /> : dialog === 'help' ? <HelpContent /> : dialog === 'compendium' ? <Compendium /> : dialog === 'log' ? <LogContent /> : dialog === 'map' && game ? <MapScreen state={game} readonly /> : dialog === 'new-run' ? <div className={styles.newRunDialog}><p>新的攀登会覆盖当前对局。你可以先导出当前进度。</p><p className={styles.muted}>新世界种子：{seed}</p><div><button className={styles.secondaryButton} disabled={busy} onClick={() => void exportSave()}>导出当前进度</button><button className={styles.primaryButton} disabled={busy} onClick={() => void start()}>开始新攀登<Icon name="arrow" size={18} /></button></div></div> : dialog === 'settings' ? <div className={styles.settings}>
        <label><div><b>减少动画</b><span>关闭角色浮动与界面过渡</span></div><input aria-label="减少动画" type="checkbox" checked={preferences.reducedMotion} onChange={e => setPreferences({ ...preferences, reducedMotion: e.target.checked })} /></label><label><div><b>游戏音效</b><span>轻量合成反馈，无背景音乐</span></div><input aria-label="游戏音效" type="checkbox" checked={preferences.sound} onChange={e => { audio.setEnabled(e.target.checked); setPreferences({ ...preferences, sound: e.target.checked }); if (e.target.checked) void audio.unlock(); }} /></label><div className={styles.saveSection}><h3>对局存档</h3><p>{desktop ? '进度以 JSON 文件保存在本机应用数据目录，每次有效操作后自动保存。写入采用临时文件替换，保留最近一个有效备份。' : '进度保存在本机浏览器，每次有效操作后自动保存。保留最近一个有效备份；切换浏览器或设备时可导出迁移。'}</p>{desktop && saveLocation && <p className={styles.savePath} title={saveLocation}>存档目录 · {saveLocation}</p>}<div><button className={styles.secondaryButton} disabled={!game && !session.pending} onClick={() => void exportSave()}><Icon name="download" size={17} />导出 JSON</button><button className={styles.secondaryButton} disabled={busy} onClick={() => void importFromDialog()}><Icon name="upload" size={17} />导入 JSON</button></div><input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="导入存档文件" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }} />{fileError && <p className={styles.errorText}>{fileError}</p>}</div><div className={styles.about}><Icon name="tower" /><span>数字尖塔 V0.3 · 规则 v1 · {desktop ? '桌面版' : '网页版'}<br />代数师 / {Object.keys(catalog.cards).length} 种卡牌 / {catalog.map.length} 层短流程</span></div>
      </div> : null}
    </Modal>}
  </div></MotionConfig>;
}
