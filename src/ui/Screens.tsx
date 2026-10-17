import { useState } from 'react';
import { useSession } from '../application/runtime';
import { catalog } from '../content/catalog';
import { matchesSlot } from '../core';
import type { GameState } from '../core';
import { Card } from './Card';
import { CharacterArt, Icon, TowerArt } from './Art';
import styles from './Game.module.css';

export function Menu({ seed, setSeed, onStart, onContinue, onHelp, onBook }: {
  seed: string; setSeed: (value: string) => void; onStart: () => void; onContinue: () => void; onHelp: () => void; onBook: () => void;
}) {
  const game = useSession(s => s.game), disabled = useSession(s => !s.initialized || s.busy || !!s.pending);
  const resumable = game && !['won', 'lost'].includes(game.screen);
  return <div className={styles.menuPage}>
    <div className={styles.menuCopy}><div className={styles.releaseBadge}><span className={styles.liveDot} />可玩原型 <i /> V0.3</div><div className={styles.menuEnglish}>NUMBER SPIRE</div><h1>用数字，<br />改写<span>胜负。</span></h1><p className={styles.menuIntro}>数字是你的资源，运算是你的武器。<br />在每一次选择中，找到通往塔顶的解。</p>
      <div className={styles.characterChoice}><div className={styles.characterMini}><CharacterArt /></div><div><span className={styles.eyebrow}>YOUR CHARACTER</span><b>代数师 <small>60 生命 · 常数表</small></b><p>稳定产数，自由加工。让每一枚筹码各尽其用。</p></div><span className={styles.choiceCheck}><Icon name="check" size={18} /></span></div>
      <div className={styles.menuActions}>{resumable && <button className={styles.primaryButton} disabled={disabled} onClick={onContinue}>继续攀登 <small>第 {game.run.floor + 1} 层 · {game.run.hp} 生命</small><Icon name="arrow" /></button>}<div className={styles.startRow}><button className={resumable ? styles.secondaryButton : styles.primaryButton} disabled={disabled} onClick={onStart}>{resumable ? '新的攀登' : '开始攀登'}<Icon name="arrow" /></button><label>世界种子<input aria-label="世界种子" value={seed} maxLength={64} onChange={e => setSeed(e.target.value)} spellCheck={false} /></label><button className={styles.iconButton} title="生成新种子" aria-label="生成新种子" onClick={() => setSeed(Math.random().toString(36).slice(2, 10).toUpperCase())}>↻</button></div></div>
      <div className={styles.menuLinks}><button onClick={onHelp}><Icon name="help" size={16} />玩法指南</button><button onClick={onBook}><Icon name="book" size={16} />探索图鉴</button><span>单人 · 回合制 · 策略构筑</span></div>
    </div><div className={styles.menuVisual}><div className={styles.towerCaption}><span>探索 / 构造 / 攀登</span><b>每一步，都有无限可能。</b></div><TowerArt /><div className={styles.visualCoordinate}>INTEGER FIELDS <span>01 — 06</span></div></div>
    <div className={styles.menuBottom}><div><Icon name="cards" /><b>{Object.keys(catalog.cards).length}<span>种可构筑卡牌</span></b></div><div><Icon name="map" /><b>{String(catalog.map.length).padStart(2, '0')}<span>层短途攀登</span></b></div><div><Icon name="spark" /><b>∞<span>数字的可能性</span></b></div><p>先规划，再运算。<br />没有计时器，按你的节奏来。</p></div>
  </div>;
}

export function MapScreen({ state, readonly = false }: { state: GameState; readonly?: boolean }) {
  const dispatch = useSession(s => s.dispatch), busy = useSession(s => s.busy || !!s.pending);
  return <div className={`${styles.mapPage} ${readonly ? styles.mapCompact : ''}`}><span className={styles.eyebrow}>THE ASCENT / ACT I</span><h1>整数原野</h1><p className={styles.pageLead}>沿着数字的轨迹，走向筛选的尽头。</p><div className={styles.route}>
    {catalog.map.map((node, i) => {
      const visited = state.run.visited.includes(node.id), current = i === state.run.floor && state.screen === 'map';
      return <div key={node.id} className={`${styles.routeNode} ${current ? styles.currentNode : ''} ${visited ? styles.visitedNode : ''} ${node.kind === 'boss' ? styles.bossNode : node.kind === 'rest' ? styles.restNode : styles.battleNode}`}><span className={styles.nodeFloor}>FLOOR {String(i + 1).padStart(2, '0')}</span><button aria-label={`第 ${i + 1} 层 ${node.name}`} className={styles.nodeButton} disabled={readonly || !current || busy} onClick={() => void dispatch({ type: 'enter-node' })}><Icon name={visited ? 'check' : node.kind === 'rest' ? 'flame' : node.kind === 'boss' ? 'tower' : 'sword'} size={30} /></button><h2>{node.name}</h2><p>{node.description}</p><span className={styles.nodeStatus}>{visited ? '已完成' : current ? '点击进入' : i === state.run.floor ? '进行中' : <><Icon name="lock" size={12} />尚未抵达</>}</span></div>;
    })}</div>{!readonly && <div className={styles.mapNotes}><div><Icon name="cards" /><p><b>战斗塑造构筑</b><span>普通战斗后，从三张卡牌中选择一张。</span></p></div><div><Icon name="flame" /><p><b>停下来，走得更远</b><span>休息回复 30% 生命，或铭刻一张攻防卡。</span></p></div><div><Icon name="tower" /><p><b>观察首领的规律</b><span>提前规划筹码，绕开 2、3、5 的筛选。</span></p></div></div>}</div>;
}

export function RewardScreen({ state }: { state: GameState }) {
  const dispatch = useSession(s => s.dispatch), busy = useSession(s => s.busy || !!s.pending);
  return <div className={styles.centerPage}><div className={styles.resultBadge}><Icon name="check" size={22} /></div><span className={styles.eyebrow}>BATTLE COMPLETE / +15 金币</span><h1>把下一步，加入牌组。</h1><p className={styles.pageLead}>选择一张卡牌，继续你的构筑。也可以保持精简。</p><div className={styles.rewardCards}>{state.reward.map(id => <div key={id}><Card definition={catalog.cards[id]!} large /><button className={styles.primaryButton} disabled={busy} onClick={() => void dispatch({ type: 'choose-reward', definitionId: id })}>选择 {catalog.cards[id]!.name}<Icon name="arrow" size={18} /></button></div>)}</div><button className={styles.textButton} disabled={busy} onClick={() => void dispatch({ type: 'choose-reward', definitionId: null })}>跳过奖励，继续攀登 →</button></div>;
}

export function RestScreen({ state }: { state: GameState }) {
  const [mode, setMode] = useState<'menu' | 'engrave' | 'remove'>('menu'), [cardId, setCardId] = useState(''), [slot, setSlot] = useState(0), [value, setValue] = useState(2);
  const dispatch = useSession(s => s.dispatch), busy = useSession(s => s.busy || !!s.pending);
  const cards = state.run.deck.filter(c => catalog.cards[c.definitionId]?.engravable && !c.engraving);
  const selected = cards.find(c => c.id === cardId), definition = selected ? catalog.cards[selected.definitionId] : undefined;
  const valid = definition?.slots[slot] && matchesSlot(value, definition.slots[slot]!.rule);
  const heal = Math.min(Math.floor(state.run.maxHp * .3), state.run.maxHp - state.run.hp);
  const canRemove = state.run.gold >= catalog.rules.removeCost && state.run.deck.length > catalog.rules.minDeck;
  const removeTarget = state.run.deck.find(c => c.id === cardId);
  return <div className={styles.centerPage}><div className={styles.restSymbol}><Icon name="flame" size={62} /></div><span className={styles.eyebrow}>A MOMENT OF STILLNESS</span><h1>{catalog.map[state.run.floor]!.name}</h1><p className={styles.pageLead}>让思绪停一停。下一次运算，会更从容。</p>{mode === 'menu' ? <div className={styles.restChoices}>
    <button disabled={busy} onClick={() => void dispatch({ type: 'rest-heal' })}><Icon name="heart" size={32} /><h2>休息</h2><b>+{heal} 生命</b><p>回复最大生命的 30%。<br />当前生命 {state.run.hp} / {state.run.maxHp}</p><span>休整后继续 <Icon name="arrow" size={16} /></span></button>
    <button disabled={busy || !cards.length} onClick={() => { setMode('engrave'); setCardId(cards[0]?.id ?? ''); }}><Icon name="spark" size={32} /><h2>铭刻</h2><b>让一个数字，成为常量。</b><p>将 1、2 或 3 永久刻入一张攻防卡。<br />此槽今后不再消耗筹码。</p><span>选择一张卡牌 <Icon name="arrow" size={16} /></span></button>
    <button disabled={busy || !canRemove} onClick={() => { setMode('remove'); setCardId(state.run.deck[0]?.id ?? ''); }}><Icon name="coin" size={32} /><h2>净化</h2><b>−{catalog.rules.removeCost} 金币</b><p>永久移除一张卡牌，让抽牌更稳定。<br />当前金币 {state.run.gold} · 牌组 {state.run.deck.length} 张</p><span>{canRemove ? <>选择要移除的卡牌 <Icon name="arrow" size={16} /></> : state.run.gold < catalog.rules.removeCost ? '金币不足' : '牌组过于精简'}</span></button>
  </div> : mode === 'engrave' ? <div className={styles.engravingPanel}><div className={styles.engravingCards}>{cards.map(card => <button key={card.id} className={cardId === card.id ? styles.optionSelected : ''} onClick={() => { setCardId(card.id); setSlot(0); }}>{catalog.cards[card.definitionId]!.name}<small>#{card.id.split('-')[1]}</small></button>)}</div>{definition && <><div className={styles.engravingPreview}><Card definition={definition} large /><div><h2>把常量刻入 {definition.name}</h2><p>每张卡仅能铭刻一个槽，铭刻后永久生效。</p><label>选择槽位<select aria-label="铭刻槽位" value={slot} onChange={e => setSlot(Number(e.target.value))}>{definition.slots.map((s, i) => <option key={i} value={i}>第 {i + 1} 槽 · {s.label}</option>)}</select></label><div className={styles.optionRow}>{[1, 2, 3].map(n => <button key={n} className={value === n ? styles.optionSelected : ''} disabled={!matchesSlot(n, definition.slots[slot]!.rule)} onClick={() => setValue(n)}>{n}</button>)}</div><button className={styles.primaryButton} disabled={!valid || busy} onClick={() => void dispatch({ type: 'engrave-card', cardId, slot, value })}>确认铭刻 {value}<Icon name="spark" size={18} /></button><button className={styles.textButton} onClick={() => setMode('menu')}>返回休息选项</button></div></div></>}</div> : <div className={`${styles.engravingPanel} ${styles.removePanel}`}><p className={styles.muted}>选择一张卡牌永久移除，本次攀登不再获得它。</p><div className={`${styles.collectionGrid} ${styles.removeGrid}`}>{state.run.deck.map(card => <button key={card.id} className={`${styles.removeOption} ${cardId === card.id ? styles.removeSelected : ''}`} aria-label={`移除卡牌 ${catalog.cards[card.definitionId]!.name} ${card.id.split('-')[1]}`} onClick={() => setCardId(card.id)}><Card definition={catalog.cards[card.definitionId]!} instance={card} /><small>#{card.id.split('-')[1]}</small></button>)}</div><div className={styles.removeActions}><button className={styles.textButton} onClick={() => setMode('menu')}>返回休息选项</button><button className={styles.primaryButton} disabled={!removeTarget || busy} onClick={() => void dispatch({ type: 'rest-remove', cardId })}>移除 {removeTarget ? catalog.cards[removeTarget.definitionId]!.name : '卡牌'} · −{catalog.rules.removeCost} 金币<Icon name="coin" size={18} /></button></div></div>}</div>;
}

export function EndScreen({ state, onNewRun }: { state: GameState; onNewRun: () => void }) {
  const won = state.screen === 'won';
  return <div className={`${styles.centerPage} ${styles.endScreen}`}><div className={styles.endingIcon}><Icon name={won ? 'tower' : 'spark'} size={64} /></div><span className={styles.eyebrow}>{won ? 'THE SUMMIT IS YOURS' : 'EVERY ATTEMPT IS A NEW EQUATION'}</span><h1>{won ? '此刻，你就是最优解。' : '这次的解，留在了途中。'}</h1><p className={styles.pageLead}>{won ? '你穿过整数原野，突破了埃氏筛。下一次，试试另一种构筑。' : '数字仍有新的排列。带着这次的经验，重新出发。'}</p><div className={styles.runStats}><div><strong>{state.run.visited.length}<small>/ {catalog.map.length}</small></strong><span>完成层数</span></div><div><strong>{state.run.stats.turns}</strong><span>战斗回合</span></div><div><strong>{state.run.stats.damageDealt}</strong><span>累计伤害</span></div><div><strong>{state.run.stats.cardsPlayed}</strong><span>打出卡牌</span></div></div><button className={styles.primaryButton} onClick={onNewRun}>开启新的攀登<Icon name="arrow" /></button><p className={styles.seedCaption}>本次种子 {state.seed} · 历史已自动记录</p></div>;
}
