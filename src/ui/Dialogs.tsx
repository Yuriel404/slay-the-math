import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { catalog } from '../content/catalog';
import { useSession } from '../application/runtime';
import { Card } from './Card';
import { EnemyArt, Icon } from './Art';
import styles from './Game.module.css';

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  return <div className={styles.modalBackdrop} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`${styles.modal} ${wide ? styles.wideModal : ''}`} ref={ref} role="dialog" aria-modal="true" aria-label={title} onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (e.key === 'Tab') {
      const elements = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')];
      const first = elements[0], last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}><header><div><span className={styles.eyebrow}>NUMBER SPIRE</span><h2>{title}</h2></div><button className={styles.iconButton} aria-label="关闭面板" onClick={onClose}><Icon name="close" /></button></header><div className={styles.modalBody}>{children}</div></div></div>;
}

export function HelpContent() {
  return <div className={styles.helpContent}><p className={styles.helpIntro}>你的任务不是心算，而是决定每个数字该用在哪里。</p>{[
    ['01', '先获得数字', '每回合常数表给你一个 2。打出「常数」获得 3，或用「变量 x」生成两枚相同的 1～4。相同数值的筹码也能分别使用。'],
    ['02', '选择卡牌，再填槽', '点击攻防或加工卡，再点击数字池筹码，或拖到槽位中。点击已填槽位可清空；自动填槽会填入当前合法的最高数值组合。'],
    ['03', '看清算式，确认行动', '面板显示最终伤害、护甲或加工结果。确认后才消耗筹码和能量；取消不产生消耗。Enter 确认，Esc 取消。'],
    ['04', '读懂意图，再结束回合', '护甲抵挡敌方攻击，下回合开始清零。手牌弃置，未用筹码清空。数字池超出 6 枚时，需要先点击弃置多余筹码。'],
  ].map(([n, title, detail]) => <div className={styles.helpStep} key={n}><b>{n}</b><div><h3>{title}</h3><p>{detail}</p></div></div>)}<div className={styles.helpTip}><Icon name="spark" /><p>同一组 2、3、3，可以用双联打出 9，再用 2 防御。观察敌人的攻击，选择你需要的攻防组合。</p></div></div>;
}

export function PileContent({ type }: { type: 'deck' | 'draw' | 'discard' | 'exhaust' }) {
  const game = useSession(s => s.game);
  if (!game) return <p>开始一次攀登后，你的牌组会出现在这里。</p>;
  const pile = type === 'deck' ? game.run.deck : type === 'draw' ? game.battle?.drawPile : type === 'discard' ? game.battle?.discardPile : game.battle?.exhaustPile;
  const cards = [...(pile ?? [])].sort((a, b) => catalog.cards[a.definitionId]!.name.localeCompare(catalog.cards[b.definitionId]!.name, 'zh-CN'));
  return <><p className={styles.muted}>{cards.length} 张卡牌{type === 'draw' ? ' · 按名称排列，实际抽牌顺序隐藏' : ''}</p><div className={styles.collectionGrid}>{cards.map(card => <Card key={card.id} definition={catalog.cards[card.definitionId]!} instance={card} />)}</div>{!cards.length && <div className={styles.emptyState}>这里暂时没有卡牌。</div>}</>;
}

export function LogContent() {
  const game = useSession(s => s.game), logs = game?.logs ?? [];
  return <div className={styles.logs}>{[...logs].reverse().map((event, i) => <div key={i}><span>{event.turn ? `T${String(event.turn).padStart(2, '0')}` : '—'}</span><Icon name={event.type.includes('damage') ? 'sword' : event.type.includes('number') ? 'spark' : 'log'} size={15} /><p>{event.message}</p></div>)}{!logs.length && <p>行动记录将出现在这里。</p>}</div>;
}

export function Compendium() {
  const [tab, setTab] = useState<'cards' | 'enemies' | 'history'>('cards');
  const profile = useSession(s => s.profile);
  return <><div className={styles.tabs}>{(['cards', 'enemies', 'history'] as const).map(t => <button key={t} className={t === tab ? styles.tabActive : ''} onClick={() => setTab(t)}>{t === 'cards' ? `卡牌 ${profile.seenCards.length} / ${Object.keys(catalog.cards).length}` : t === 'enemies' ? `敌人 ${profile.seenEnemies.length} / ${Object.keys(catalog.enemies).length}` : '攀登记录'}</button>)}</div>{tab === 'cards' ? <><p className={styles.muted}>点击探索不会改变角色属性。已发现的内容随存档记录在本机。</p><div className={styles.collectionGrid}>{Object.values(catalog.cards).map(card => <div key={card.id}><Card definition={card} /><span className={profile.seenCards.includes(card.id) ? styles.discovered : styles.undiscovered}>{profile.seenCards.includes(card.id) ? '● 已发现' : '○ 尚未获得'}</span></div>)}</div></> : tab === 'enemies' ? <div className={styles.enemyCollection}>{Object.values(catalog.enemies).map(enemy => <article key={enemy.id}><EnemyArt id={enemy.id} /><h3>{enemy.name}<small>{enemy.hp} HP</small></h3><p>{enemy.description}</p><span className={styles.muted}>{profile.seenEnemies.includes(enemy.id) ? '● 已遭遇' : '○ 尚未遭遇'}</span></article>)}</div> : <><div className={styles.achievement}><Icon name="tower" size={32} /><div><h3>{profile.history.some(h => h.won) ? '初次登顶 · 已达成' : '初次登顶 · 等待达成'}</h3><p>突破埃氏筛，完成一次七层攀登。</p></div></div>{profile.history.length ? <div className={styles.history}>{profile.history.map(h => <div key={h.key}><b>{h.won ? '登顶' : '止步途中'}</b><span>{h.floors} 层 · {h.turns} 回合</span><code>{h.seed}</code><small>{new Date(h.at).toLocaleDateString('zh-CN')}</small></div>)}</div> : <div className={styles.emptyState}>第一段攀登故事，从你开始。</div>}</>}</>;
}
