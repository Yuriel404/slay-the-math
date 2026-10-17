import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useSession } from '../application/runtime';
import { catalog } from '../content/catalog';
import { enumerateDrafts, factorPairs, forecastIntents, incomingDamage, isPrime, matchesSlot, previewAction } from '../core';
import type { ActionDraft, GameState } from '../core';
import { Card } from './Card';
import { CharacterArt, EnemyArt, Icon } from './Art';
import styles from './Game.module.css';

export type BattleDialog = 'draw' | 'discard' | 'exhaust' | 'log' | 'help';
export function Battle({ state, openDialog, reducedMotion, keyboardEnabled }: {
  state: GameState; openDialog: (type: BattleDialog) => void; reducedMotion: boolean; keyboardEnabled: boolean;
}) {
  const b = state.battle!, busy = useSession(s => s.busy || !!s.pending), dispatch = useSession(s => s.dispatch);
  const [draft, setDraft] = useState<ActionDraft | null>(null), [activeSlot, setActiveSlot] = useState(0);
  const card = b.hand.find(c => c.id === draft?.cardId), definition = card ? catalog.cards[card.definitionId] : undefined;
  const preview = useMemo(() => draft ? previewAction(state, draft, catalog) : null, [state, draft]);
  useEffect(() => { if (draft && !b.hand.some(c => c.id === draft.cardId)) setDraft(null); }, [b.hand, draft]);
  const confirm = async () => { if (draft && preview?.valid && !busy) { const success = await dispatch({ type: 'play-card', draft }); if (success) setDraft(null); } };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!keyboardEnabled || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName)) return;
      if (event.key === 'Escape') setDraft(null);
      if (event.key === 'Enter' && !event.repeat && draft && preview?.valid) { event.preventDefault(); void confirm(); }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });
  function selectCard(cardId: string) {
    const instance = b.hand.find(c => c.id === cardId)!, def = catalog.cards[instance.definitionId]!;
    if (draft?.cardId === cardId) { setDraft(null); return; }
    setDraft({ cardId, tokenIds: def.slots.map(() => null), targetId: b.enemies.find(e => e.hp > 0)?.id,
      options: { variable: 4, mode: 'attack', delta: 1 } });
    setActiveSlot(instance.engraving?.slot === 0 ? 1 : 0);
  }
  function fillToken(tokenId: string, specificSlot?: number) {
    if (busy) return;
    if (b.phase === 'choice') { void dispatch({ type: 'discard-token', tokenId }); return; }
    if (!draft || !definition || !card) return;
    let slot = specificSlot ?? activeSlot;
    if (!definition.slots[slot] || card.engraving?.slot === slot) slot = definition.slots.findIndex((_, i) => card.engraving?.slot !== i && !draft.tokenIds[i]);
    if (slot < 0) return;
    const tokenIds = draft.tokenIds.map(id => id === tokenId ? null : id);
    tokenIds[slot] = tokenId;
    setDraft({ ...draft, tokenIds });
    const next = definition.slots.findIndex((_, i) => card.engraving?.slot !== i && !tokenIds[i]);
    if (next >= 0) setActiveSlot(next);
  }
  function changeOptions(options: Partial<ActionDraft['options']>) { if (draft) setDraft({ ...draft, options: { ...draft.options, ...options } }); }
  const choices = useMemo(() => draft ? enumerateDrafts(state, draft.cardId, catalog, draft.options) : [], [state, draft]);
  const scored = useMemo(() => {
    const score = (d: ActionDraft) => previewAction(state, d, catalog).effects.reduce((n, e) => n + (e.type === 'damage' || e.type === 'block' ? e.amount : 0), 0);
    return choices.map(candidate => ({ draft: candidate, preview: previewAction(state, candidate, catalog), score: score(candidate) }));
  }, [choices, state]);
  const best = useMemo(() => scored.reduce((top, item) => Math.max(top, item.score), 0), [scored]);
  // Top distinct combinations double as a decision aid and as one-click fills.
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return [...scored].sort((a, b) => b.score - a.score)
      .filter(item => { if (item.score <= 0 || seen.has(item.preview.formula)) return false; seen.add(item.preview.formula); return true; })
      .slice(0, 3);
  }, [scored]);
  function autoFill() {
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    if (sorted[0]) setDraft(sorted[0].draft);
  }
  const currentValue = draft ? (card?.engraving?.slot === 0 ? card.engraving.value : b.tokens.find(t => t.id === draft.tokenIds[0])?.value) : undefined;
  // Decision support: what the current draft would actually deal, and whether it finishes the target.
  const previewDamage = preview?.effects.reduce((n, e) => n + (e.type === 'damage' ? e.amount : 0), 0) ?? 0;
  const previewBlock = preview?.effects.reduce((n, e) => n + (e.type === 'block' ? e.amount : 0), 0) ?? 0;
  const targetEnemy = b.enemies.find(e => e.id === draft?.targetId);
  const lethal = !!preview?.valid && !!targetEnemy && previewDamage >= targetEnemy.hp;
  const incoming = incomingDamage(b.enemies);
  const activeRule = definition?.slots[activeSlot]?.rule;
  const slotValue = definition && card && activeSlot < definition.slots.length ? (card.engraving?.slot === activeSlot ? card.engraving.value : b.tokens.find(t => t.id === draft?.tokenIds[activeSlot])?.value) : undefined;
  return <div className={styles.battlePage}>
    <div className={styles.pageHeading}>
      <div><span className={styles.eyebrow}>ACT I / 整数原野</span><h1>{catalog.map[state.run.floor]!.name} <span className={styles.stageBadge}>{catalog.map[state.run.floor]!.kind === 'boss' ? '首领战' : '遭遇战'}</span></h1></div>
      <div className={styles.round}>
        <span className={styles.liveDot} />玩家回合 <b>{String(b.turn).padStart(2, '0')}</b>
        {incoming > 0 && <span className={styles.incomingChip} title="若现在结束回合，敌人将造成的总伤害">
          <Icon name="sword" size={13} />受创 <b>{Math.max(0, incoming - b.block)}</b>
        </span>}
        <button className={styles.iconButton} title="玩法指南" aria-label="玩法指南" onClick={() => openDialog('help')}><Icon name="help" size={18} /></button>
      </div>
    </div>
    <div className={styles.arenaGrid}>
      <section className={styles.arena} aria-label="战斗区域">
        <div className={styles.arenaGridLines} />
        <div className={styles.playerFigure}>
          <div className={styles.playerCaption}><span className={styles.eyebrow}>ALGEBRAIST</span><b>代数师</b></div>
          <CharacterArt />
          <div className={styles.playerVitals}><Icon name="shield" size={16} /><b>{b.block}</b><span>护甲</span></div>
        </div>
        <span className={styles.versus}>VS<span>—</span></span>
        <div className={styles.enemies}>
          {b.enemies.map(enemy => {
            const def = catalog.enemies[enemy.definitionId]!, forecast = forecastIntents(catalog, enemy, b.turn + 1, 2);
            return <div key={enemy.id} className={`${styles.enemyFigure} ${enemy.hp === 0 ? styles.enemyDead : ''}`}>
              <div className={styles.intent} title={enemy.intent.formula}><Icon name="sword" size={14} /><span>攻击</span><strong>{enemy.intent.damage}</strong>{enemy.intent.factor && <span className={styles.factorTag}>筛 {enemy.intent.factor}</span>}</div>
              <motion.button className={`${styles.enemyTarget} ${draft?.targetId === enemy.id ? styles.targeted : ''}`} aria-label={`目标 ${def.name}`} disabled={enemy.hp === 0 || busy} onClick={() => draft && setDraft({ ...draft, targetId: enemy.id })} animate={reducedMotion ? {} : { y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}><EnemyArt id={enemy.definitionId} /></motion.button>
              <b>{def.name}</b>
              <div className={styles.enemyHp}><span style={{ width: `${enemy.hp / enemy.maxHp * 100}%` }} /><small>{enemy.hp} / {enemy.maxHp}</small></div>
              <div className={styles.forecastRow} title={enemy.intent.detail}>
                {forecast.map((step, index) => <span key={step.turn} className={index === 0 ? styles.forecastNow : styles.forecastChip}>
                  {index === 0 ? '下回合' : '再下回合'}{step.factor ? ` 筛${step.factor}` : ''} · {step.damage}
                </span>)}
                {!forecast.length && <span className={styles.forecastChip}>{enemy.intent.detail}</span>}
              </div>
            </div>;
          })}
        </div>
        {b.powers.length > 0 && <div className={styles.powerList}>{b.powers.map(c => <span key={c.id} title={catalog.cards[c.definitionId]!.description}>Σ {catalog.cards[c.definitionId]!.name}</span>)}</div>}
      </section>
      <section className={styles.composer} aria-label="出牌面板">
        {definition && draft ? <>
          <div className={styles.composerTitle}><div><small>构造你的行动</small><h2>{definition.name}</h2></div><button className={styles.iconButton} aria-label="取消填槽" title="取消 · Esc" onClick={() => setDraft(null)}><Icon name="close" size={18} /></button></div>
          <div className={styles.composerBody}>
          <div className={styles.slotRow}>{definition.slots.map((slot, i) => {
            const engraved = card?.engraving?.slot === i, value = engraved ? card.engraving!.value : b.tokens.find(t => t.id === draft.tokenIds[i])?.value;
            return <button key={i} className={`${styles.slot} ${activeSlot === i && !engraved ? styles.activeSlot : ''} ${engraved ? styles.engravedSlot : ''}`} aria-label={`槽位 ${i + 1} ${slot.label}${value === undefined ? ' 未填' : ` ${value}`}`} onClick={() => { if (!engraved) { setActiveSlot(i); const ids = [...draft.tokenIds]; ids[i] = null; setDraft({ ...draft, tokenIds: ids }); } }} onDragOver={e => { if (!engraved) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (!engraved) fillToken(e.dataTransfer.getData('text/number-token'), i); }}><strong>{value ?? '□'}</strong><small>{engraved ? '已铭刻' : slot.label}</small></button>;
          })}{definition.slots.length > 0 && <button className={styles.autoFill} onClick={autoFill} disabled={busy || !choices.length} title="填入当前可用的最高数值组合">自动<br />填槽{best > 0 && <em>{best}</em>}</button>}</div>
          {definition.effect.type === 'variable' && <div className={styles.optionRow}><span>x =</span>{[1, 2, 3, 4].map(value => <button key={value} className={draft.options.variable === value ? styles.optionSelected : ''} onClick={() => changeOptions({ variable: value })}>{value}</button>)}</div>}
          {definition.effect.params.operation === 'sum' && <div className={styles.optionRow}>{(['attack', 'block'] as const).map(mode => <button key={mode} className={draft.options.mode === mode ? styles.optionSelected : ''} onClick={() => changeOptions({ mode })}>{mode === 'attack' ? '造成伤害' : '获得护甲'}</button>)}</div>}
          {definition.effect.type === 'adjust' && <div className={styles.optionRow}>{[1, -1].map(delta => <button key={delta} className={draft.options.delta === delta ? styles.optionSelected : ''} onClick={() => changeOptions({ delta })}>{delta === 1 ? '+1' : '−1'}</button>)}</div>}
          {definition.effect.type === 'split' && currentValue !== undefined && <label className={styles.splitInput}>拆成 {draft.options.split ?? Math.floor(currentValue / 2)} 和 {currentValue - (draft.options.split ?? Math.floor(currentValue / 2))}<input aria-label="拆分第一个数字" type="range" min={0} max={currentValue} value={draft.options.split ?? Math.floor(currentValue / 2)} onChange={e => changeOptions({ split: Number(e.target.value) })} /></label>}
          {definition.effect.type === 'factor' && currentValue !== undefined && <div className={styles.optionRow}>{factorPairs(currentValue).map(([a, b]) => <button key={a} className={(draft.options.factor ?? factorPairs(currentValue)[0]?.[0]) === a ? styles.optionSelected : ''} onClick={() => changeOptions({ factor: a })}>{a} × {b}</button>)}</div>}
          {suggestions.length > 1 && <div className={styles.suggestions}>
            <small>可选组合</small>
            {suggestions.map(item => <button key={item.draft.tokenIds.join('|')} className={item.preview.formula === preview?.formula ? styles.suggestionActive : ''} onClick={() => setDraft(item.draft)} title={item.preview.formula}>
              <span>{item.preview.values.join(' · ')} →</span><b>{item.score}</b>
            </button>)}
          </div>}
          </div>
          <div className={styles.composerFooter}>
            <div className={`${styles.formula} ${preview?.valid ? styles.validFormula : ''}`} aria-live="polite"><small>预计效果</small><b>{preview?.formula}</b>
              {preview?.valid && (previewDamage > 0 || previewBlock > 0) && <div className={styles.effectTotals}>
                {previewDamage > 0 && <span className={styles.effectDamage}><Icon name="sword" size={12} />{previewDamage}</span>}
                {previewBlock > 0 && <span className={styles.effectBlock}><Icon name="shield" size={12} />{previewBlock}</span>}
                {lethal && <span className={styles.effectLethal}>击杀</span>}
              </div>}
            </div>
            <button className={`${styles.primaryButton} ${lethal ? styles.lethalButton : ''}`} disabled={!preview?.valid || busy} onClick={() => void confirm()}>{lethal ? '确认出牌 · 击杀' : '确认出牌'} <span>−{definition.cost} 能量</span><Icon name="arrow" size={18} /></button>
          </div>
        </> : <div className={styles.composerEmpty}><span className={styles.emptySymbol}>ƒ(x)</span><h2>每个数字，都有去处。</h2><p>先打出产数牌，再选择攻防卡。<br />点击或拖动数字填槽，确认后结算。</p><div><span>01 选择卡牌</span><span>02 填入数字</span><span>03 确认出牌</span></div></div>}
      </section>
    </div>
    <section className={`${styles.numberPool} ${b.phase === 'choice' ? styles.poolOverflow : ''}`} aria-label="数字池">
      <div className={styles.poolLabel}><span className={styles.eyebrow}>NUMBER POOL</span><b>数字池 <small>{b.tokens.length} / {catalog.rules.poolCapacity}</small></b></div>
      <div className={styles.tokens}>{b.tokens.map(token => {
        const playable = !!draft && !!activeRule && activeRule !== 'any' && matchesSlot(token.value, activeRule) && !draft.tokenIds.includes(token.id);
        return <button key={token.id} data-testid="number-token" data-token-id={token.id} className={`${styles.token} ${draft?.tokenIds.includes(token.id) ? styles.tokenAssigned : ''} ${isPrime(token.value) ? styles.primeToken : ''} ${playable ? styles.tokenPlayable : ''}`} aria-label={`数字 ${token.value}，来自${token.source}`} title={`${token.source} · ${isPrime(token.value) ? '质数' : token.value % 2 ? '奇数' : '偶数'}${b.phase === 'choice' ? ' · 点击弃置' : ''}`} disabled={busy} draggable={b.phase === 'player' && !busy} onDragStart={e => { e.dataTransfer.setData('text/number-token', token.id); e.dataTransfer.effectAllowed = 'move'; }} onClick={() => fillToken(token.id)}>{token.value}<span>{isPrime(token.value) ? '·' : ''}</span></button>;
      })}{Array.from({ length: Math.max(0, catalog.rules.poolCapacity - b.tokens.length) }, (_, i) => <span className={styles.emptyToken} key={i}>·</span>)}</div>
      <div className={styles.poolHint}>{b.phase === 'choice' ? <><b>数字池超出容量</b><span>点击弃置 {b.pendingChoice!.count} 枚筹码</span></> : b.storedTokens.length ? <><b>寄存器 → {b.storedTokens.map(t => t.value).join('、')}</b><span>下回合返还</span></> : slotValue !== undefined && !definition?.slots[activeSlot] ? <><b>槽位已填满</b><span>确认出牌或清空槽位</span></> : <><b>未用数字将在回合末清空</b><span>填槽免费，确认后消耗</span></>}</div>
    </section>
    <section className={styles.handSection} aria-label="手牌">
      <div className={styles.handHeader}><b>手牌 <span>{b.hand.length}</span></b><div><button onClick={() => openDialog('draw')}><Icon name="cards" size={14} />抽牌 {b.drawPile.length}</button><button onClick={() => openDialog('discard')}>弃牌 {b.discardPile.length}</button><button onClick={() => openDialog('exhaust')}>消耗 {b.exhaustPile.length}</button><button onClick={() => openDialog('log')}><Icon name="log" size={14} />战斗记录</button></div></div>
      <div className={styles.handRow}><div className={styles.handCards}>{b.hand.map(card => <Card key={card.id} instance={card} definition={catalog.cards[card.definitionId]!} selected={draft?.cardId === card.id} disabled={busy || b.phase !== 'player'} onClick={() => selectCard(card.id)} />)}{!b.hand.length && <div className={styles.emptyHand}>手牌已用完。结束回合，准备下一次运算。</div>}</div><div className={styles.endTurn}><div><Icon name="bolt" /><strong>{b.energy}</strong><span>/ {catalog.rules.energy}<small>可用能量</small></span></div><button className={styles.endButton} disabled={busy || b.phase !== 'player'} onClick={() => { setDraft(null); void dispatch({ type: 'end-turn' }); }}>结束回合 <Icon name="arrow" size={17} /></button><small>{b.energy > 0 && b.hand.some(c => catalog.cards[c.definitionId]!.cost <= b.energy) ? '还有能量与可出的牌' : '敌方将执行已公布的意图'}</small></div></div>
    </section>
    <div className={styles.battleFooter}><span><kbd>Enter</kbd> 确认出牌 <kbd>Esc</kbd> 取消填槽</span><span>种子 {state.seed} <i /> 常数表：每回合获得 <b>2</b></span></div>
  </div>;
}

/** Kept separate from token selection so extensions can reuse slot rules. */
export const canUseToken = matchesSlot;
