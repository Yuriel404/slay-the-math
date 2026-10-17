export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    tower: 'M12 2 4 22h16L12 2ZM7 15h10M6 19h12M9 10h6',
    map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16',
    cards: 'M7 3h12v17H7V3ZM4 6H2v17h12v-1M10 8h6m-6 4h6m-6 4h3',
    book: 'M12 5C8 2 4 3 2 4v15c3-2 7-1 10 1 3-2 7-3 10-1V4c-3-2-7-1-10 1Zm0 0v15',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 2h6l1 4 4 1 2 5-3 3v4l-5 3-3-2-4 1-4-4 1-4-2-3 3-5 4-1V2Z',
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    bolt: 'm13 2-9 12h7l-1 8 10-13h-8l1-7Z',
    shield: 'm12 2 9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6l9-4Z',
    sword: 'm14 3 7-1-1 7L9 20l-5-5L14 3ZM3 13l8 8M3 21l3-3',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    close: 'm6 6 12 12M6 18 18 6',
    check: 'm5 12 4 4L19 6',
    flame: 'M12 2c1 5 8 8 8 13a8 8 0 0 1-16 0c0-4 3-6 4-8 0 4 2 4 3 5 2-4 2-6 1-10Z',
    log: 'M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h4',
    download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    upload: 'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',
    sound: 'M11 4 6 8H2v8h4l5 4V4Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    lock: 'M6 10V7a6 6 0 0 1 12 0v3M4 10h16v12H4V10Zm8 5v3',
    spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
    coin: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5v10m-3-7h6m-6 4h6',
    help: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4h.01',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.spark} /></svg>;
}

export function TowerArt() {
  return <svg viewBox="0 0 500 540" role="img" aria-label="漂浮在数字原野上的几何尖塔">
    <defs>
      <linearGradient id="towerGlow" x2="0" y2="1"><stop stopColor="#fff2c4" /><stop offset=".55" stopColor="#ffc857" /><stop offset="1" stopColor="#b8791f" /></linearGradient>
      <linearGradient id="stoneFace" x2="0" y2="1"><stop stopColor="#7a63b8" /><stop offset="1" stopColor="#3b2b66" /></linearGradient>
      <radialGradient id="halo"><stop stopColor="#ffc857" stopOpacity=".18" /><stop offset="1" stopColor="#8a5cd0" stopOpacity="0" /></radialGradient>
    </defs>
    <circle cx="250" cy="270" r="238" fill="url(#halo)" />
    <g stroke="#8f78c4" fill="none" opacity=".3"><ellipse cx="250" cy="415" rx="210" ry="70" /><ellipse cx="250" cy="415" rx="160" ry="45" /><path d="M40 415h420M250 345v140M90 370l320 90M90 460l320-90" /><circle cx="250" cy="235" r="170" strokeDasharray="3 10" /></g>
    <g fill="#ffc857" fontFamily="monospace" fontSize="16" opacity=".72"><text x="80" y="220">x²</text><text x="392" y="270">Σ</text><text x="130" y="100">01</text><text x="361" y="135">∞</text><text x="70" y="360">+</text><text x="414" y="383">×</text></g>
    <g stroke="#c3aef0" strokeWidth="1.2">
      <path d="m250 474-124-62 124-62 124 62-124 62Z" fill="#2b2049" /><path d="m126 412 124 62v19l-124-62Z" fill="#170f2a" /><path d="m374 412-124 62v19l124-62Z" fill="#3d2d68" />
      <path d="m250 421-89-44 89-44 89 44-89 44Z" fill="#3a2b63" /><path d="m161 377 89 44v29l-89-44Z" fill="#241a3f" /><path d="m339 377-89 44v29l89-44Z" fill="#4f3b82" />
      <path d="m250 371-73-37V207l73 37v127Z" fill="#2a1f4a" /><path d="m250 371 73-37V207l-73 37v127Z" fill="#523d89" /><path d="m250 244-73-37 73-37 73 37-73 37Z" fill="url(#stoneFace)" />
      <path d="m250 196-49-25V127l49 24v45Z" fill="#3b2b66" /><path d="m250 196 49-25V127l-49 24v45Z" fill="#6d55ab" /><path d="m201 127 49-96 49 96-49 24-49-24Z" fill="url(#towerGlow)" /><path d="M250 31v120" opacity=".55" stroke="#c3aef0" />
      <path d="m177 285 73 37 73-37M177 299l73 37 73-37M177 221l73 37 73-37" fill="none" />
    </g>
    <path d="m235 355 15-8 15 8v51l-15 8-15-8v-51Z" fill="#ffd166" /><path d="m240 274 10-5 10 5v20l-10 5-10-5Z" fill="#ffe6a8" opacity=".9" />
    <circle cx="250" cy="30" r="5" fill="#fff6d8" /><path d="M250 5v13m-22 12h12m20 0h12" stroke="#fff6d8" strokeWidth="1.5" />
    <g fill="#a99cc7" fontFamily="monospace" fontSize="10" letterSpacing="3"><text x="45" y="520">N 01.00 / E 06.00</text><text x="345" y="520">THE SPIRE</text></g>
  </svg>;
}

export function CharacterArt() {
  return <svg viewBox="0 0 200 220" role="img" aria-label="身着绿色斗篷的代数师"><ellipse cx="100" cy="203" rx="58" ry="10" fill="#0a110d" /><g stroke="#a7cf75" strokeWidth="1.5"><path d="m100 28 35 49-18 27 37 85H46l37-85-18-27 35-49Z" fill="#2b442c" /><path d="m100 28-8 72-28 89h49l-13-89 35-23-35-49Z" fill="#658549" /><path d="m100 45-21 32 21 20 21-20-21-32Z" fill="#15231b" /><path d="M90 76h5m10 0h5" stroke="#e5ffac" strokeWidth="3" /><path d="m100 99 13 90M60 160l36-14" /><path d="M154 75v126" stroke="#8d734b" strokeWidth="5" /><path d="m154 49 13 13-13 13-13-13Z" fill="#c5f277" /><path d="m116 132 38-12v17l-35 13Z" fill="#3e6039" /></g><g fill="#c5f277" fontFamily="monospace" fontSize="19"><text x="29" y="70">x</text><text x="164" y="108">2</text></g></svg>;
}

export function EnemyArt({ id }: { id: string }) {
  if (id === 'slime') return <svg viewBox="0 0 200 170" role="img" aria-label="加法史莱姆"><ellipse cx="100" cy="154" rx="73" ry="9" fill="#080f0b" /><path d="M27 138c0-27 17-37 25-58 8-28 15-47 43-49 27-3 42 20 51 39 9 20 30 26 29 52-1 21-24 28-45 28H61c-20 0-34-4-34-12Z" fill="#88b972" stroke="#bddb9b" strokeWidth="2" /><path d="M53 93c7-30 17-47 37-49" stroke="#bbd9a1" strokeWidth="5" strokeLinecap="round" fill="none" /><rect x="79" y="91" width="7" height="15" rx="3" fill="#243c2a" /><rect x="117" y="91" width="7" height="15" rx="3" fill="#243c2a" /><path d="m95 117 7 4 7-4" stroke="#243c2a" strokeWidth="3" fill="none" /><path d="M153 46v18m-9-9h18" stroke="#c5f277" strokeWidth="3" /><circle cx="41" cy="50" r="4" fill="#68815b" /></svg>;
  if (id === 'slimelet') return <svg viewBox="0 0 200 170" role="img" aria-label="小史莱姆"><ellipse cx="100" cy="146" rx="52" ry="8" fill="#080f0b" /><path d="M52 130c0-19 12-26 18-41 6-20 11-33 30-34 19-2 30 14 36 27 6 14 21 18 20 37-1 15-17 20-32 20H76c-14 0-24-3-24-9Z" fill="#a6d98b" stroke="#d6f0b8" strokeWidth="2" /><path d="M70 96c5-21 12-33 26-34" stroke="#d3efb4" strokeWidth="4" strokeLinecap="round" fill="none" /><rect x="83" y="94" width="6" height="12" rx="3" fill="#243c2a" /><rect x="111" y="94" width="6" height="12" rx="3" fill="#243c2a" /><path d="m95 116 5 3 5-3" stroke="#243c2a" strokeWidth="2.5" fill="none" /><path d="M148 52v12m-6-6h12" stroke="#c6ff5e" strokeWidth="2.5" /><circle cx="49" cy="60" r="3" fill="#7a9c65" /><circle cx="160" cy="108" r="2.4" fill="#7a9c65" /></svg>;
  if (id === 'bug') return <svg viewBox="0 0 200 170" role="img" aria-label="倍增虫"><ellipse cx="100" cy="153" rx="70" ry="9" fill="#080f0b" /><g stroke="#ad9acf" strokeWidth="2"><path d="m51 107-21-6m30 28-20 12m104-34 24-9m-30 32 20 14" fill="none" /><ellipse cx="100" cy="105" rx="51" ry="43" fill="#776291" /><path d="M100 62v84M52 105h96" /><ellipse cx="100" cy="61" rx="33" ry="27" fill="#9f86b5" /><path d="m84 39-8-17m38 17 8-17" /></g><path d="m83 60 9 9m0-9-9 9m27-9 9 9m0-9-9 9" stroke="#251d34" strokeWidth="4" /></svg>;
  if (id === 'guardian') return <svg viewBox="0 0 200 170" role="img" aria-label="奇偶守卫"><ellipse cx="100" cy="155" rx="63" ry="9" fill="#080f0b" /><g stroke="#dcc087" strokeWidth="2"><path d="m100 18 41 20-8 43 23 59H44l23-59-8-43 41-20Z" fill="#93774e" /><path d="m100 18 1 122M67 81h66" /><path d="m56 83-28 14 4 46 40-11Z" fill="#564b33" /><path d="m100 38 24 10-6 24H82l-6-24 24-10Z" fill="#292d24" /><path d="M87 52h26m-26 9h26" stroke="#e9cd8a" /><path d="m145 43 10 10v98" fill="none" /></g></svg>;
  return <svg viewBox="0 0 200 170" role="img" aria-label="埃氏筛"><ellipse cx="100" cy="155" rx="75" ry="10" fill="#080f0b" /><circle cx="100" cy="79" r="65" stroke="#b99acb" fill="none" strokeDasharray="3 6" /><path d="m100 18 57 33-10 65-47 36-47-36-10-65 57-33Z" fill="#4b3e57" stroke="#ba9fce" strokeWidth="2" /><path d="m100 36 35 20-8 48-27 22-27-22-8-48 35-20Z" fill="#1c2120" stroke="#9e7bb4" /><g fill="#cbb3dc" fontFamily="monospace" fontSize="20" textAnchor="middle"><text x="100" y="74">2 3</text><text x="100" y="104">5 7</text></g><path d="m54 138-23-18m115 18 23-18M79 61l40 44M121 61l-40 44" stroke="#cc8f98" strokeWidth="2" /></svg>;
}
