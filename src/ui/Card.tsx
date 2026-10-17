import { kindNames, rarityNames } from '../content/catalog';
import type { CardDefinition, CardInstance } from '../core';
import styles from './Game.module.css';

export function Card({ definition, instance, selected = false, disabled = false, onClick, large = false }: {
  definition: CardDefinition; instance?: CardInstance; selected?: boolean; disabled?: boolean; onClick?: () => void; large?: boolean;
}) {
  const rarity = definition.rarity ?? 'common';
  const contents = <>
    <div className={styles.cardTop}><span className={styles.cost}>{definition.cost}</span><span>{kindNames[definition.kind]}{definition.exhaust ? ' · 消耗' : ''}</span></div>
    <div className={styles.cardSymbol}>{definition.symbol}<span className={styles.symbolRing} /></div>
    <div className={styles.cardName}>{definition.name}{instance?.engraving && <span className={styles.engravedBadge}>刻 {instance.engraving.value}</span>}</div>
    <p>{definition.description}</p>
    <div className={styles.cardSlots}>{definition.slots.length ? definition.slots.map((slot, i) => <span key={i}>{instance?.engraving?.slot === i ? instance.engraving.value : slot.label === 'n' || slot.label === 'a' || slot.label === 'b' ? '□' : slot.label}</span>) : <span>{definition.kind === 'power' ? '持续生效' : '生成数字'}</span>}<small>{rarityNames[rarity] === '普通' ? definition.subtitle : `${rarityNames[rarity]} · ${definition.subtitle}`}</small></div>
  </>;
  const className = `${styles.card} ${styles[definition.kind]} ${selected ? styles.cardSelected : ''} ${large ? styles.cardLarge : ''}`;
  return onClick
    ? <button data-card-id={instance?.id} data-rarity={rarity} className={className} aria-label={`选择卡牌 ${definition.name}`} aria-pressed={selected} disabled={disabled} onClick={onClick}>{contents}</button>
    : <article data-rarity={rarity} className={className}>{contents}</article>;
}
