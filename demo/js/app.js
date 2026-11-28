/* ============================================================
   亏了 · 交互层 v2
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const screen = $('#screen');
const viewport = $('#viewport');
const tabbar = $('#tabbar');
const scrim = $('#scrim');
const sheet = $('#sheet');
const sheetTitle = $('#sheetTitle');
const sheetBody = $('#sheetBody');
const toastEl = $('#toast');
const railNav = $('#railNav');
const railRoute = $('#railRoute');

/* ---------------- SVG 图标集 ---------------- */
const ICON_RAW = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.2 12 3l9 7.2V20a1.6 1.6 0 0 1-1.6 1.6H15v-6.4H9v6.4H4.6A1.6 1.6 0 0 1 3 20z"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2 5.2-5.2 2 2-5.2z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.2c.9-3.8 3.9-5.8 7.5-5.8s6.6 2 7.5 5.8"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8.6a6 6 0 1 0-12 0c0 6-2.4 7.4-2.4 7.4h16.8S18 14.6 18 8.6"/><path d="M13.7 19.5a2 2 0 0 1-3.4 0"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L19 7"/></svg>',
  wechat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.2 3C4.9 3 1.4 5.9 1.4 9.5c0 2 1.1 3.9 2.9 5.1l-.7 2.3 2.6-1.4c.9.3 1.9.4 3 .4h.5a5.6 5.6 0 0 1-.2-1.4c0-3.2 3.1-5.8 7-5.8h.5C15.4 5.3 12.6 3 9.2 3zM6.7 8.1a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8zm5 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8z"/><path d="M22.6 13.6c0-2.9-2.9-5.2-6.4-5.2s-6.4 2.3-6.4 5.2 2.9 5.2 6.4 5.2c.8 0 1.6-.1 2.3-.3l2.1 1.1-.6-1.8c1.6-.9 2.6-2.4 2.6-4.2zM18.4 12.8a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zm-4.3 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z"/></svg>',
  fire: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s1.5 3.2-1 6.2c-2 2.4-4.5 3.6-4.5 7A5.5 5.5 0 0 0 12 21a5.5 5.5 0 0 0 5.5-5.8c0-2.4-1.3-3.7-1.3-3.7S16 13 16 15.2c0 1-.4 1.8-.4 1.8s1.6-1 2.2-3.2c.5-1.8.2-4 .2-4S15.5 6.6 12 2z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12"/><circle cx="12" cy="12" r="2.6"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5h3l1.6-2.3h6.8L17 8.5h3a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 20.5H4A1.5 1.5 0 0 1 2.5 19v-9A1.5 1.5 0 0 1 4 8.5"/><circle cx="12" cy="14" r="3.4"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 10.5a4.4 4.4 0 0 1 8 0"/><path d="M12 10.5V8"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.5h4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-3.2 7-9V6l-7-3-7 3v6c0 5.8 7 9 7 9"/><path d="m9 12 2 2 4-4"/></svg>',
  gavel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m14 4 6 6M11 7l6 6M4 20l7-7M3 21l2-2"/><path d="m10 10 4 4"/></svg>',
  scale2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 21h10M4 7h16M6.5 7 4 13h5zM17.5 7 15 13h5z"/><path d="M9 13a3 3 0 0 0 6 0"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c.8-3.6 3.4-5.4 6.5-5.4s5.7 1.8 6.5 5.4"/><path d="M16.5 4.9a3.4 3.4 0 0 1 0 6.4M18 14.9c2.1.6 3.4 2.3 3.9 5.1"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10" width="15" height="10.5" rx="2.4"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-1.6 3.5L16 11H5"/></svg>',
  megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4a2 2 0 0 0 2 2h1l1 5h3l-1-5h2l6 4V5L10 9H6a2 2 0 0 0-2 2z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5a7.7 7.7 0 0 1-8.3 7.7L6 21.5l1.2-4.2a7.7 7.7 0 1 1 13.3-5.8"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/></svg>',
  /* --- 业务图标（全部单色 line） --- */
  eyeOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12"/><circle cx="12" cy="12" r="2.6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c.9-3.8 3.9-5.8 7.5-5.8s6.6 2 7.5 5.8"/><path d="M16.5 4.9a3.4 3.4 0 0 1 0 6.4M18 14.9c2.1.6 3.4 2.3 3.9 5.1"/></svg>',
  userCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.5" cy="8" r="3.4"/><path d="M3 20c.9-3.8 3.6-5.8 6.5-5.8 1 0 2 .2 2.9.5"/><path d="m15.5 17.5 2 2 4-4.5"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1"/><path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 10v6h-4a3 3 0 0 1 0-6z"/></svg>',
  walletBack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5z"/><path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z"/></svg>',
  thumbsUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10.5v9H4.5A1.5 1.5 0 0 1 3 18v-6a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M7 10.5 11.2 4a2 2 0 0 1 2.8 1.4l-.7 3.1H19a2 2 0 0 1 2 2.4l-1.4 6.6A2 2 0 0 1 17.6 19H7z"/></svg>',
  message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5a7.7 7.7 0 0 1-8.3 7.7L6 21.5l1.2-4.2a7.7 7.7 0 1 1 13.3-5.8"/></svg>',
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6.5 4.5 11.5l5 5"/><path d="M4.5 11.5h9.2a5.8 5.8 0 0 1 5.8 5.8v.7"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 2.8 19a1.5 1.5 0 0 0 1.3 2.2h15.8a1.5 1.5 0 0 0 1.3-2.2z"/><path d="M12 9.5v4M12 17h.01"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.4 2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.4"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="3.4" rx="1.2"/><path d="M9 12h6M9 16h4"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5V6.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6.5v2a2.2 2.2 0 0 0 0 7v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-2a2.2 2.2 0 0 0 0-7z"/><path d="M12 6v2M12 11v2M12 16v2"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r=".9" fill="currentColor"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16.5 9 11l3.5 3.5L20 7"/><path d="M15 7h5v5"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5A2.5 2.5 0 0 0 7 10.5M17 6h2.5A2.5 2.5 0 0 1 17 10.5"/><path d="M12 14v3.5M8.5 20h7l-.6-2.5h-5.8z"/></svg>',
  ladder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v18M16 3v18M8 7.5h8M8 12h8M8 16.5h8"/></svg>',
  megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4a2 2 0 0 0 2 2h1l1 5h3l-1-5h2l6 4V5L10 9H6a2 2 0 0 0-2 2z"/><path d="M19 9.5a3 3 0 0 1 0 5"/></svg>',
  walletCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.4"/><path d="M3 10h18M16.5 14.5l1.6 1.6 3-3.4"/></svg>',
  wechat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.5c-3.6 0-6.5 2.4-6.5 5.4 0 1.7.9 3.2 2.4 4.2L4 16.5l2.5-1.2c.8.2 1.6.3 2.5.3h.6"/><path d="M14.5 9.5c0 2.7-2.6 4.9-5.8 4.9-.8 0-1.5-.1-2.2-.3L4 15.5l.8-1.8c-1.2-.9-2-2.2-2-3.6"/><path d="M21.5 15.5c0 2.4-2.3 4.4-5.1 4.4-.7 0-1.3-.1-1.9-.3l-2 1 0.6-1.5c-1.1-.8-1.8-2-1.8-3.3 0-2.4 2.3-4.4 5.2-4.4s5 1.7 5 4.1z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-9.6a4.4 4.4 0 0 1 7.5-3.1 4.4 4.4 0 0 1 7.5 3.1c0 5-7.5 9.6-7.5 9.6z"/></svg>',
  medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14.5" r="5.5"/><path d="m8.5 9.5-3-6.5h4l3 5M15.5 9.5l3-6.5h-4l-3 5"/><path d="m12 12.4.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M8 12l4 4 4-4"/><path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8L9.7 17.3a1.8 1.8 0 0 1-2.5-2.5l7.8-7.8"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2.4"/><circle cx="8.5" cy="10" r="1.6"/><path d="m3.5 17 5-5 4 4 3-2.5 5 4"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4.5" rx="1.4"/><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5"/><path d="M10 12.5h4"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9z"/><path d="M18.5 3.5v3M20 5h-3"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M6.3 6.3l11.4 11.4"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/><path d="M12 8.5V21M12 8.5S10.5 3.5 8 3.5a2.5 2.5 0 0 0 0 5M12 8.5s1.5-5 4-5a2.5 2.5 0 0 1 0 5"/></svg>',
  handshake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m11 8.5 2-1.6a2.5 2.5 0 0 1 3 .2l4.5 3.4M8 8.5 5.5 10a2.4 2.4 0 0 0 0 3.5l4 3.2a2.4 2.4 0 0 0 3 .1l1.5-1.2 2 1.6a1.8 1.8 0 0 0 2.3 0l1.5-1.2"/><path d="m3 8.5 3-2.5h3L11 8.5"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.4"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.4"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.4"/><path d="M14 14h3v3h-3zM19.5 14v3M14 20.5h3M20.5 17v3.5h-3.5"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5h12v16l-6-4-6 4z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5A8 8 0 0 0 6.2 6.2L3.5 8.5"/><path d="M4 12.5a8 8 0 0 0 13.8 5.3l2.7-2.3"/><path d="M3.5 4.5v4h4M20.5 19.5v-4h-4"/></svg>',
  verified: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2.5 2.4 1.8 3-.1.9 2.9 2.5 1.6-1 2.8 1 2.8-2.5 1.6-.9 2.9-3-.1L12 21.5l-2.4-1.8-3 .1-.9-2.9-2.5-1.6 1-2.8-1-2.8L5.7 7l.9-2.9 3 .1z"/><path d="m9 12 2.2 2.2L15.5 10"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7.5" width="19" height="9" rx="1.8" transform="rotate(-8 12 12)"/><path d="M7 8.6v2.2M11 7.9v2.2M15 7.2v2.2M19 6.5v2.2"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20.5h4L20 8.5a2.1 2.1 0 0 0-3-3L5 17.5z"/><path d="m15.5 7 2.5 2.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M10.5 18.5h3"/></svg>',
  num1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 8.5 13 6v12"/><path d="M8.5 18h9"/></svg>',
  num2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 9.5a2.8 2.8 0 1 1 4.6 2.1L9.5 17H15"/></svg>',
  num3: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 9.2a2.6 2.6 0 1 1 4 2.2 2.7 2.7 0 1 1-4 2.6"/><path d="M9 18h5.5"/></svg>',
  helpCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.4"/><path d="M12 17h.01"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m15.8 15.8 4.4 4.4"/></svg>',
};

/** 图标访问器：自动注入默认尺寸，避免 SVG 撑成 300x150 */
const ICON = new Proxy(ICON_RAW, {
  get(t, k) {
    const v = t[k];
    if (typeof v !== 'string') return v;
    if (v.indexOf('width=') >= 0) return v;
    return v.replace('<svg ', '<svg width="16" height="16" ');
  }
});


/** 快捷：取一个图标（可带 class / 尺寸） */
function ic(name, cls = '', size = 0) {
  let svg = ICON[name] || '';
  if (!svg) return '';
  if (size) svg = svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  return cls ? svg.replace('<svg ', `<svg class="${cls}" `) : svg;
}


/* ---------------- 路由表 ---------------- */
const ROUTES = {
  splash:{t:'启动页',r:'splash',tab:null},
  login:{t:'登录',r:'login',tab:null},
  home:{t:'首页',r:'home',tab:'home'},
  square:{t:'广场',r:'square',tab:'square'},
  myFlags:{t:'我的 Flag',r:'myFlags',tab:'me'},
  create:{t:'立一个 Flag',r:'create',tab:null},
  createGoal:{t:'① 立什么',r:'createGoal',tab:null},
  createPeriod:{t:'② 立多久',r:'createPeriod',tab:null},
  createDeposit:{t:'③ 确认并支付',r:'createDeposit',tab:null},
  created:{t:'发起成功',r:'created',tab:null},
  checkin:{t:'今日打卡',r:'checkin',tab:null},
  checkinDone:{t:'打卡成功',r:'checkinDone',tab:null},
  checkinLog:{t:'打卡历史',r:'checkinLog',tab:null},
  checkinLogItem:{t:'打卡详情',r:'checkinLogItem',tab:null},
  flagDetail:{t:'目标详情',r:'flagDetail',tab:null},
  userProfile:{t:'用户主页',r:'userProfile',tab:null},
  /* ⚠️ 筛选不再是独立页面 —— 它是半屏底部抽屉（见需求规格 R2.15）
     所以没有路由条目，改由 data-act="openFilter" 打开。 */
  verdict:{t:'见证席面板',r:'verdict',tab:null},
  verdictDetail:{t:'判定详情',r:'verdictDetail',tab:null},
  witnessEarnings:{t:'见证席收益',r:'witnessEarnings',tab:null},
  /* ⚠️ 2026-11-23 用户口径：「申请成为见证席」独立页面已删 ——
     申请入口在见证席面板（data-act="applyWitness"），点了弹居中小框当场评估。
     ⚠️ 2026-11-24 用户口径：「取消退出见证这个功能」——
     见证席一旦成立就不能退出，所以没有「退出见证」页面，也没有对应路由。 */
  witnessPool:{t:'见证席候选池',r:'witnessPool',tab:null},
  /* ⚠️ 2026-11-24（本轮新增）：招募详情页 ——
     广场「招募中」横条点进来。这个页面回答的是
     「这一局现在招募得怎么样、我值不值得参加」——
     目标详情页答不了这个问题（那里没有坑位 / 报名数 / 截止时间）。 */
  recruitDetail:{t:'招募详情',r:'recruitDetail',tab:null},
  profile:{t:'我的',r:'profile',tab:'me'},
  /* ⚠️ 2026-11-24（本轮，用户口径 Part 二①）：编辑资料改成【全屏页】——
     原来是居中小框（一个 dialog 弹窗），
     现在是一个完整的页面 —— 改资料是填表，五个字段在小框里要滚两层。 */
  editProfile:{t:'编辑资料',r:'editProfile',tab:null},
  recordCard:{t:'记录卡',r:'recordCard',tab:null},
  supervisorCard:{t:'监督席记录卡',r:'supervisorCard',tab:null},
  objection:{t:'提出异议',r:'objection',tab:null},
  following:{t:'我关注的人',r:'following',tab:null},
  /* ⚠️ 2026-11-24（本轮）：通知改成底部 Tab（原来藏在首页右上角铃铛里，是二级入口）。
     「监督」Tab 已撤 —— 它的内容拆开各归其位：
       · 「我监督的局」 → 「我的」页功能区（进入这个二级页）
       · 「我提的异议」 → 通知页
     这个路由保留，作为「我的」页那个入口的目标页。 */
  notifs:{t:'通知',r:'notifs',tab:'notifs'},
  subs:{t:'我监督的局',r:'subs',tab:null},
  share:{t:'分享',r:'share',tab:null},
  /* ⚠️ 2026-11-22 用户口径（改）：见证席召集令不再有独立页面 ——
     点「发布见证席召集令」就地发布，按钮变「见证席召集令已发布」，
     再点它从底部升起半屏看报名情况（见 R5.6）。 */
  /* ⚠️ 2026-11-24 用户口径（改，本轮）：旧的「选择押金 / 支付押金 / 押金已支付」
     三页链路已删 —— 立 Flag 的第 3、4 步（押多少 / 交押金）已经内联了这两件事，
     这三页是上一版的遗留，全站没有任何入口走得到。
     —— 留着它们的风险：从左栏导览点进去会看到一套已经废弃的押金流程，
        看原型的人会以为产品有两套押金支付方式。 */
  agreement:{t:'用户协议',r:'agreement',tab:null},
  privacy:{t:'隐私政策',r:'privacy',tab:null},
  safeStop:{t:'安全减重须知',r:'safeStop',tab:null},
  depositAgreement:{t:'押金协议',r:'depositAgreement',tab:null},
  appeal:{t:'客服 / 申诉',r:'appeal',tab:null},
  flagMenu:{t:'我的 Flag',r:'flagMenu',tab:null},
  credDetail:{t:'立据凭证',r:'credDetail',tab:null},
  /* ⚠️ 2026-11-24（本轮）：「监督这一局」独立页已删 ——
     详情页底部的监督按钮改成眼睛图标，直接调 toggleSupervise（见 R2.21）。 */
};

/* ---------------- Tab ---------------- */
/* 4 个 tab 等宽对称，不设中间大按钮。
   「立一个 Flag」是低频动作 —— 放在首页的显眼按钮里，不占底栏的黄金位。
   高频入口（今日打卡 / 我的 Flag）由首页主卡承载。

   ⚠️ 2026-11-24（本轮）：第三个 tab 从「监督」换成「通知」——
   —— 原因：通知密度本来就高（待判定 / 留言 / 见证席邀请 / 断卡 / 结算 / 异议进展），
      但它以前只藏在【首页右上角一个铃铛】里，而且是二级入口，
      用户在别的页面想看通知得先回首页 —— 这是全站最容易被忽略的位置。
   —— 「监督」Tab 的内容拆开各归其位（见 R2.21）：
      · 「我监督的局」  → 挪进「我的」页功能区（它是我的东西）
      · 「我提的异议」  → 挪进「通知」页（异议本来就是靠通知推送的）
      · 4 行假开关      → 整个删掉（那是产品承诺说明，不是能设置的东西） */
const TABS = [
  {key:'home',   icon:'home',    label:'首页'},
  {key:'square', icon:'compass', label:'广场'},
  {key:'notifs', icon:'bell',    label:'通知', badge:'notif'},
  {key:'me',     icon:'user',    label:'我的'},
];

/* ---------------- 状态 ---------------- */
let route = 'splash';
let routeId = null;
let routeDay = null;
let stack = [];
let tabStack = {home:[],square:[],notifs:[],me:[]};
let currentTab = 'home';

/* ---------------- 渲染 ---------------- */
function render(next, id, opt = {}) {
  const r = ROUTES[next];
  if (!r) return toast('页面不存在: ' + next);
  const prev = route;

  /* ⚠️ 2026-11-24 用户口径：「点击返回以后存在 bug，
     成为见证席的条件的框还在显示。」
     —— 原因：居中小框（.dialog）是挂在 **#screen** 上的，不在 #viewport 里 ——
        所以 render() 换页时它不会被一起换掉，留在屏幕上不走。
     —— 修法：每次换页先把还开着的弹窗收掉（顺带把遮罩也撤了）。
        否则用户点「返回」看到的是旧页面上盖着的新页面的框。 */
  if (lastDialog) closeDialog();

  if (opt.push !== false && prev !== next) {
    if (r.tab) {
      if (currentTab !== r.tab) { tabStack[currentTab] = []; currentTab = r.tab; }
      tabStack[r.tab].push({r: prev, id: routeId, day: routeDay});
    } else {
      stack.push({r: prev, id: routeId, day: routeDay});
    }
  }

  route = next;
  routeId = id || null;
  routeDay = (opt.day !== undefined && opt.day !== null && opt.day !== '') ? Number(opt.day) : null;

  /* ⚠️ 2026-11-25（本轮修复）：**状态推进放在渲染之前** ——
     筹备期 24 小时一到，这一局要立刻变成「进行中」（R1.3）：
     名单冻结 / 档位定死 / 在途邀约作废 / 状态切 running。
     —— 之前这条流转根本不存在，导致筹备期永远过不去（见 advancePrepToRunning）。
     —— 放在渲染前：这一帧画出来的就是推进后的状态，不会出现
        「首页还在喊筹备期、详情页已经是进行中」的错位。 */
  try { syncFlagLifecycle(); } catch (e) { /* 状态推进失败不阻塞渲染 */ }

  viewport.innerHTML = (PAGES[r.r] || (() => '<div class="page">页面缺失</div>'))(id, routeDay);
  viewport.scrollTop = 0;
  bindScroll();

  /* 登录页的分段控件指示块需要按真实宽度定位 */
  requestAnimationFrame(() => {
    document.querySelectorAll('.login-tabs').forEach(initSegThumb);
  });

  // Tabbar
  const showTab = !!r.tab;
  tabbar.style.display = showTab ? 'flex' : 'none';
  if (showTab) {
    tabbar.innerHTML = TABS.map(t => {
      /* ⚠️ 2026-11-24（本轮）：通知 tab 带未读角标 */
      let badge = '';
      if (t.badge === 'notif') {
        const n = unreadNotifCount();
        if (n) badge = `<span class="tab-badge">${n > 99 ? '99+' : n}</span>`;
      }
      return `<button class="tab ${t.key===r.tab?'on':''}" data-tab="${t.key}">${ICON[t.icon]}${badge}<span>${t.label}</span></button>`;
    }).join('');
  }

  // 状态栏反色
  const dark = ['splash'].includes(next);
  $('.statusbar').classList.toggle('right', dark);

  updateRail(next);
  localBind(next);
  bindPrepTimer();
  bindMakeupTimer();
  bindRecruitTimer();
  bindMsgTicker();
}

/* ---------------- 筹备期倒计时（真实时钟，逐秒递减；见 D10.3.3） ----------------
   页面上的倒计时数字必须是真的在走 —— 不是写死的「23 小时 41 分」。
   数据来源：flag.prepEndAt（发起那一刻 + 24h），没有时退回按天估算。 */
let prepTimerId = null;
function fmtRemain(ms) {
  if (ms <= 0) return '00:00:00';
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = n => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}
function bindPrepTimer() {
  if (prepTimerId) { clearInterval(prepTimerId); prepTimerId = null; }
  const box = document.querySelector('[data-prep-timer]');
  if (!box) return;
  const clock = box.querySelector('[data-prep-clock]');
  if (!clock) return;
  const endAt = Number(box.dataset.prepEnd || 0);
  /* 没有真实截止时刻时退回按天估算（种子数据无 prepEndAt） */
  let fallback = 0;
  try { fallback = prepRemainMs(findFlag(routeId)); } catch (e) { fallback = 0; }
  const target = endAt || (Date.now() + fallback);
  const tick = () => {
    const ms = Math.max(0, target - Date.now());
    clock.textContent = fmtRemain(ms);
    if (ms <= 0) {
      clock.textContent = '筹备期已结束';
      clock.classList.add('done');
      if (prepTimerId) { clearInterval(prepTimerId); prepTimerId = null; }
    }
  };
  tick();
  prepTimerId = setInterval(tick, 1000);
}

/* ---------------- 补卡倒计时（⚠️ 2026-11-24 用户口径新增） ----------------
   「最上面的断卡提醒，应该是几月几日未打卡，给用户一个按钮，点击补卡，
     并且做 12 小时倒计时。」
   —— 倒计时必须是【真在走】的 —— 和筹备期倒计时同一套做法（setInterval + 真实时钟）。
   —— 数据来源：[data-makeup-clock="<endAt>"] 上的 endAt（毫秒时间戳）。 */
let makeupTimerId = null;
function bindMakeupTimer() {
  if (makeupTimerId) { clearInterval(makeupTimerId); makeupTimerId = null; }
  const boxes = document.querySelectorAll('[data-makeup-clock]');
  if (!boxes.length) return;
  const targets = Array.from(boxes).map(b => ({ el: b, endAt: Number(b.dataset.makeupClock || 0) }));
  const tick = () => {
    let alive = 0;
    for (const t of targets) {
      const ms = Math.max(0, t.endAt - Date.now());
      t.el.textContent = makeupRemainText(ms);
      if (ms > 0) alive++;
    }
    /* 全部倒完就停掉定时器 —— 不留一个空转的 interval */
    if (!alive) { clearInterval(makeupTimerId); makeupTimerId = null; }
  };
  tick();
  if (makeupTimerId) clearInterval(makeupTimerId);
  makeupTimerId = setInterval(tick, 1000);
}

/* ---------------- 招募倒计时（⚠️ 2026-11-24 用户口径新增） ----------------
   广场「招募中」横条 + 招募详情页上的倒计时。
   —— 原来那四个局的「还剩 6 小时」是一句静态文字，做不了倒计时。
      现在每个局有真实的截止时刻（recruitEndAt），倒计时逐秒递减。
   —— 跟筹备期倒计时、补卡倒计时同一套做法（setInterval + 真实时钟）。 */
let recruitTimerId = null;
function bindRecruitTimer() {
  if (recruitTimerId) { clearInterval(recruitTimerId); recruitTimerId = null; }
  const boxes = document.querySelectorAll('[data-recruit-clock]');
  if (!boxes.length) return;
  const targets = Array.from(boxes).map(b => {
    const f = findFlag(b.dataset.recruitClock);
    return { el: b, endAt: (f && f.recruitEndAt) || 0 };
  });
  const tick = () => {
    let alive = 0;
    for (const t of targets) {
      if (!t.endAt) continue;
      const ms = Math.max(0, t.endAt - Date.now());
      t.el.textContent = fmtRecruitRemain(ms);
      if (ms > 0) alive++;
    }
    /* 全部倒完就停掉定时器 —— 不留一个空转的 interval */
    if (!alive) { clearInterval(recruitTimerId); recruitTimerId = null; }
  };
  tick();
  recruitTimerId = setInterval(tick, 1000);
}

/* ---------------- 留言轮播（⚠️ 2026-11-24 用户口径新增） ----------------
   「目标详情里的留言的展示，可以做成流动的文字，
     这样用户就知道点击可以看到里面的内容，同时还能写留言。」
   —— 轮播（不是无限滚动）：每 4 秒切一条，像滚动的字幕。
   —— 零条留言 → 不渲染轮播（空态退回成「说点什么…」按钮）
   —— 只有一条 → 静态显示，不轮播（轮播一条毫无意义）
   —— 正文太短（少于十二个字）→ 间隔拉到 6 秒（每四秒切一条短的会很跳） */
let tickerTimerId = null;
function bindMsgTicker() {
  if (tickerTimerId) { clearInterval(tickerTimerId); tickerTimerId = null; }
  const box = document.querySelector('[data-ticker]');
  if (!box) return;
  const items = Array.from(box.querySelectorAll('.mt-item'));
  const count = box.querySelector('.mt-count');
  if (items.length <= 1) {
    if (items.length === 1) items[0].classList.add('on');
    if (count) count.innerHTML = `1/1 ${ICON.chevR}`;
    return;
  }
  /* 正文最短的那条决定间隔 —— 短句子滚太快会看不清 */
  const lengths = items.map(el => {
    const t = el.querySelector('.mt-text');
    return t ? t.textContent.trim().length : 99;
  });
  const shortest = Math.min.apply(null, lengths);
  const gap = shortest < 12 ? 6000 : 4000;
  let i = 0;
  const show = (n) => {
    i = n;
    items.forEach((el, k) => el.classList.toggle('on', k === n));
    if (count) count.innerHTML = `${n + 1}/${items.length} ${ICON.chevR}`;
  };
  show(0);
  tickerTimerId = setInterval(() => show((i + 1) % items.length), gap);
}

function updateRail(cur) {
  railNav.innerHTML = Object.entries(ROUTES)
    .filter(([k]) => !['splash','login'].includes(k))
    .map(([k, v]) => `<a href="#" data-go="${k}" class="${k===cur?'on':''}"><i class="dot"></i>${v.t}</a>`).join('');
  railRoute.textContent = 'route: ' + cur;
}

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2100);
}

/* ---------------- 统一发起 Flag（单页 + 分步引导都走这里） ---------------- */
/** 唯一写入口：组装 → 落库 → 跳发起成功页
 *  d: { title, start, target, period, deposit, witnesses }
 *  witnesses 允许为空数组（分步引导第 4 步创建时可以是 0 位见证人）
 *  ⚠️ 同一时间只能有一个进行中的 Flag（见需求规格 R1.6）——
     这里是最后一道闸：入口拦过了，提交这里再兜一次。 */
function submitFlag(d){
  const gate = canCreateFlag();
  if (!gate.ok) {
    toast('你已经有一个进行中的 Flag 了');
    render('myFlags', null, { push: false });
    return null;
  }
  const flag = addMyFlag({
    title: d.title || '我还没写目标',
    startWeight: d.start || 0,
    targetWeight: d.target || 0,
    days: d.period || 30,
    tier: 'T2',
    deposit: d.deposit || 0,
    witnesses: d.witnesses || [],
  });
  toast(isZeroDepositFlag(flag) ? '已立 Flag（首次免费 · 押金 0 元）' : '已立 Flag');
  render('created', flag.id);
  return flag;
}

/* ---------------- 立 Flag 分步引导：草稿 ---------------- */
/** 进入分步引导第 1 步时重置草稿 + 周期/押金选择
 *  周期默认取当前信用分能立的最长周期（否则默认 30 天但新用户只能立 7/14 天，
 *  会出现「选中的周期是锁死的」这种矛盾状态） */
function resetCreateDraft(){
  STATE.createDraft = {
    title: '', start: '', target: '',
    agreedPay: false,
  };
  const allowed = allowedPeriods(STATE.credit);
  const days = allowed.length ? Math.max(...allowed) : 7;
  STATE.periodSel = days;
  const dr = depositRange(STATE.credit, days, isFirstFlag());
  const opts = dr.options || [];
  STATE.depSel = opts.length ? opts[opts.length-1] : 0;
}

/* ---------------- 状态动作（真正改变数据） ---------------- */
/* ---------------- 游客态：登录是「动作的门槛」，不是「内容的门槛」 ----------------
   实质性动作（立 Flag / 打卡 / 监督 / 见证 / 押金）必须登录；
   围观层（浏览 / 点赞 / 预设短语 / 提异议 / 分享）不要求登录。            */
const NEED_LOGIN_ACTS = [
  'doCheckin', 'doSubscribe', 'applyPool', 'submitVerdict',
  'doCancelFlag',
  /* ⚠️ 2026-11-22：发布召集令 / 接受报名者都是【对外动作】——
     召集令是要广播出去的，接受则是把责任揽到自己身上，必须先有账号。 */
  'publishRecruit', 'confirmRecruit', 'acceptApplicant', 'declineApplicant',
  /* ⚠️ 2026-11-23：申请成为见证席 = 把责任揽到自己身上，必须先有账号；
     候选池「邀请」也是对外动作（对方会收到邀约）。 */
  'applyWitness', 'inviteFromPool',
  /* ⚠️ 2026-11-24（本轮修复）：这几个动作之前漏在名单外 ——
     它们全是【有责任的动作】，性质跟「接受报名者」完全一样，
     不该出现「游客能当见证席」这种事：

       applyJoinWitness —— 「我想参加」：申请当这一局的见证席。
           发起人会收到你的申请 —— **这是对外动作**。
           之前不拦 → 游客能申请，申请人身份是空的，
           发起人那边收到一条来自匿名/空身份的申请。
       replyInvite / declineInvite —— 回应见证席邀约：
           接受 = 立刻成为这一局的见证席并要担判定责任；
           拒绝则是对一次对外邀约的正式回应（发起人那边要能看到结果）。
       openVerdictPicker —— 提交见证席判定：
           实名担责的判定，不能匿名投。

     ⚠️（边界）**提异议不在这个名单里** —— 监督席的异议本来就是
       【匿名围观层动作】，按需求规格 R0.2 / R4.1 不要求登录：
       「监督席 = 扫码进来看热闹的人，匿名；能提异议」。
       异议要计票、满 3 票转人工复核，还要扣信用分 ——
       但那是【平台侧的账】，匿名照样能记 —— 所以不能拿登录当门槛。
     */
  'applyJoinWitness', 'replyInvite', 'declineInvite',
  'openVerdictPicker',
];
const NEED_LOGIN_PAGES = [
  'create', 'createGoal', 'createPeriod', 'createDeposit',
  'checkin', 'verdict', 'objection', 'subs',
];
/* 登录成功后要回到哪里（被拦截时的目标路由） */
let pendingLoginRoute = null;
/* ⚠️ 2026-11-24（本轮）：从某个半屏跳去别的页面时，返回键要回到那个半屏。
   —— 三个场景：
      ① 从【召集令报名情况】跳去看用户主页 → 回报名情况（pendingSheetBack = 'recruit'）
      ② 从【见证席名单】跳去看用户主页 → 回见证席名单（pendingSheetBack = 'witness'）
      ③ 从【候选池】跳去看用户主页 → 回候选池（pendingSheetBack = 'pool'）
   —— ⚠️ 跳页之前【必须先把半屏关掉】——
      否则用户进到主页上，底下还压着那个半屏（层级错乱，且半屏还挡着主页）。 */
let pendingSheetBack = null;
/* 见证席名单半屏对应的 Flag（返回时要用） */
let pendingSheetFlagId = null;

function needLoginAct(act) { return NEED_LOGIN_ACTS.includes(act); }
function needLoginPage(r) { return NEED_LOGIN_PAGES.includes(r); }
function isLoggedIn() { return !!STATE.loggedIn; }

/* 协议勾选状态 —— 合规要求：未勾选不得登录
   单一真相源存在 STATE 里：登录页和半屏浮层各有一份勾选框 DOM，必须共用同一个状态 */
function privacyChecked() {
  return !!STATE.privacyAgreed;
}
/* 勾选状态变化时，联动所有勾选框与登录按钮的可用性
   微信登录与手机号登录**都要**被协议勾选 gate 住 —— 登录即建立账号关系 */
function syncPrivacyButtons() {
  const ok = privacyChecked();
  document.querySelectorAll('[data-check="privacy"]').forEach(c => {
    c.classList.toggle('on', ok);
  });
  document.querySelectorAll('[data-act="doLoginWx"],[data-act="doLoginPhone"]').forEach(b => {
    b.classList.toggle('disabled', !ok);
  });
}

/* 切换登录方式：就地换面板，不整页重渲染（保住已输入的内容）
   scope：登录页用 'login'，半屏浮层用 'sheet' —— 两者同时存在时不能串 */
function switchLoginTab(tab, scope) {
  const t = tab === 'phone' ? 'phone' : 'wx';
  STATE.loginTab = t;
  const root = scope === 'sheet' ? $('#sheetBody') : document;
  root.querySelectorAll('[data-login-tab]').forEach(b => {
    b.classList.toggle('on', b.dataset.loginTab === t);
  });
  root.querySelectorAll('[data-pane]').forEach(p => {
    p.classList.toggle('on', p.dataset.pane === t);
  });
  syncPrivacyButtons();
  /* 指示块跟到新的位置 */
  const c = scope === 'sheet' ? $('#sheetBody .login-tabs') : $('.login-tabs');
  if (c) layoutSegThumb(c, segActiveIndex(c));
}

/* ---------------- 可拖拽分段控件（登录方式切换） ---------------- */

/* 取控件里的按钮列表 */
function segButtons(container) {
  return Array.from(container.querySelectorAll('[data-login-tab]'));
}

/* 当前选中项的下标 */
function segActiveIndex(container) {
  const btns = segButtons(container);
  const i = btns.findIndex(b => b.classList.contains('on'));
  return i < 0 ? 0 : i;
}

/* 把滑动指示块放到第 idx 项下面（animate=false 时用于跟手拖拽） */
function layoutSegThumb(container, idx, animate = true) {
  const btns = segButtons(container);
  const thumb = container.querySelector('.seg-thumb');
  if (!thumb || !btns.length) return;
  const b = btns[Math.max(0, Math.min(idx, btns.length - 1))];
  if (!b) return;
  thumb.classList.toggle('no-anim', !animate);
  thumb.style.width = b.offsetWidth + 'px';
  thumb.style.transform = 'translateX(' + (b.offsetLeft - 4) + 'px)';
  if (!animate) {
    /* 强制回流，保证下一次动画从当前位置开始 */
    void thumb.offsetWidth;
    thumb.classList.remove('no-anim');
  }
}

/* 初始化一个分段控件的指示块 */
function initSegThumb(container) {
  if (!container || container._segInit) return;
  container._segInit = true;
  layoutSegThumb(container, segActiveIndex(container), false);
}

/* 拖拽会话 */
let segDrag = null;

/* 拖拽进行中时，抑制随后触发的 click */
let segSuppressClick = false;

function onSegPointerDown(e) {
  const container = e.target.closest('.login-tabs');
  if (!container) return;
  const btns = segButtons(container);
  if (btns.length < 2) return;

  const thumb = container.querySelector('.seg-thumb');
  if (!thumb) return;

  const idx = segActiveIndex(container);
  const b = btns[idx];
  segDrag = {
    container,
    btns,
    thumb,
    startX: e.clientX,
    startY: e.clientY,
    baseLeft: b.offsetLeft,
    width: b.offsetWidth,
    step: b.offsetWidth + (btns[1].offsetLeft - btns[0].offsetLeft),
    idx,
    moved: false,
    axis: null,
    pointerId: e.pointerId,
  };
  /* 记录初始宽度，供跟手计算 */
  segDrag.maxIdx = btns.length - 1;
}

function onSegPointerMove(e) {
  if (!segDrag) return;
  const d = segDrag;

  /* 先判定手势方向：横向优先，纵向则不抢滚动 */
  if (!d.axis) {
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (d.axis === 'y') { segDrag = null; return; }
      d.container.classList.add('dragging');
      d.moved = true;
      segSuppressClick = true;
      try { d.container.setPointerCapture(d.pointerId); } catch (_) {}
    } else {
      return;
    }
  }
  if (d.axis !== 'x') return;

  e.preventDefault();

  const totalDx = e.clientX - d.startX;

  /* 指示块的绝对位置（相对控件左侧），并做边界限制 */
  let pos = d.baseLeft - 4 + totalDx;
  const min = d.btns[0].offsetLeft - 4;
  const max = d.btns[d.maxIdx].offsetLeft - 4;
  /* 越界时阻尼 */
  if (pos < min) pos = min + (pos - min) * 0.32;
  if (pos > max) pos = max + (pos - max) * 0.32;

  d.thumb.style.width = d.width + 'px';
  d.thumb.style.transform = 'translateX(' + pos + 'px)';

  /* 实时预览：拖过一半就先把面板切过去，视觉上"跟手" */
  const over = (pos - min) / d.step;
  const preview = Math.max(0, Math.min(Math.round(over), d.maxIdx));
  if (preview !== d.idx) {
    d.idx = preview;
    const t = preview === 0 ? 'wx' : 'phone';
    const scope = d.container.closest('#sheetBody') ? 'sheet' : 'login';
    d.btns.forEach(btn => btn.classList.toggle('on', btn.dataset.loginTab === t));
    const root = scope === 'sheet' ? $('#sheetBody') : document;
    root.querySelectorAll('[data-pane]').forEach(p => {
      p.classList.toggle('on', p.dataset.pane === t);
    });
    syncPrivacyButtons();
  }
}

function onSegPointerUp(e) {
  if (!segDrag) return;
  const d = segDrag;
  segDrag = null;
  d.container.classList.remove('dragging');
  try { d.container.releasePointerCapture(d.pointerId); } catch (_) {}

  const target = d.btns[d.idx];
  const t = target && target.dataset.loginTab === 'phone' ? 'phone' : 'wx';
  const scope = d.container.closest('#sheetBody') ? 'sheet' : 'login';

  switchLoginTab(t, scope);
  layoutSegThumb(d.container, segActiveIndex(d.container));

  if (d.moved) {
    segSuppressClick = true;
    setTimeout(() => { segSuppressClick = false; }, 60);
  }
}

/* 全局绑定：一次搞定所有分段控件（登录页 + 半屏浮层） */
document.addEventListener('pointerdown', onSegPointerDown);
document.addEventListener('pointermove', onSegPointerMove, { passive: false });
document.addEventListener('pointerup', onSegPointerUp);
document.addEventListener('pointercancel', onSegPointerUp);

/**
 * 点通知上的【动作按钮】时，把这条通知标记已读
 * ⚠️ 2026-11-24（本轮修复）：通知行本身带 data-notif-key，整行点击会标已读 ——
   但那个处理在点击分发器的【更后面】，而 data-act 分支早就 return 了。
   结果：点「去判定」进面板，那条通知**仍然是未读** ——
   红点还在、底栏角标不降。用户明明处理了，角标却不动。
 * —— 所以动作按钮这条路要自己标一次。
 * @param {Element} el  被点的按钮元素（往上找带 data-notif-key 的祖先）
 */
function markClickedNotifRead(el) {
  if (!el) return;
  const row = el.closest ? el.closest('[data-notif-key]') : null;
  if (!row) return;
  markNotifRead(row.dataset.notifKey);
}

function handleAct(act, el) {
  /* 未登录且是实质性动作 —— 弹半屏登录浮层，不打断浏览 */
  if (!isLoggedIn() && needLoginAct(act)) {
    pendingLoginRoute = { r: route, id: routeId };
    openLoginSheet();
    return;
  }

  switch (act) {
    /* 点赞（广场卡片）—— ⚠️ 2026-11-24 用户口径：
       「点赞删除掉短语选择，就改成一个普通的点击按钮，点了变色，
        带一点小小的特效就行。」
       —— 所以没有弹窗了：点一下直接 +1，按钮变色 + 一个「涨一下」的小特效。 */
    case 'doFeedLike': {
      const fid = el.dataset.id || routeId;
      const r = doLike(fid, '');
      if (!r.ok) { toast(r.reason); return; }
      /* 就地更新：不重开页面 */
      const btn = el.closest('.feed-like');
      if (btn) {
        btn.classList.add('on', 'pop');
        const num = btn.querySelector('span');
        if (num) num.textContent = String(likeCountOf(fid));
        setTimeout(() => btn.classList.remove('pop'), 420);
      }
      return;
    }

    /* 留言半屏（广场卡片）—— ⚠️ 2026-11-23 用户口径：
       「当用户点击『留言』，从下往上出现半个留言框。」 */
    case 'openMsgSheet': {
      const fid = el.dataset.id || routeId;
      openMsgSheet(fid);
      return;
    }

    /* ---------- 通知 Tab（2026-11-24 本轮） ---------- */
    /* 切换栏目：全部 / 判定·邀请 */
    case 'setNotifTab': {
      setNotifTab(el.dataset.tab);
      render(route, routeId, {push:false});
      return;
    }
    /* 全部已读 */
    case 'readAllNotifs': {
      markAllNotifsRead();
      toast('已全部标为已读');
      render(route, routeId, {push:false});
      return;
    }
    /* ⚠️ 2026-11-24（本轮，用户口径 Part 六①）：左滑删除一条通知 ——
       —— 删的是【这条消息】，不是底下那件事 ——
          「待判定」「见证席邀请」这些业务状态不受影响，
          只是用户不想再看见这条提醒了（见 state.js 的 dismissNotif）。 */
    case 'dismissNotif': {
      const key = el.dataset.key;
      if (!key) return;
      dismissNotif(key);
      toast('已删除这条通知');
      render(route, routeId, {push:false});
      return;
    }
    /* 通知上的动作按钮 —— 见证席邀请的接受 / 拒绝 */
    case 'replyInvite': {
      const fid = el.dataset.id || routeId;
      markClickedNotifRead(el);
      const r = replyWitnessInvite(fid, true);
      if (r === 'closed') { toast('这个邀请已经不在了'); render(route, routeId, {push:false}); return; }
      if (r === 'dup') { toast('这个邀请已经回应过了'); render(route, routeId, {push:false}); return; }
      toast('已加入见证席 —— 这一局由你见证');
      render(route, routeId, {push:false});
      return;
    }
    /* ⚠️ 2026-11-24（本轮修复）：通知上的「去判定 / 查看」按钮原来没有对应动作 ——
       点下去什么都不会发生（死按钮）。这里补上：
         goVerdict   → 进判定页（带着这个 Flag 的 id）
         goObjection → 进异议详情页
         goGeneric   → 通用跳转（按通知上的 go / goId）

       ⚠️ 2026-11-24（本轮，第 2 处修复）：这几个动作都要顺手把【这条通知】标记已读。
       —— 为什么：通知行本身也带 data-notif-key，但整行的标记逻辑在
          **点击处理器的更后面**（data-act 分支 return 得早，够不着它）。
          结果：点「去判定」进面板，那条通知**仍然是未读** ——
          红点还在、底栏角标不降。用户明明处理了，角标却不动。
       —— 现在在这几个动作里主动标记：先标已读，再跳转。 */
    case 'goVerdict': {
      const fid = el.dataset.id || routeId;
      markClickedNotifRead(el);
      if (!fid) { toast('这个判定已经不在了'); render(route, routeId, {push:false}); return; }
      render('verdict', fid);
      return;
    }
    case 'goObjection': {
      const fid = el.dataset.id || routeId;
      markClickedNotifRead(el);
      if (!fid) { toast('这条异议已经不在了'); render(route, routeId, {push:false}); return; }
      render('objection', fid);
      return;
    }
    case 'goGeneric': {
      const fid = el.dataset.id || routeId;
      const target = el.dataset.go || '';
      markClickedNotifRead(el);
      if (target) render(target, fid || null);
      else render(route, routeId, {push:false});
      return;
    }
    case 'declineInvite': {
      const fid = el.dataset.id || routeId;
      markClickedNotifRead(el);
      const r = replyWitnessInvite(fid, false);
      if (r === 'closed') { toast('这个邀请已经不在了'); render(route, routeId, {push:false}); return; }
      if (r === 'dup') { toast('这个邀请已经回应过了'); render(route, routeId, {push:false}); return; }
      toast('已婉拒这个见证邀请');
      render(route, routeId, {push:false});
      return;
    }

    /* 给一条公开留言点赞（独立于 Flag 的点赞）
       ⚠️ 2026-11-23 用户口径：「以及可以为这个围观者的发言的独立点赞按钮
          （其他围观可以点一次，统计次数）。」
       —— 每条留言有【自己的】点赞数，互不影响；
          我对同一条留言【只能点一次】，点过之后按钮变亮、不能再加。 */
    case 'likeMsg': {
      const fid = el.dataset.id || routeId;
      const mid = el.dataset.mid;
      const r = likePublicMsg(fid, mid);
      if (!r.ok) { if (r.msg) toast(r.reason); return; }
      /* 就地更新这一条的数字和状态 —— 不重开半屏 */
      const item = el.closest('.ms-item');
      if (item) {
        el.classList.add('on');
        const num = el.querySelector('span');
        if (num) num.textContent = String(r.msg.likes || 0);
      }
      return;
    }

    /* 判定三选一小框（见需求规格 R5.2）
       判定详情页点「去判定」/ 见证席面板点「去判定」→ 先表态（通过 / 存疑 / 作弊）→ 再提交判定。
       ⚠️ 2026-11-23 用户口径（改，本轮）：见证席面板正文不再放三选一，
          只在【点开某个待判节点】时弹这个框 —— 所以这里要带 taskId，
          提交后把该任务标记为已判，面板节点条上就能看到「我判到第几步」。 */
    case 'openVerdictPicker': {
      const tid = el.dataset.id || null;
      openVerdictPicker((kind) => {
        const map = {pass:'通过', doubt:'存疑', cheat:'作弊'};
        /* ⚠️ 2026-11-25（本轮修复）：**判定提交后的全部结算都收在这一条路径上**。
           —— 原来结算逻辑挂在 `#submitVerdict` 的 click 上，
              而那个 DOM 元素在页面上根本不存在（见下方 bindEvents 里的说明），
              所以那段是死代码 —— **信用分从来没入过账**。
           —— 现在统一走这里：
              ① 标记该任务已判（节点条上打勾）
              ② 展示「分值待结算」说明（UI 不变，搬过来了）
              ③ 异步结算入账（信用分，受每周上限约束）
           —— 判定只有一条提交路径，结算也只能有一条。 */
        const t = tid ? (STATE.verdictTasks || []).find(x => x.id === tid) : null;
        const flagId = t ? t.flagId : null;
        const taskDesc = t
          ? '见证「' + (t.flagUser || '') + '」' + (t.nodeName || '')
          : '见证判定';
        /* ① 标记已判 */
        if (tid) markVerdictDone(tid, kind);
        toast('判定已提交：' + map[kind] + ' · 分值待结算');
        /* ② 待结算说明 */
        showVerdictPendingNote(kind);
        /* ③ 异步结算入账（模拟 AI 秒过 → 事实结论出来） */
        setTimeout(() => {
          if (kind === 'pass') {
            addWitnessCredit('pass', taskDesc + ' 判定通过', flagId);
            toast('结算完成：信用分 +' + creditWitnessValue('pass') + '（本周上限 ' + CREDIT_WITNESS.weeklyCap + '）');
          } else if (kind === 'cheat') {
            addWitnessCredit('cheat', taskDesc + ' 判定作弊并坐实', flagId);
            toast('结算完成：信用分 +' + creditWitnessValue('cheat'));
          } else {
            toast('结算完成：本次判定 0 分');
          }
          if (typeof render === 'function') render();
        }, 1400);
        /* 回到见证席面板 —— 那里能看到完整 Flag + 我的判定进度 */
        render('verdict', null, { push: false });
      });
      return;
    }

    /* 图片查看器（见需求规格 R2.9）—— 围观者「今天的照片」缩略图行的入口 */
    case 'openPhoto': {
      const kind = el.dataset.kind || 'checkin';
      const fid = el.dataset.id;
      const f = findFlag(fid);
      if (!f) { toast('找不到这个 Flag'); return; }
      /* 顶部缩略图行：只放【今天】拍的那几张 —— 与 todayPhotosRow 同源 */
      const row = todayPhotosRow(f);
      if (!row.length) { toast('还没有照片'); return; }
      const start = Math.max(0, row.findIndex(x => x.src === el.dataset.src));
      openPhotoViewer(
        row.map(x => ({
          src: x.src,
          label: x.kind === 'life'
            ? `${f.user.name} 的生活照`
            : `${f.user.name} · 第 ${x.day} 天`,
          caption: x.kind === 'life' ? 'Ta 自己发的生活片段' : '打卡物证 · 平台内公开',
          /* 打卡照看过即记「已看物证」→ 记录他看过哪几天 */
          evidenceId: x.kind === 'checkin' ? f.id : null,
          evidenceDay: x.kind === 'checkin' ? x.day : null,
        })),
        start
      );
      return;
    }

    /* 见证席面板的物证照片行 —— 点开放大看图
       ⚠️ 2026-11-23 用户口径：「展示用户本次打卡的照片就行了……
          用户可以点击放大任意一张。」
       —— 与围观者「今天的照片」不同：这里放的是【本次节点对应的打卡照】
          （连续 4 天，从新到旧），不跳任何页面，直接进放大查看器。 */
    case 'openWitnessShot': {
      const fid = el.dataset.id;
      const f = findFlag(fid);
      if (!f) { toast('找不到这个 Flag'); return; }
      const day = parseInt(el.dataset.day, 10) || 0;
      const row = photosOf(f)
        .filter(p => p.src && p.d <= day)
        .slice(-4)
        .reverse();
      if (!row.length) { toast('还没有照片'); return; }
      const start = Math.max(0, row.findIndex(x => x.src === el.dataset.src));
      openPhotoViewer(
        row.map(x => ({
          src: x.src,
          label: `${f.user.name} · 第 ${x.d} 天`,
          caption: '打卡物证 · 平台内公开',
          /* 打卡照看过即记「已看物证」→ 记录他看过哪几天 */
          evidenceId: f.id,
          evidenceDay: x.d,
        })),
        start
      );
      return;
    }

    /* 微信一键登录 —— 同样需要先同意协议 */
    case 'doLoginWx': {
      if (!privacyChecked()) { toast('请先阅读并同意《用户协议》《隐私政策》'); return; }
      doLogin();
      return;
    }
    /* 手机号 + 验证码登录 */
    case 'doLoginPhone': {
      if (!privacyChecked()) { toast('请先阅读并同意《用户协议》《隐私政策》'); return; }
      doLogin();
      return;
    }

    /* 广场筛选 —— 半屏底部抽屉（见需求规格 R2.15）
       ⚠️ 筛选不再是独立页面：它是【调节动作】，不是【目的地】。
          半屏的好处：广场还在背景里，调完直接看结果。
       ⚠️ 2026-11-24（本轮）：这个抽屉现在【真的能筛出结果】——
          以前 chips 画得像能点，筛完广场还是原来那些局（假控件）。 */
    case 'openFilter': {
      openSheet('筛选', filterPanel());
      return;
    }
    case 'applyFilter': {
      closeSheet();
      const n = squareFilteredFlags().length;
      toast(n ? `已按条件筛选 · ${n} 个 Flag` : '没有符合条件的 Flag');
      render(route, routeId, {push:false});
      return;
    }
    /* 清除筛选 */
    case 'clearSquareFilter': {
      clearSquareFilter();
      closeSheet();
      toast('已清除筛选条件');
      render(route, routeId, {push:false});
      return;
    }
    /* 切换广场视图：推荐 / 关注的人 / 招募中 */
    case 'setSquareView': {
      setSquareView(el.dataset.view);
      render(route, routeId, {push:false});
      return;
    }
    /* 筛选抽屉里的 chip —— 点一下就改条件 */
    case 'setSquareFilter': {
      setSquareFilter(el.dataset.fkey, el.dataset.fval);
      /* 抽屉还在，重画它（让 chip 的选中态和「查看 N 个」实时更新） */
      const sheet = document.querySelector('#sheetBody');
      if (sheet) sheet.innerHTML = filterPanel();
      return;
    }

    /* 分享渠道选择（见 D10.3.3）—— 一个按钮，点了选渠道 */
    case 'openShareChannels': {
      openSheet('分享你的承诺', `
        <div class="list" style="margin-top:2px">
          <div class="row tap" data-act="shareToWx">
            <div class="row-icon" style="background:var(--mint-tint);color:#3F7A58">${ic("message")}</div>
            <div class="row-main"><div class="row-title">微信</div><div class="row-sub">朋友圈 / 好友 · 带码版，含小程序码</div></div>
            <span class="row-arrow">${ICON.chevR}</span>
          </div>
          <div class="row tap" data-act="shareToXhs">
            <div class="row-icon" style="background:var(--rose-tint);color:#B03B40">${ic("bookmark")}</div>
            <div class="row-main"><div class="row-title">小红书</div><div class="row-sub">无码版，只提品牌词</div></div>
            <span class="row-arrow">${ICON.chevR}</span>
          </div>
        </div>
        <div class="field-hint mt">${ic("alert")} 微信版带码，小红书版不带码也不提微信 —— 一张图同时带码 + 提到微信，在小红书是<b>双重违规</b>。</div>
      `);
      return;
    }
    case 'shareToWx': {
      closeSheet();
      toast('已分享到微信');
      return;
    }
    case 'shareToXhs': {
      closeSheet();
      toast('话术已复制，去小红书贴吧');
      return;
    }

    /* ⚠️ 2026-11-24 用户口径（改）：
       「用户点击『分享这张记录卡』，直接这个这卡片，包括下面的 4 个记录，
        截一张图分享就很好，现在是点击以后，进入一个专门的页面，那个效果不好。」
      —— 所以这里**不再跳独立的 share 页**，而是就地升起一个【分享半屏】：
         半屏顶部就是那张海报（凭据主体 + 4 个互动计数 + 品牌落款），
         下面是分享渠道 —— 所见即所得。 */
    case 'shareRecordCard': {
      const poster = document.getElementById('rcPoster');
      /* ⚠️ 2026-11-24（本轮，用户口径 Part 一②）：
         「结束目标详情页底部『看记录卡』和『分享这一局』合并为一个，
          仅保留【分享记录卡】。」
       —— 合并之后，用户**不再经过记录卡页**就点到了这个按钮，
          所以页面上没有 .rc-poster 可搬 —— 这时要自己渲染一张。
       —— 优先搬页面上的（记录卡页里搬的是同一张 DOM，所见即所得），
          没有就现场渲染（目标详情页）。 */
      let posterHtml = poster ? poster.outerHTML : '';
      if (!posterHtml) {
        const pf = findFlag(el.dataset.id) || FLAGS.f_success || FLAGS.f_5;
        posterHtml = `<div class="rc-poster">${recordCardPoster(pf)}</div>`;
      }
      openSheet('分享记录卡', `
        <div class="share-poster-wrap">
          <div class="share-poster-scale" id="sharePosterScale">
            ${posterHtml || '<div class="share-tip">记录卡还没生成</div>'}
          </div>
        </div>
        <div class="share-tip">长按上面的图片，可以保存到相册或直接转发</div>
        <div class="share-channels">
          <button class="share-ch" data-act="shareRecordTo" data-ch="wx">
            <span class="sc-ico sc-wx">${ic('wechat')}</span>
            <span class="sc-l">微信好友</span>
          </button>
          <button class="share-ch" data-act="shareRecordTo" data-ch="moments">
            <span class="sc-ico sc-moments">${ic('users')}</span>
            <span class="sc-l">朋友圈</span>
          </button>
          <button class="share-ch" data-act="shareRecordTo" data-ch="xhs">
            <span class="sc-ico sc-xhs">${ic('bookmark')}</span>
            <span class="sc-l">小红书</span>
          </button>
          <button class="share-ch" data-act="shareRecordTo" data-ch="save">
            <span class="sc-ico sc-save">${ic('download')}</span>
            <span class="sc-l">保存图片</span>
          </button>
        </div>
      `);
      /* 这套半屏有自己的排版（.share-sheet）—— 海报更大、留白更紧 */
      const sh = $('#sheet');
      if (sh) sh.classList.add('share-sheet');
      /* 按可用高度等比缩放海报 —— 保证整张卡一次露全，不截断。
         （弹层有进场动画，布局要等一帧才稳，所以多调几次） */
      fitSharePoster();
      requestAnimationFrame(fitSharePoster);
      setTimeout(fitSharePoster, 120);
      watchSharePoster();
      return;
    }
    /* 记录卡分享的渠道落地 —— 真实环境调起系统/微信分享面板 */
    case 'shareRecordTo': {
      const ch = el.dataset.ch || 'wx';
      closeSheet();
      const MSG = {
        wx: '已调起微信分享 —— 选一个好友发出去',
        moments: '已调起微信分享 —— 发到朋友圈',
        xhs: '图片已保存 —— 去小红书发帖，记得带上「亏了」',
        save: '图片已保存到相册',
      };
      toast(MSG[ch] || '已调起分享');
      return;
    }

    /* ⚠️ 2026-11-24 用户口径：单页快速填写整块删除 —— 立 Flag 只有 4 步分步引导这一条路。
       所以 doCreate（单页提交）这个动作也一并删掉。
       —— 分步引导的第 4 步用 submitCreateStep。 */

    /* 分步引导第 1 步 → 第 2 步：把输入写进草稿 */
    case 'nextCreateGoal': {
      const g = id => { const n = document.getElementById(id); return n ? n.value : ''; };
      const d = STATE.createDraft;
      d.title = (g('cgTitle') || '').trim();
      d.start = g('cgStart') || '';
      d.target = g('cgTarget') || '';
      if (!d.title) { toast('先写一句你的目标'); return; }
      if (!d.start || !d.target) { toast('填一下起始体重和目标体重'); return; }
      render('createPeriod');
      return;
    }

    /* 分步引导第 2 步 → 第 3 步 */
    case 'nextCreatePeriod': {
      render('createDeposit');
      return;
    }

    /* ⚠️ 2026-11-24（本轮）：第 3 步 → 第 4 步这个动作删掉了 ——
       「押多少」和「交押金」合并成了一步（③ 确认并支付）。
       —— 原来的 `nextCreateDeposit`（第 3 步 → 第 4 步）不再需要。 */

    /* 分步引导提交：③ 确认并支付 —— 先弹二次确认，确认后才真的提交
     *  ⚠️ 2026-11-24（本轮）：原来第 4 步点「确认支付」直接提交。
     *     现在改成【先弹一次二次确认】，弹窗里要说清三件事（用户原话）：
     *       「交完这一笔，你的承诺就公开生效。
     *         接下来有 24 小时可以找见证人 ——
     *         见证人是来监督你的，不会影响你的目标能不能达成。」
     *  —— 为什么这句话必须放在这里（掏钱那一刻）：
     *     否则用户会形成「见证人是来给我使绊的」这种心智模型，
     *     一形成就会主动少找见证人 —— 而见证人恰恰是这个产品最核心的机制。 */
    case 'confirmPayAndSubmit': {
      const d = STATE.createDraft || {};
      if (!d.agreedPay) { toast('请先勾选确认押金规则'); return; }
      const days = selPeriod();
      const deposit = selDeposit();
      const isZero = deposit === 0;
      /* ⚠️ 2026-11-24（本轮）：弹窗正文最后那一行小字删掉 ——
         「押金 ¥500.00 · 14 天 · 目标「xxx」」——
         用户口径：「删除最下面一行小字（押金 500 / 14 天目标这类描述）」。
         为什么：这一页上押金数额已经写在档位区、周期写在第 2 步、
         目标写在第 1 步 —— 弹窗里再说一遍是第三次重复，
         而弹窗是【最后一道确认】，用户在这里只需要看那句「公开生效 / 24 小时」。 */
      dialog('确认支付？',
        isZero
          ? `你的承诺<b>同样公开生效</b>。接下来有 <b>24 小时</b>可以找见证人 —— ` +
            `见证人是来<b>监督你的</b>，<b>不会影响你的目标能不能达成</b>。<br><br>` +
            `押金 0 元（首次免费）—— 这一局照常加分。`
          : `交完这一笔，你的承诺就<b>公开生效</b>。接下来有 <b>24 小时</b>可以找见证人 —— ` +
            `见证人是来<b>监督你的</b>，<b>不会影响你的目标能不能达成</b>。`,
        '确认支付',
        () => {
          submitFlag({
            title: (d.title || '').trim() || '我还没写目标',
            start: d.start || 0,
            target: d.target || 0,
            period: days,
            deposit,
            witnesses: [],   // 见证人留到发起成功页的 24h 筹备期里慢慢找
          });
        },
        /* ⚠️ 2026-11-24（本轮）：「取消」「确认支付」两个按钮等宽居中 */
        true);
      return;
    }

    /* 取消进行中的 Flag（见需求规格 R1.6）
       ⚠️ 必须二次确认 —— 取消不可撤销，且押金按失败口径扣收。
          取消 = 一局没撑完，不是「撤销这笔交易」。
       ⚠️ 2026-11-21 用户要求：弹窗必须明确告知「押金不可退」。 */
    case 'doCancelFlag': {
      const fid = el.dataset.id || routeId;
      const f = findFlag(fid) || myMainFlag();
      if (!f) { toast('找不到这个 Flag'); return; }
      const can = canCancelFlag(f);
      if (!can.ok) { toast(can.reason); return; }
      /* 提前算好扣多少 —— 弹窗里要写清楚具体数字 */
      const loss = failureLoss(f.deposit || 0, STATE.credit);
      const creditDelta = -creditFailPenaltyFor(f);
      /* ⚠️ 首次免费（押金 0 元）：没有押金可扣，但信用分照扣 —— 弹窗口径要跟着改 */
      const isFree = isZeroDepositFlag(f);
      dialog(
        '确定要取消这个 Flag？',
        `「${f.title}」<br><br>` +
        `取消<b>不可撤销</b>。<br>` +
        (isFree
          ? `· 押金 <b>0 元</b>，没有钱要赔<br>` +
            `· <b>信用分照扣 ${creditDelta} 分</b> —— 首次免费也一样算履约<br><br>`
          : `· <b>押金 ${f.deposit || 0} 元不退还</b>，按你的信用等级扣 <b>${loss} 元</b><br>` +
            `· 信用分 <b>${creditDelta} 分</b><br><br>`) +
        `已打卡 ${f.checkedDays} 天的记录会保留，但这个 Flag 按<b>未达标</b>结算。`,
        '确认取消',        () => {
          const r = cancelMyFlag(f.id);
          if (!r || !r.ok) { toast((r && r.reason) || '取消失败'); return; }
          toast(isFree ? '已取消（首次免费 · 信用分照扣）' : `已取消 —— 亏了 ${r.loss} 元`);
          /* 取消后回到「我的 Flag」—— 那里能看到结算结果 */
          render('myFlags', null, { push: false });
        }
      );
      return;
    }

    /* 打卡：推进天数 + 加信用分 */
    case 'doCheckin': {
      const f = myMainFlag();
      if (!f) { toast('你还没有进行中的 Flag'); render('myFlags'); return; }
      /* ⚠️ 打卡照是必填（见需求规格 R2.8）—— 没拍不能提交。
         补充照再多也不能替代打卡照。 */
      if (!hasCheckinShot()) {
        toast('先拍一张打卡照');
        render(route, routeId, {push:false});
        return;
      }
      /* ⚠️ 2026-11-24（本轮修复）：同一天不能重复打卡 ——
         原来这里没有任何拦截，打卡 → 返回 → 再进 → 再提交，
         checkedDays 会 +2、streak 虚增、信用分里程碑能被刷。
         —— 现在打之前先挡一道，挡住了就提示 + 退回打卡页（按钮是禁用态）。 */
      if (checkedToday(f)) {
        toast('今天已经打过卡了');
        render('checkin', f.id, { push: false });
        return;
      }
      const w = f.curWeight ? (f.curWeight - 0.1).toFixed(1) : 0;
      const before = f.streak;
      const r = doCheckin(f.id, w);
      /* doCheckin 里也有一道兜底拦截（状态层的单一真相源） */
      if (!r || r.ok === false) {
        toast((r && r.reason) || '打卡失败');
        render(route, routeId, { push: false });
        return;
      }
      /* 打卡照（物证）落到 photos 序列 —— 按天索引，断卡天是空格子 */
      const shot = commitCheckinShot(f.id, f.checkedDays);
      /* 补充照片（生活照）落到 Flag 上 —— 第 1 张即封面图
         ⚠️ 打卡照是物证，补充照是内容，两者是分开的 */
      const extra = commitExtraPhotos(f.id, f.checkedDays);
      /* 心情 / 体悟落到当天那格（见需求规格 R2.11）—— 围观者能看到 */
      const note = commitCheckinNote(f.id, f.checkedDays);
      clearCheckinDraft(f.id);
      if (note) toast('打卡成功 · 留言已发布');
      else if (extra.length) toast(`打卡成功，${extra.length} 张生活照已发布`);
      else toast('打卡成功');
      render('checkinDone', f.id);
      return;
    }

    /* ⚠️ 2026-11-24（本轮，用户口径 Part 二②）：提交补卡 ——
       —— 补卡页 = 今日打卡页的另一种模式（见 R2.30②），
          所以这里做的事跟 doCheckin **逐条一样**，
          唯一区别是：① 写入的天是【漏掉的那天】；② 不加 streak / 信用分 / 里程碑。
       —— 走的是 doMakeup（状态层单一真相源），不是自己手改 Flag。 */
    case 'doMakeupCheckin': {
      submitMakeupCheckin();
      return;
    }

    /* 拍打卡照（物证）—— 见需求规格 R2.8
       ⚠️ demo 里没有真实相机通道 —— 用素材池里的一张占位。
          真实环境：takePhoto → 上传 → 返回 src。 */
    case 'takeCheckinShot': {
      const f = myMainFlag() || FLAGS.f_own;
      const src = photoFor((f.checkedDays || 0) + 1, 0);
      setCheckinShot(src, f.curWeight);
      toast('拍好了');
      render(route, routeId, {push:false});
      return;
    }

    /* ---------- 补充照片（见需求规格 R2.6 / R2.8） ----------
       ⚠️ 上传动作【独立于打卡按钮】—— 不触发打卡，也不影响打卡进度
       ⚠️ 2026-11-21：点「+」号框就是拍照（真实环境走 takePhoto） */
    case 'addExtraPhoto': {
      const list = pendingExtraPhotos();
      if (list.length >= MAX_EXTRA_PHOTOS) {
        toast(`最多 ${MAX_EXTRA_PHOTOS} 张 —— 先删一张再传`);
        return;
      }
      /* demo 里没有真实上传通道 —— 用素材池里的一张占位。
         真实环境：这里换成 takePhoto + 上传接口。 */
      const slot = list.length;
      const src = lifePhotoFor(routeId || 'draft', STATE.checkinDraft ? (list.length + 1) : 1, slot);
      addExtraPhoto(src);
      toast(list.length === 0 ? '已添加 —— 这张现在是封面图' : '已添加');
      render(route, routeId, {push:false});
      return;
    }

    case 'rmExtraPhoto': {
      const slot = el.dataset.slot;
      if (removeExtraPhoto(slot)) toast('已删除');
      render(route, routeId, {push:false});
      return;
    }

    case 'setCoverPhoto': {
      const slot = el.dataset.slot;
      if (setCoverPhoto(slot)) toast('已设为封面图');
      render(route, routeId, {push:false});
      return;
    }

    /* 监督（旧的动作）—— ⚠️ 2026-11-24（本轮）：
       「监督这一局」独立页已删，详情页底部改成眼睛图标（toggleSupervise），
       所以这个 action 现在没有入口了。保留一小段兜底：
       万一有别处还在用 data-act="doSubscribe"，至少行为是对的（切一次监督状态）。 */
    case 'doSubscribe': {
      const id = el.dataset.id || routeId;
      if (!id) { toast('已监督，结局会通知你'); return; }
      if (STATE.subscribed.includes(id)) {
        unsubscribeFlag(id);
        /* ⚠️ 2026-11-24：监督数是动态人数 —— 取消监督要把数减回去
           （跟广场卡片的 toggleSupervise 保持一致） */
        const f = findFlag(id);
        if (f) f.supervisorCount = Math.max(0, (f.supervisorCount || 0) - 1);
        toast('已取消监督');
      } else {
        subscribeFlag(id);
        const f = findFlag(id);
        if (f) f.supervisorCount = (f.supervisorCount || 0) + 1;
        toast('已监督，结局会通知你');
      }
      render(route, routeId, {push:false});
      return;
    }

    /* 监督（广场卡片的眼睛图标 / 目标详情页底部的眼睛按钮）
       ⚠️ 2026-11-24 用户口径：
       「监督也可以点，点了就监督了，颜色改变，再点一次取消监督。」
       —— 没有二次确认（不像「我监督的 Flag」列表页的取消，那里有确认弹窗）——
          这里就是广场卡片上的一下切换，轻量动作。
       ⚠️ 2026-11-24（本轮）：目标详情页底部的「监督这一局」也改成了这个动作 ——
          原来那个按钮要先进一个独立页面（里面还有三个点不动的假开关），
          现在两处统一：点一下就监督、再点一下取消。 */
    case 'toggleSupervise': {
      const id = el.dataset.id || routeId;
      if (!id) return;
      const r = toggleSupervise(id);
      /* 就地更新：不重开页面 */
      const btn = el.closest('.feed-sup') || el.closest('.fd-sup');
      if (btn) {
        btn.classList.toggle('on', r.on);
        if (btn.classList.contains('fd-sup')) {
          /* 详情页的按钮：文字（监督这一局 / 已监督）+ 右侧人数 */
          const label = btn.querySelector('span');
          const num = btn.querySelector('.fd-sup-n');
          if (label) label.textContent = r.on ? '已监督' : '监督这一局';
          if (num) num.textContent = String(r.count);
        } else {
          const num = btn.querySelector('span');
          if (num) num.textContent = String(r.count);
        }
        if (r.on) {
          btn.classList.add('pop');
          setTimeout(() => btn.classList.remove('pop'), 420);
        }
      }
      toast(r.on ? '已监督，结局会通知你' : '已取消监督');
      return;
    }

    /* 取消监督（我监督的 Flag 列表页）—— ⚠️ 2026-11-23 用户口径：
       「把右边的按钮改为『取消监督』，用户点击后，小窗二次确认。」
       —— 取消监督是不可逆的「我不再关心这一局」，所以要二次确认。 */
    case 'doUnsubscribe': {
      const id = el.dataset.id || routeId;
      if (!id) return;
      const f = findFlag(id);
      const name = f ? f.user.name : '这个人';
      dialog(
        '取消监督？',
        `取消后，<b>${name}</b> 这一局的断卡和结局就<b>不再通知你</b>了。<br><br>` +
        `已经过去的打卡记录仍然可以随时去看。`,
        '取消监督',
        () => {
          unsubscribeFlag(id);
          /* ⚠️ 2026-11-24：监督数是动态人数 —— 取消监督要把数减回去 */
          if (f) f.supervisorCount = Math.max(0, (f.supervisorCount || 0) - 1);
          toast('已取消监督');
          render(route, routeId, { push: false });
        }
      );
      return;
    }

    /* 关注 / 取消关注（见需求规格 R2.12）—— 关注的是【人】 */
    case 'doFollow': {
      const name = el.dataset.name;
      if (!name) { toast('关注失败'); return; }
      if (isFollowing(name)) {
        unfollowUser(name);
        toast(`已取消关注 ${name}`);
      } else {
        followUser(name);
        toast(`已关注 ${name} —— 他有新局你会看到`);
      }
      render(route, routeId, {push:false});
      return;
    }

    /* 申请进入见证席候选池 */
    case 'applyPool': {
      if (!canApplyToPool()) { toast(`还没满足条件：累计互动 ${witnessApplyNeed()} 次`); return; }
      applyToPool();
      toast('已进入见证席候选池');
      render(route, routeId, {push:false});
      return;
    }

    /* ⚠️ 2026-11-22 用户口径（改）：候选池排序维度改成可点的控件（见 4.9.4） */
    case 'setPoolSort': {
      const key = el.dataset.key;
      if (!setPoolSort(key)) return;
      render(route, routeId, {push:false});
      return;
    }

    /* ⚠️ 2026-11-23 用户口径（改）：候选池点「邀请」后按钮变「已邀请」（见 R5.9.4.3） */
    case 'inviteFromPool': {
      const id = el.dataset.id;
      const p = poolCandidate(id);
      if (!p) { toast('找不到这位候选人'); return; }
      if (poolInvited(id)) { toast(`已经邀请过 ${p.name} 了`); return; }
      inviteFromPool(id);
      toast(`已向 ${p.name} 发出见证邀请`);
      render(route, routeId, {push:false});
      return;
    }

    /* ⚠️ 2026-11-24（本轮，用户口径 Part 三①）：候选池点头像 / 名字
       —— 改成【跳该用户主页】（data-go="userProfile" + data-from="pool"），
          「候选人详情半屏」（viewPoolCandidate / openPoolCandidateSheet）**整块删掉**。
       —— 原因：那个半屏只重复了列表里已有的信用分 / 成立率，
          而用户主页上是**完整的长期档案**（信用等级、见证情况、Ta 的 Flag）。
          挑人是件大事，值得跳一个完整的页面去看。 */

    /* ⚠️ 2026-11-23 用户口径（改）：申请成为见证席改成【居中小框】当场评估
       —— 不再有独立页面（见 R5.9.2.3）。 */
    case 'applyWitness': {
      openWitnessApplyDialog();
      return;
    }
    case 'goSquareFromApply': {
      closeDialog();
      render('square');
      return;
    }

    /* ⚠️ 2026-11-24 用户口径：「成为见证席以后，见证席面板应该展示
       目前正在招募见证的列表，可以选择参加……」
       ⚠️ 2026-11-24（本轮）：见证席面板里的那个列表删掉了 ——
       招募的【发现】在广场「招募中」视图，【收到】走通知「判定·邀请」栏。
       这个动作现在从广场横条 / 招募详情页进入。 */
    case 'applyJoinWitness': {
      const id = el.dataset.id;
      /* ⚠️ 2026-11-24（本轮）：申请当见证席是【有责任的动作】，
         在信息流里点一下就直接生效太容易误触，所以弹一次确认。
         —— 确认框里说清楚三件事：谁的局、什么周期、押金多少（决定要不要去）。 */
      const target = findFlag(id);
      if (!target) { toast('找不到这个局'); return; }
      dialog('我想参加这一局的见证席？',
        `<b>${target.user.name}</b> 的「${(target.title || '').slice(0, 18)}${(target.title || '').length > 18 ? '…' : ''}」<br>` +
        `${target.days} 天 · 押金 ¥${depositPaidOf(target)}<br><br>` +
        `你会作为见证席参与这一局的判定 —— 判定要由你和其他见证席共同确认。<br>` +
        `发起人会收到你的申请，确认后才算数。`,
        '我想参加',
        () => {
          const r = applyJoinWitness(id);
          if (r === 'max') {
            dialog('最多申请 3 个', `你一次最多同时申请 ${WITNESS_JOIN_MAX} 个局的见证席。<br>已经申请 ${witnessApplyingCount()} 个了 —— 先等一个回复。`);
            return;
          }
          if (r === 'dup') { toast('这个局你已经申请过了'); return; }
          if (r === 'closed') { toast('这个局已经不在招募了'); render(route, routeId, {push:false}); return; }
          toast('申请已发出 —— 等发起人确认');
          render(route, routeId, {push:false});
        });
      return;
    }

    /* ⚠️ 2026-11-24 用户口径：「右上角增加一个编辑资料的按钮，
       用户可以对这些资料进行调整。」
       —— ⚠️ 2026-11-24（本轮，用户口径 Part 二①）：
          「编辑页改为全屏：右上角修改资料按钮当前为半屏弹出，改为全屏页面打开。」
       —— 所以这里**不再弹小框**，而是跳到 editProfile 全屏页。
          ID号与加入时间不可改，但**不再写「不可修改」的提示**（Part 二②）。 */
    case 'editProfile': {
      render('editProfile');
      return;
    }

    /* ⚠️ 2026-11-24（本轮，用户口径 Part 二）：全屏编辑页的【保存】——
       —— 读页面上的字段 → updateMyProfile → 回「我的」页。
       —— 用 goBack() 而不是 render('profile')：goBack 会把栈里那一层
          【编辑资料】弹掉，直接回到「我的」，返回键再按一次不会又回到编辑页。 */
    case 'saveProfile': {
      const ageEl = $('#epAge');
      const genderEl = $('#epGender');
      const provEl = $('#epProv');
      const bioEl = $('#epBio');
      updateMyProfile({
        age: ageEl && ageEl.value ? Number(ageEl.value) : null,
        gender: genderEl ? genderEl.value : null,
        province: provEl ? provEl.value : null,
        bio: bioEl ? bioEl.value.trim() : null,
      });
      toast('资料已保存');
      goBack();
      return;
    }

    /* ⚠️ 2026-11-24（本轮，用户口径 Part 七①）：更换头像 ——
       —— 用户口径：「当前头像不能变更；需支持点击头像，
          弹出更换头像照片的操作按钮 / 入口。」 */
    case 'openAvatarPicker': {
      openAvatarPickerSheet();
      return;
    }
    case 'pickAvatar': {
      setMyAvatar(el.dataset.src);
      closeSheet();
      toast('头像已更换');
      render(route, routeId, {push:false});
      return;
    }
    case 'resetAvatar': {
      resetMyAvatar();
      closeSheet();
      toast('已恢复默认头像');
      render(route, routeId, {push:false});
      return;
    }
    case 'avatarFromAlbum': {
      /* ⚠️ demo 里没有真实的相册通道 —— 提示一下，真实环境是 chooseMedia */
      toast('demo 环境：直接从下面选一张吧');
      return;
    }
    case 'avatarFromCamera': {
      /* ⚠️ demo 里没有真实的相机通道 —— 提示一下，真实环境是 takePhoto */
      toast('demo 环境：直接从下面选一张吧');
      return;
    }

    /* ⚠️ 2026-11-22 用户口径（改）：召集令就地发布，不跳独立页面（见 R5.6）
       ⚠️ 2026-11-23 用户口径（再改）：确认框里**不再展示文案** ——
          「点击『发布见证席召集令』，弹出『再想想』和确认发布『就行了，不需要文案。』
          —— 文案是发布出去的内容，不是发布前要确认的东西。
          弹层只剩两个按钮：一个「再想想」，一个「确认发布」。 */
    case 'publishRecruit': {
      if (STATE.recruitPublished) { openRecruitSheet(); return; }
      openSheet('发布见证席召集令', `
        <div style="display:flex;gap:10px">
          <button class="btn ghost block" data-act="closeSheet">再想想</button>
          <button class="btn block" data-act="confirmRecruit">确认发布</button>
        </div>
      `);
      return;
    }
    case 'confirmRecruit': {
      publishRecruit();
      closeSheet();
      toast('见证席召集令已发布');
      render(route, routeId, {push:false});
      return;
    }
    case 'openRecruitSheet': {
      openRecruitSheet();
      return;
    }
    case 'closeSheet': {
      closeSheet();
      return;
    }
    /* ⚠️ 2026-11-24（本轮）：见证席名单半屏 ——
       入口是目标详情页顶部的「N 位见证席」小卡片（可点）。
       框里点人头像 → 进他的主页。 */
    case 'openWitnessList': {
      openWitnessListSheet(el.dataset.id);
      return;
    }
    /* ⚠️ 2026-11-24（本轮）：打卡日历点某一天 → 半屏（原来跳整页）。
       半屏里只有那天的照片和留言。 */
    case 'openDaySheet': {
      openDaySheet(el.dataset.id, el.dataset.day);
      return;
    }
    /* ⚠️ 2026-11-24（本轮）：见证席判定 —— 点某个节点 → 半屏看判定汇总。
       半屏里只展示应判/实判人数 + 通过/存疑/作弊数量 + 判定时间，
       不展示是谁判的。 */
    case 'openVerdictSummary': {
      openVerdictSummarySheet(el.dataset.id, el.dataset.node);
      return;
    }
    /* 报名者：⚠️ 2026-11-24（本轮）这个入口删掉了 ——
       点头像 / 名字现在直接跳用户主页（data-go="userProfile"），
       不再在半屏里再叠一个小框（openApplicantSheet 已删）。 */
    case 'acceptApplicant': {
      const id = el.dataset.id;
      if (!acceptApplicant(id)) { toast('这位报名者已经处理过了'); return; }
      /* ⚠️ 处理完回到【报名情况列表】—— 用户是在列表里逐个处理人的，
         接受一个就退回列表，比退回空白页合理。
         ⚠️ 2026-11-24（本轮）：重开这个半屏之后，那一行会变成
            「已接受」状态（tag），按钮消失 —— 状态随操作切换。 */
      openRecruitSheet();
      toast('已接受 —— 他成为你的见证席');
      render(route, routeId, {push:false});
      return;
    }
    case 'declineApplicant': {
      const id = el.dataset.id;
      if (!declineApplicant(id)) { toast('这位报名者已经处理过了'); return; }
      /* ⚠️ 2026-11-24（本轮）：拒绝之后那一行变成「已拒绝」状态（tag） */
      openRecruitSheet();
      toast('已拒绝');
      render(route, routeId, {push:false});
      return;
    }

    /* ⚠️ 2026-11-24（本轮修复）：提交异议 ——
       原来「提交异议」按钮只有 data-toast，点下去弹一句 toast 就没了，
       **异议根本没进库** —— state.js 里的 submitObjection() 逻辑是齐的
       （3 票上限 / 状态机 / 推通知），但从来没有被调用过。
       —— 现在真的走 submitObjection()，并把用户选中的理由一起带走。 */
    case 'submitObjection': {
      const fid = el.dataset.id || routeId;
      const f = findFlag(fid);
      if (!f) { toast('找不到这个 Flag'); return; }
      /* 收集勾选的理由 —— 开关上带 data-obj-reason 索引 */
      const picked = [];
      document.querySelectorAll('[data-obj-reason].on').forEach(sw => {
        const i = Number(sw.dataset.objReason);
        const r = OBJECTION_REASONS[i];
        if (r) picked.push(r.t);
      });
      if (!picked.length) { toast('先选一条异议理由'); return; }
      /* 补充说明（选填） */
      const noteEl = document.getElementById('objNote');
      const note = noteEl ? noteEl.value.trim() : '';
      /* 理由 + 补充说明 拼成一条可读的异议描述 */
      const reason = picked.join('、') + (note ? `（${note}）` : '');
      const r = submitObjection({
        flagId: fid,
        node: '今日物证',
        day: f.checkedDays,
        reason,
        ts: '刚刚',
      });
      if (!r.ok) { toast(r.reason); return; }
      toast('异议已提交 · 满 3 票转人工复核');
      /* 投完重画这一页 —— 顶部会出现「你已提出异议」的进度条 */
      render(route, routeId, { push: false });
      return;
    }

    default:
      toast('该操作在原型中暂未实现');
  }
}

/* ---------------- 图片查看器（纯浏览视角，见需求规格 R2.9）----------------
   ⚠️ 与「物证详情页（checkinLogItem）」是两回事：
      物证详情 = 第 N 天的证据（秤读数 / AI 校验 / 水印 / 打卡状态）
      查看器   = 一次看一组照片，左右滑切换 —— 围观者想「看照片」时该来的地方
   打卡照被看过即记为「已看物证」—— 记录他看过哪几天（⚠️ 2026-11-24 起不再承担异议前置） */
const pv = $('#pv');
const pvTitle = $('#pvTitle');
const pvCount = $('#pvCount');
const pvTrack = $('#pvTrack');
const pvFoot = $('#pvFoot');
let pvList = [];
let pvIdx = 0;

/** 打开图片查看器
 *  @param {Array} list [{src, label}] —— 按传入顺序展示
 *  @param {number} idx 初始定位到第几张 */
function openPhotoViewer(list, idx) {
  pvList = list || [];
  if (!pvList.length) return;
  pvIdx = Math.max(0, Math.min(idx || 0, pvList.length - 1));
  pvTrack.innerHTML = pvList.map((p, i) => `
    <div class="pv-slide" data-i="${i}">
      <img src="${p.src}" alt="${p.label || '照片'}">
    </div>`).join('');
  pv.classList.add('on');
  syncPv();
  requestAnimationFrame(() => {
    const el = pvTrack.querySelector(`[data-i="${pvIdx}"]`);
    if (el) pvTrack.scrollLeft = el.offsetLeft;
  });
}

function syncPv() {
  const p = pvList[pvIdx] || {};
  pvTitle.textContent = p.label || '照片';
  pvCount.textContent = pvList.length > 1 ? `${pvIdx + 1} / ${pvList.length}` : '';
  /* 打卡照：记为「已看过物证」—— 记录他看过哪几天（⚠️ 2026-11-24 起不再承担异议前置） */
  if (p.evidenceId && p.evidenceDay) markEvidenceSeen(p.evidenceId, p.evidenceDay);
  pvFoot.innerHTML = (p.caption ? p.caption + '<br>' : '') +
    (p.evidenceId
      ? `<button class="pv-link" data-go="checkinLogItem" data-id="${p.evidenceId}" data-day="${p.evidenceDay}">看这一天的物证详情 ›</button><br>`
      : '') +
    (pvList.length > 1
      ? `<div class="pv-dots">${pvList.map((_, i) => `<i class="pv-dot ${i===pvIdx?'on':''}"></i>`).join('')}</div>`
      : '');
}

function closePhotoViewer() {
  pv.classList.remove('on');
  pvList = [];
}

$('#pvClose').addEventListener('click', closePhotoViewer);
pvTrack.addEventListener('scroll', () => {
  if (!pvList.length) return;
  const i = Math.round(pvTrack.scrollLeft / Math.max(1, pvTrack.clientWidth));
  if (i !== pvIdx && i >= 0 && i < pvList.length) { pvIdx = i; syncPv(); }
});
/* 底部「看这一天的物证详情」→ 关掉查看器再跳（否则详情页被浮层盖住） */
pvFoot.addEventListener('click', e => {
  const btn = e.target.closest('[data-go]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const day = btn.dataset.day || null;
  closePhotoViewer();
  render('checkinLogItem', btn.dataset.id, { day, push: true });
});

/* ---------------- 底部弹层（可拖拽关闭） ---------------- */
/**
 * 见证席判定 —— 单个节点的判定汇总半屏（2026-11-24 本轮新增，见需求规格 R2.26⑤⑥）
 * —— 入口：目标详情页「见证席判定」区里点某个节点名。
 *
 * ⚠️ 用户口径：
 *   「半框内展示：应判多少人、实判多少人，以及通过多少、存疑多少、作弊多少
 *     三项判定数量和判定时间；不展示具体是谁判定的。」
 *
 * ⚠️ 为什么**不展示是谁判的**：
 *   见证席是**实名担责**的，但判定名单属于【参与者的隐私】——
 *   围观者看到「小李判了通过」这一串，等于把见证席的判定记录公开处刑，
 *   也会让围观者去针对某个见证席（"你为什么判他作弊"）。
 *   —— 展示**汇总**（多少人判了、判成了什么样、什么时候判的）就够了：
 *      这些是这一局的**结论**，是公开信息；
 *      谁投的票是**过程**，不必公开。
 */
function openVerdictSummarySheet(flagId, nodeIdx) {
  const f = findFlag(flagId);
  if (!f) { toast('找不到这个 Flag'); return; }
  const nodes = f.nodes || [];
  const node = nodes[Number(nodeIdx)];
  if (!node) { toast('找不到这个节点'); return; }
  const s = verdictSummaryOf(f, node);
  const pending = s.judged === 0;
  openSheet(`见证席判定 · ${node.name}`, `
    <div class="tiles c2">
      ${tile(s.expected, '应判人数')}
      ${tile(s.judged, '实判人数', pending ? '' : 'brand')}
    </div>

    ${pending ? `
    <div class="note sky" style="margin-top:14px">
      <b>这个节点还没判定。</b>见证席正在判定中，判定完这里会显示结果。
    </div>` : `
    <div class="vd-sum">
      <div class="vd-sum-row">
        <span class="vd-sum-ico mint">${ic('checkCircle')}</span>
        <span class="vd-sum-k">通过</span>
        <span class="vd-sum-v">${s.pass} 人</span>
      </div>
      <div class="vd-sum-row">
        <span class="vd-sum-ico amber">${ic('helpCircle')}</span>
        <span class="vd-sum-k">存疑</span>
        <span class="vd-sum-v">${s.doubt} 人</span>
      </div>
      <div class="vd-sum-row">
        <span class="vd-sum-ico rose">${ic('close')}</span>
        <span class="vd-sum-k">作弊</span>
        <span class="vd-sum-v">${s.cheat} 人</span>
      </div>
    </div>

    <div class="field-hint" style="margin-top:12px">
      判定时间：<b>${s.time}</b>
    </div>`}

    <div class="field-hint" style="margin-top:8px">
      见证席判定<b>实名担责</b>，但判定名单不公开 ——
      公开的是这一局的<b>结论</b>（多少人判了、判成了什么样）。
    </div>
  `);
}

/**
 * 打卡日历 —— 点某一天弹出的半屏（2026-11-24 本轮新增，见需求规格 R2.26④）
 * —— 原来是【整页跳转】（checkinLogItem），点一下日历就跳走，
 *    看一眼那天的照片还要再点返回 —— 打断阅读。
 *
 * ⚠️ 用户口径：「点击日历中某一日期，由当前全屏展示改为半屏弹出；
 *   半屏内仅展示当日打卡照片和留言，其余内容不展示。」
 * —— 所以这个半屏里**只有两样东西**：
 *    ① 当天那张打卡照片（大图）
 *    ② 当天的心情留言
 *   —— 不展示体重、不展示较昨日差值、不展示见证席审核结果、
 *      不展示见证席名单 —— 那些是【看细节】才需要的东西，
 *      而日历上点一天这个动作本身就只是「看一眼那天发了什么」。
 */
function openDaySheet(flagId, day) {
  const f = findFlag(flagId);
  if (!f) { toast('找不到这个 Flag'); return; }
  const d = Number(day);
  const photos = photosOf(f);
  const p = photos.find(x => x.d === d) || null;
  const note = noteOf(f, d);
  const dateStr = isoAddDays(f.start, d - 1).slice(5);
  const isMiss = !p || p.st === 'miss';
  openSheet(`第 ${d} 天 · ${dateStr}`, `
    ${isMiss ? `
    <div class="ev-photo ev-miss">
      ${ic('close')}
      <div style="font-size:14px;font-weight:600;margin-top:6px">这一天没有打卡</div>
      <div style="font-size:11.5px;opacity:.72;margin-top:3px">断卡</div>
    </div>` : `
    <div class="ev-photo">
      <img src="${p.src}" alt="第 ${d} 天打卡照片">
      <div class="ev-wm">${f.user.name} · ${dateStr}</div>
      ${p.st === 'makeup' ? '<div class="ev-badge">补卡</div>' : ''}
    </div>`}
    ${note ? `
    <div class="ev-note">
      <div>${note}</div>
    </div>` : `
    <div class="field-hint" style="margin-top:12px">这一天没有留言。</div>`}
  `);
}

/**
 * 见证席名单半屏（2026-11-24 本轮新增，见需求规格 R2.26①③）
 * —— 从目标详情页顶部的「N 位见证席」小卡片点开。
 *
 * ⚠️ 为什么要有这个半屏：
 *   原来「谁在替这一局背书」藏在下面那块「见证席 N 位」卡片里，
 *   要展开「名单与责任」的折叠才能看到，而且看的是**文字**不是**人**。
 *   围观者点进一个 Flag，第一句想问的是「**这局谁在看着**」。
 *   —— 所以把它提到顶部、做成可点的、并且用**头像**呈现。
 *
 * ⚠️ 框内点头像 → 进那个人的主页（data-go="userProfile"）。
 */
function openWitnessListSheet(flagId) {
  const f = findFlag(flagId);
  if (!f) { toast('找不到这个 Flag'); return; }
  const ws = f.witnesses || [];
  /* ⚠️ 2026-11-24（本轮）：档位说明（初始档位 → 有效档位）原来在
     「见证席 N 位」那块卡片里 —— 那块卡按用户口径删掉了，
     所以这两行挪到这个半屏（它本来就是「见证席的事」）。 */
  const init = f.initialTier || f.tier;
  const eff  = f.effectiveTier || f.tier;
  const dropped = init !== eff;
  openSheet('见证席名单', `
    <div class="field-hint" style="margin:0 0 4px">
      这一局有 <b>${ws.length}</b> 位见证席 · 点头像可以进他的主页
    </div>
    <div class="field-hint" style="margin:0 0 12px">
      ${dropped
        ? `初始档位 <b>${init}</b> → 有效档位 <b>${eff}</b>（已降档，本局降了不回来）`
        : `初始档位 <b>${init}</b> · 信用分系数 ×${creditMulOf(eff)}`}
    </div>
    ${ws.length ? `
    <div class="list">
      ${ws.map(w => `
      <div class="row">
        <span class="row-ava tap" data-go="userProfile" data-id="${w.name}" data-from="witness" data-flag-id="${f.id}">${ava(w.name, 'sm')}</span>
        <div class="row-main tap" data-go="userProfile" data-id="${w.name}" data-from="witness" data-flag-id="${f.id}">
          <div class="row-title">${w.name}</div>
          <div class="row-sub">${w.verdict || '见证中'}${w.joined ? ' · ' + w.joined : ''}</div>
        </div>
        <span class="row-arrow">${ICON.chevR}</span>
      </div>`).join('')}
    </div>
    <div class="field-hint mt">
      见证席要在这局的各个节点各判定一次 —— 他们是<b>来监督你的</b>，
      <b>不会影响你的目标能不能达成</b>。
    </div>
    ` : `
    <div class="note sky">
      <b>还没有见证席。</b>没有见证席也能跑通完整闭环，只是背书弱、stakes 小。
    </div>
    `}
  `);
}

function openSheet(title, html) {
  sheetTitle.innerHTML = title;
  sheetBody.innerHTML = html;
  sheet.classList.add('on');
  scrim.classList.add('on');
  sheetBody.scrollTop = 0;
  /* ⚠️ 每次开弹层先清掉「留言半屏」专属样式（.msg-sheet）——
     同一个 .sheet 元素会被复用，不清会串样式。 */
  sheet.classList.remove('msg-sheet');
  /* 「记录卡直发」半屏有自己的一套排版（.share-sheet）—— 同理要先清掉 */
  sheet.classList.remove('share-sheet');
  /* 分段控件指示块按真实宽度定位 */
  requestAnimationFrame(() => {
    sheetBody.querySelectorAll('.login-tabs').forEach(initSegThumb);
  });
}

/* ============================================================
   分享半屏 —— 记录卡直发（2026-11-24 用户口径）
   ------------------------------------------------------------
   「用户点击『分享这张记录卡』，直接这个这卡片，包括下面的 4 个记录，
    截一张图分享就很好。」
   —— 半屏顶部就是那张海报本身，下面是分享渠道。
   —— 海报要【整张一次露全】：按可用高度等比缩放，绝不截断。
   ============================================================ */
function fitSharePoster() {
  const box = $('#sharePosterScale');
  if (!box) return;
  const poster = box.querySelector('.rc-poster');
  if (!poster) return;
  const wrap = box.parentElement;
  if (!wrap) return;
  /* 海报区（.share-poster-wrap）是 flex 布局里 flex:1 的那格，
     它的 clientHeight 就是「扣掉标题栏 + 渠道区之后还剩多少地方」。
     —— 用它算缩放比，海报就正好一次露全，不多不少。 */
  const avail = wrap.clientHeight - 24;   /* 24 = wrap 的上下内边距 */
  /* 先量原始高度（缩放前） */
  poster.style.transform = 'none';
  const natural = poster.offsetHeight;
  if (!natural || avail < 120) return;
  const scale = Math.min(1, avail / natural);
  poster.style.transform = `scale(${scale})`;
  /* 缩放后盒子本身要按缩放比收窄，并把高度让给 wrap */
  box.style.width = Math.round(280 * scale) + 'px';
  box.style.flex = `0 0 ${Math.round(280 * scale)}px`;
  box.style.height = Math.ceil(natural * scale) + 'px';
}

/* 布局稳了之后再量一次 —— 弹层有进场动画，首次量到的可用高度偏大，
   会导致海报超出、被裁掉一截。 */
let shareFitRO = null;
function watchSharePoster() {
  const box = $('#sharePosterScale');
  if (!box || !window.ResizeObserver) return;
  if (shareFitRO) shareFitRO.disconnect();
  shareFitRO = new ResizeObserver(() => fitSharePoster());
  shareFitRO.observe(box.parentElement);
}

/* ============================================================
   见证席召集令 —— 报名情况半屏（见需求规格 R5.6）
   ⚠️ 2026-11-22 用户口径（改）：「用户点击『发布见证席召集令』，
      不用单独进入一个页面，按钮变成了『见证席召集令已发布』，
      然后点击『见证席召集令已发布』，有个从下往上的半框，能展示报名的情况就行。」
   —— 所以这个半屏是【召集令的状态面板】，不是独立页面。
   ============================================================ */

/** 召集令报名情况半屏
 *  ⚠️ 2026-11-24（本轮，用户口径）：
 *   ① 每一行除了「接受」还要有「拒绝」，**两个按钮大小一致**
 *   ② 点「接受」整行变成「已接受」状态；点「拒绝」变成「已拒绝」状态
 *      —— 按钮状态随操作切换（处理完就不该还能再点）
 *  ⚠️ 2026-11-24（本轮，第 2 处）：点头像 / 名字**直接跳该用户主页**，
 *     取消原来那个独立的小框式弹窗（openApplicantSheet）。
 *     —— 报名情况是一个半屏，跳到主页是**换页**；
 *        原来在同一个半屏里再叠一个小框，两层叠在一起看不清楚。
 *     —— 主页看完了点返回，要回到【报名情况】这个半屏 ——
 *        所以这里用「记下来源 + 重开半屏」的方式实现返回。 */
function openRecruitSheet() {
  const list = recruitApplicants();
  const appCount = list.filter(a => a.status !== 'declined').length;
  const acceptedCount = list.filter(a => a.status === 'accepted').length;
  openSheet('见证席召集令 · 报名情况', `
    <div class="field-hint" style="margin:0 0 12px">
      报名窗口还剩 <b>${recruitHoursLeft()} 小时</b> · 已报名 <b>${appCount}</b> 人 · 已接受 <b>${acceptedCount}</b> 位
    </div>
    ${list.length ? `
    <div class="list">
      ${list.map(a => `
      <div class="row">
        <span class="row-ava tap" data-go="userProfile" data-id="${a.name}" data-from="recruit">${ava(a.name, 'sm')}</span>
        <div class="row-main tap" data-go="userProfile" data-id="${a.name}" data-from="recruit">
          <div class="row-title">${a.name}</div>
          <div class="row-sub">信用 ${a.credit} · 成立率 ${a.rate}% · 见证 ${a.flagsWitnessed} 次</div>
        </div>
        ${a.status === 'accepted'
          ? '<span class="tag mint">已接受</span>'
          : a.status === 'declined'
            ? '<span class="tag outline">已拒绝</span>'
            : `<div class="row-acts">
                 <button class="btn sm ghost" data-act="declineApplicant" data-id="${a.id}">拒绝</button>
                 <button class="btn sm" data-act="acceptApplicant" data-id="${a.id}">接受</button>
               </div>`}
      </div>`).join('')}
    </div>
    <div class="field-hint mt">
      点头像（或名字）<b>进他的主页</b> —— 信用分、成立率、见证次数都在里面，<b>看完再决定接不接受</b>。
    </div>
    ` : `
    <div class="note sky">
      <b>还没有人报名。</b>召集令已发出去，报名窗口 ${recruitHoursLeft()} 小时 —— 有人报名会推给你。
    </div>
    `}
  `);
}

/* ⚠️ 2026-11-24（本轮）：报名者详情半屏（openApplicantSheet）与它的入口
   （viewApplicant 这个 action）**一起删掉** ——
   用户口径：「点击用户姓名或头像，直接跳转到该用户主页，取消当前独立小框式弹窗」。
   —— 原来的小框是在【半屏里再叠一个小框】，两层叠在一起看不清楚；
      现在直接跳主页（用户资料更全），返回键再回到报名情况半屏。 */

/* ---------------- 登录 ---------------- */
/** 完成登录：回到被拦截的动作，或进首页 */
function doLogin() {
  STATE.loggedIn = true;
  const back = pendingLoginRoute;
  pendingLoginRoute = null;
  closeSheet();
  toast('已登录');
  if (back) render(back.r, back.id);
  else render('home');
}

/** 半屏登录浮层 —— 游客点实质性动作时弹出，不打断浏览 */
function openLoginSheet() {
  openSheet('登录后继续', `
    <div class="login-sheet">
      ${loginTabs(STATE.loginTab)}
      ${loginCard()}
    </div>`);
  syncPrivacyButtons();
}

function closeSheet() {
  sheet.classList.remove('on');
  scrim.classList.remove('on');
}
scrim.addEventListener('click', closeSheet);
$('#sheetClose').addEventListener('click', closeSheet);

// 拖拽关闭
(function dragSheet() {
  let startY = 0, dy = 0, dragging = false, startT = 0;
  const handle = $('.sheet-handle');
  const targets = [handle, $('.sheet-head')];

  function down(e) {
    dragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startT = Date.now();
    dy = 0;
    sheet.classList.add('grabbing');
  }
  function move(e) {
    if (!dragging) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dy = Math.max(0, y - startY);
    sheet.style.transform = `translateY(${dy}px)`;
    if (e.cancelable) e.preventDefault();
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('grabbing');
    sheet.style.transform = '';
    if (dy > 90 || (dy > 45 && Date.now() - startT < 260)) closeSheet();
  }
  targets.forEach(t => {
    t.addEventListener('touchstart', down, {passive:true});
    t.addEventListener('mousedown', down);
  });
  sheet.addEventListener('touchmove', move, {passive:false});
  sheet.addEventListener('mousemove', move);
  window.addEventListener('touchend', up);
  window.addEventListener('mouseup', up);
})();

/* ============================================================
   左滑删除（⚠️ 2026-11-24 本轮新增，见需求规格 R2.30⑥）
   ------------------------------------------------------------
   「通知条目支持左滑删除。」

   —— 交互：
     ① 手指往左拖 → 内容跟着手指走，右边露出红色的删除按钮
     ② 松手：拖过一半 → 停在「删除」露出来的位置；没拖过 → 弹回去
     ③ 停在删除位置后，再往左拖 / 直接点删除按钮 → 删掉这条通知
     ④ 点别处 / 点其它行 → 已展开的那行收回去

   —— 为什么用【指针事件】（pointerdown/move/up）而不是 touch + mouse 两套：
     一套代码同时覆盖手机触摸和桌面鼠标（demo 在浏览器里跑，鼠标也要能试），
     而且 pointer 事件自带 pointerId，天然支持多指。

   —— 为什么 .swipe-content 上加 touch-action:pan-y：
     告诉浏览器「横向的手势归我处理，纵向的归你（页面滚动）」——
     不加的话，手机上竖着滑列表会被横向滑动的逻辑抢走。
   ============================================================ */
(function swipeDelete() {
  const DEL_W = 76;          /* 露出删除按钮的宽度 —— 必须跟 CSS 的 .swipe-del 宽度一致 */
  const THRESHOLD = 0.45;    /* 松手时超过一半就停在删除位 */

  let swipeEl = null;        /* 当前 .swipe 容器 */
  let contentEl = null;      /* 当前 .swipe-content */
  let startX = 0, startY = 0;
  let dx = 0;
  let active = false;
  let axisLocked = false;    /* 手势方向判定：true = 横向 */

  function closeOpen() {
    document.querySelectorAll('.swipe.open').forEach(el => el.classList.remove('open'));
  }

  function down(e) {
    const c = e.target.closest('.swipe-content');
    if (!c) { closeOpen(); return; }
    /* 已经在删除按钮上的那一行，不再重复接管 */
    swipeEl = c.parentElement;
    contentEl = c;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    axisLocked = false;
    active = true;
  }

  function move(e) {
    if (!active || !contentEl) return;
    const x = e.clientX, y = e.clientY;
    const mx = x - startX, my = y - startY;
    /* 方向判定：先横向超过 8px 才算横向手势 */
    if (!axisLocked) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      if (Math.abs(my) > Math.abs(mx)) { active = false; return; }  /* 纵向 → 不管 */
      axisLocked = true;
      /* 已经展开的那一行：从它当前的位置接着拖 */
      if (swipeEl.classList.contains('open')) {
        startX = x + DEL_W;
        dx = -DEL_W;
      }
      contentEl.classList.add('dragging');
    }
    /* 只允许往左滑出删除按钮，往右最多回到原位 */
    let next = dx + mx;
    if (next > 0) next = 0;
    if (next < -(DEL_W + 24)) next = -(DEL_W + 24);
    dx = next;
    contentEl.style.transform = `translateX(${dx}px)`;
    if (e.cancelable) e.preventDefault();
  }

  function up() {
    if (!active || !contentEl) return;
    active = false;
    contentEl.classList.remove('dragging');
    contentEl.style.transform = '';
    if (axisLocked && dx < -DEL_W * THRESHOLD) {
      swipeEl.classList.add('open');
    } else if (dx < 0) {
      swipeEl.classList.remove('open');
    }
    swipeEl = null; contentEl = null; axisLocked = false;
  }

  /* 用捕获阶段监听，保证在页面自己的 click 处理之前拿到手势 */
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointermove', move, { capture: true, passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  /* 点别处收起已展开的那一行 */
  document.addEventListener('click', (e) => {
    if (e.target.closest('.swipe-del')) return;   /* 点删除按钮不算 */
    if (e.target.closest('.swipe.open')) return;  /* 点还在这一行上也不收 */
    closeOpen();
  }, true);
})();

/* ---------------- 居中弹窗 ---------------- */
/**
 * 把弹窗挂到屏上并显示出来
 * ⚠️ rAF 在后台标签页里可能不触发 —— 所以加一个 setTimeout 兜底，
 *    不然弹窗会「生成了但看不见」（pointer-events 一直是 none）。
 */
function mountDialog(el) {
  /* ⚠️ 2026-11-24（本轮修复）：以前直接 append —— 如果上一个弹窗还在，
     新的会【叠在上面】，两层都是 .dialog.on，
     遮罩只会被最后一个收掉，结果关掉一层下面还盖着一层（点不掉、也关不干净）。
     —— 现在先把已有的弹窗全部收掉，保证同一时刻只有一个。 */
  $$('#screen .dialog').forEach(old => {
    old.classList.remove('on');
    old.remove();   /* 立刻移除 —— 留 260ms 会让旧节点还在 DOM 里，
                       document.querySelector('[data-dlg="yes"]') 可能点到旧的那个 */
  });
  lastDialog = el;
  $('#screen').appendChild(el);
  const show = () => el.classList.add('on');
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(show);
  setTimeout(show, 40);
  scrim.classList.add('on');
  return el;
}

/**
 * 居中确认弹窗
 * ⚠️ 2026-11-24（本轮）：新增第 5 个参数 evenBtns ——
 *   「取消」「确认支付」两个按钮**居中对齐、尺寸一致**。
 *   为什么要单独开这个开关：弹窗底部两个按钮一宽一窄（ghost 短、主按钮长）
 *   看着是「主次分明」，但在**支付确认**这种场合会读成
 *   「取消才是这个弹窗的主体」—— 所以那一处改成等宽居中。
 * @param {boolean} evenBtns  两个按钮等宽居中
 */
function dialog(title, body, okText = '确定', onOk, evenBtns = false) {
  const el = document.createElement('div');
  el.className = 'dialog';
  el.innerHTML = `
    <div class="dialog-title">${title}</div>
    <div class="dialog-body">${body}</div>
    <div class="dialog-actions ${evenBtns ? 'dlg-actions-even' : ''}">
      <button class="btn ghost sm" data-dlg="no">取消</button>
      <button class="btn sm" data-dlg="yes">${okText}</button>
    </div>`;
  mountDialog(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-dlg]');
    if (!b) return;
    el.classList.remove('on');
    scrim.classList.remove('on');
    setTimeout(() => el.remove(), 260);
    if (lastDialog === el) lastDialog = null;
    if (b.dataset.dlg === 'yes' && onOk) onOk();
  });
  return el;
}

/** 关掉当前打开的居中弹窗（供弹窗里的按钮调用） */
function closeDialog() {
  /* ⚠️ 用「最后一个 .dialog」而不是 `.dialog.on` ——
     有些环境（后台标签页）里 requestAnimationFrame 不触发，`.on` 可能没加上，
     那时 `.dialog.on` 会找不到东西。这里记下当前打开的那个最稳。 */
  const el = lastDialog || [...document.querySelectorAll('.dialog')].pop();
  if (!el) return;
  el.classList.remove('on');
  scrim.classList.remove('on');
  setTimeout(() => el.remove(), 260);
  lastDialog = null;
}

/** 当前打开的居中弹窗（用于 closeDialog 精确关闭） */
let lastDialog = null;

/* ============================================================
   「申请成为见证席」居中小框（见需求规格 R5.9.2.3）
   ⚠️ 2026-11-23 用户口径：「我的页面，『申请成为见证席』整个删掉了，
      用户第一次通过点击『见证席面板』就能申请了，这里不需要单独弄一个页面。
      当用户在见证席面板中，点击申请成为见证席，会在页面中间弹出一个小框，
      评估用户是否达到见证席的标准。即至少监督 1 个 Flag 三天 · 期间互动过一次，
      如果没达到，要提醒。」
   —— 所以这里是【当场评估】：够格就能申请，不够格就明确告诉用户还差什么。
   ============================================================ */
function openWitnessApplyDialog() {
  const ok = canApplyToPool();
  const el = document.createElement('div');
  el.className = 'dialog dlg-apply';
  el.innerHTML = `
    <div class="dialog-title">申请成为见证席</div>
    <div class="dialog-body" style="text-align:left">
      ${witnessApplyDialogHTML()}
    </div>
    <div class="dialog-actions dlg-actions-even">
      <button class="btn ghost sm" data-wapply="no">取消</button>
      <button class="btn sm" data-wapply="yes" ${ok?'':'disabled'}>${ok?'申请':'还差 ' + (witnessApplyNeed() - interactionCount()) + ' 次'}</button>
    </div>`;
  mountDialog(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-wapply]');
    if (!b) return;
    el.classList.remove('on');
    scrim.classList.remove('on');
    setTimeout(() => el.remove(), 260);
    if (lastDialog === el) lastDialog = null;
    if (b.dataset.wapply === 'yes' && ok) {
      applyToPool();
      toast('已进入见证席候选池');
      render(route, routeId, {push:false});
    }
  });
}

/* ============================================================
   「编辑资料」居中小框 —— ⚠️ 2026-11-24（本轮）**整个函数删掉**
   —— 用户口径（Part 二①）：「编辑页改为全屏：
      右上角修改资料按钮当前为半屏弹出，改为全屏页面打开。」
   —— 落法：改成 PAGES.editProfile 全屏页（见 pages.js），
      路由条目 editProfile + 动作 saveProfile（见上方 handleAct）。
   —— 可改的还是那几项：年龄 / 性别 / 省份 / 个性签名。
      【ID号】和【加入时间】不给改（禁用态就够了），
      而且**不再写「不可修改」的提示**（用户口径 Part 二②）。
   ============================================================ */
/* ============================================================
   更换头像的半屏（⚠️ 2026-11-24 本轮新增，见需求规格 R2.30⑦）
   ------------------------------------------------------------
   「『我的』页面头像不能变更；需支持点击头像，弹出更换头像照片的操作按钮 / 入口。」

   —— 为什么是【半屏】而不是【居中小弹窗】：
      挑照片需要看到**好几张候选**才能选 ——
      一个小弹窗塞不进 12 张图，半屏刚好能摆 4×3 的网格。
   —— demo 里没有真实的相册 / 相机通道 ——
      所以这里是【候选头像网格】（相当于从相册里挑一张）；
      真实环境：chooseMedia → 上传 → CDN 地址 → setMyAvatar(url)。
   —— 头部有【从相册选择】和【拍一张】两个主入口 ——
      那是真实环境的主路径，在 demo 里也摆着（点了给个提示），
      让用户看到「这个入口长什么样」。
   ============================================================ */
function openAvatarPickerSheet() {
  const cur = myAvatar();
  openSheet('更换头像', `
    <div class="ava-pick-actions">
      <button class="ava-pick-act" data-act="avatarFromAlbum">
        <span class="ava-pick-act-ico">${ic('image')}</span>
        <span>从相册选择</span>
      </button>
      <button class="ava-pick-act" data-act="avatarFromCamera">
        <span class="ava-pick-act-ico">${ic('camera')}</span>
        <span>拍一张</span>
      </button>
    </div>
    <div class="field-hint" style="margin:14px 0 10px">
      ${cur ? '当前头像已更换 —— 下面选一张新的，或恢复默认。' : '从下面选一张作为你的头像。'}
    </div>
    <div class="ava-pick-grid">
      ${AVATAR_OPTIONS.map(src => `
        <button class="ava-pick-cell ${cur === src ? 'on' : ''}" data-act="pickAvatar" data-src="${src}">
          <img src="${src}" alt="头像候选" loading="lazy">
        </button>`).join('')}
    </div>
    ${cur ? `
    <button class="btn ghost block mt" data-act="resetAvatar">恢复默认头像</button>` : ''}
  `);
}

/* ============================================================
   候选池候选人详情半屏（openPoolCandidateSheet）
   ⚠️ 2026-11-24（本轮，用户口径 Part 三①）：**整个函数删掉** ——
   —— 用户口径：「在首页筹备阶段，可从见证席候选池中挑选用户；
      点击用户头像或名字，进入该用户主页。」
   —— 原来点头像弹的是这个半屏 —— 它只重复了列表里已有的
      信用分 / 成立率 / 见证次数，而用户主页上有**完整的长期档案**
      （信用等级、见证情况、Ta 的 Flag）。
   —— 挑人是件大事，值得跳一个完整的页面去看；
      而且【半屏里再叠东西】是全站最该避免的层级错误。
   —— 入口也一并改成 `data-go="userProfile" + data-from="pool"`，
      返回键会回到候选池页面继续挑（见 goBack 里的 pendingSheetBack === 'pool'）。
   ============================================================ */

/* =========================================================
   判定三选一小框（见需求规格 R5.2）
   ⚠️ 用户口径（2026-11-21）：「见证席点击进入判定详情以后，当点击『去判定』，
      应该弹出小框，给出三个选项：
        通过（物证合规、进度真实）
        存疑（我看不懂 / 不确定 —— 直接转人工复核）
        作弊（我确认他在糊弄 —— 这就是一次实名举报，直接转人工复核）
      选择其中一个，然后可以提交判定。」
   —— 判定详情页原本只有一个「去判定」按钮跳去面板；现在这一步要先表态。
   ========================================================= */
const VERDICT_OPTS = [
  { key:'pass',  ico:'checkCircle', title:'通过', desc:'物证合规、进度真实' },
  { key:'doubt', ico:'helpCircle',  title:'存疑', desc:'我看不懂 / 不确定 —— 直接转人工复核' },
  { key:'cheat', ico:'close',       title:'作弊', desc:'我确认他在糊弄 —— 这就是一次实名举报，直接转人工复核' },
];

/**
 * 判定三选一小框
 * @param {function(string)} onPick 选中后回调（pass / doubt / cheat）
 */
function openVerdictPicker(onPick){
  const el = document.createElement('div');
  el.className = 'dialog dlg-pick';
  el.innerHTML = `
    <div class="dialog-title">你的判定</div>
    <div class="dialog-body" style="text-align:left">
      <div class="verdict-list">
        ${VERDICT_OPTS.map(o => `
        <div class="verdict-opt ${o.key}" data-vpick="${o.key}">
          <div class="verdict-ico">${ic(o.ico)}</div>
          <div><div class="verdict-t">${o.title}</div><div class="verdict-d">${o.desc}</div></div>
        </div>`).join('')}
      </div>
    </div>
    <div class="dialog-actions">
      <button class="btn ghost sm" data-vpick="cancel">取消</button>
      <button class="btn sm" data-vpick="ok" disabled>提交判定</button>
    </div>`;
  mountDialog(el);
  let picked = null;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-vpick]');
    if (!b) return;
    const v = b.dataset.vpick;
    if (v === 'cancel') {
      el.classList.remove('on'); scrim.classList.remove('on');
      setTimeout(() => el.remove(), 260);
      return;
    }
    if (v === 'ok') {
      if (!picked) return toast('先选一个判定');
      el.classList.remove('on'); scrim.classList.remove('on');
      setTimeout(() => el.remove(), 260);
      onPick && onPick(picked);
      return;
    }
    picked = v;
    el.querySelectorAll('.verdict-opt').forEach(o => o.classList.toggle('on', o.dataset.vpick === v));
    const ok = el.querySelector('[data-vpick="ok"]');
    ok.disabled = false;
    ok.classList.remove('disabled');
  });
  return el;
}

/**
 * 判定提交后的「分值待结算」说明块
 * ⚠️ 2026-11-25（本轮）：从原来那段死代码（绑定在 #submitVerdict 上的）
 *    原样搬过来 —— UI 不变，位置不变（判定详情页底部按钮下方）。
 *    原来它挂在 `b.parentNode.insertBefore(...)`，b 是 #submitVerdict，
 *    那个元素不存在，所以这段说明也从来没显示过。
 *    —— 现在插到【判定详情页的 sticky-cta 按钮】后面。
 */
function showVerdictPendingNote(kind) {
  const gain = kind === 'pass' ? '+2' : kind === 'cheat' ? '+3（坐实才给）' : '0';
  const box = document.createElement('div');
  box.className = 'verdict-pending-note';
  box.style.cssText = 'margin-top:12px;padding:12px 14px;border-radius:var(--r-md);background:var(--brand-tint);border:1px solid rgba(255,107,0,.22)';
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:680;color:var(--brand)">
      ${IC.clock || ''}<span>分值待结算</span>
    </div>
    <div style="font-size:12.5px;color:var(--ink-2);line-height:1.75;margin-top:6px">
      <b>提交判定 ≠ 立刻加分。</b>事实结论出来后一次性结算：<br>
      · AI 筛查通过 → <b>1 小时内</b>到账<br>
      · 需要人工复核 → <b>24 小时内</b>出结论，再开 <b>24 小时异议窗口</b>，无人提异议即结算<br>
      · 兜底 → 提交满 7 天事实仍未定，按「通过」+2 结算<br>
      <b>+2 和 -5 是同一笔账的两个可能结果</b> —— 事实坐实造假时，你判「通过」会扣 -5。<br>
      本次判定预计：<b>${gain}</b> · 本周见证加分 <b>${STATE.witnessWeekCredit || 0} / ${CREDIT_WITNESS.weeklyCap}</b>
    </div>
    <button class="btn ghost block sm" style="margin-top:10px" data-go="witnessEarnings">查看见证席收益</button>`;
  /* 插到 sticky-cta 之前（它在 CTA 后面的话会被底部条压住） */
  const cta = document.querySelector('.sticky-cta');
  if (cta && cta.parentNode) cta.parentNode.insertBefore(box, cta);
  else {
    const sc = document.querySelector('.screen-scroll .page');
    if (sc) sc.appendChild(box);
  }
  return box;
}

/* ============================================================
   留言半屏（广场卡片）
   ⚠️ 2026-11-23 用户口径：「当用户点击『留言』，从下往上出现半个留言框。」
      「无论是点赞、留言都没有多余的解释文案。」
   —— 所以：从底部升起的半屏里【没有一个字的说明】。

   ⚠️ 2026-11-24 用户口径：点赞的【短语选择弹窗】已删除 ——
      「点赞删除掉短语选择，就改成一个普通的点击按钮，点了变色，
       带一点小小的特效就行。」
   —— 所以 `openLikePicker()` / `LIKE_PHRASES` 整块删掉，
      点赞走 `data-act="doFeedLike"` → `doLike(fid, '')`（见 action 分发）。
   ============================================================ */

/**
 * 留言半屏
 * ⚠️ 2026-11-23 用户口径（口径反转）：
 *   「整个产品原来设计上留言是看不到的，现在改为公开可见。
 *    ① 在这个弹出的框的最上面，展示用户今天拍的照片，用户的心情留言，时间。
 *    ② 然后是其他围观者的留言，展示包括其他围观者头像、名称、日期、留言，
 *       以及可以为这个围观者的发言的独立点赞按钮（其他围观可以点一次，统计次数）。
 *    ③ 最下面就是可以留言的输入框。
 *    ④ 所有的留言按时间倒序，新的排最高。」
 *
 * —— 三段式：
 *      ① 目标人今天（照片 + 心情 + 时间）—— 这是【这一局的最新状态】
 *      ② 围观者的留言（头像 / 名称 / 日期 / 正文 / 独立点赞）
 *      ③ 输入框（最下面，贴着屏幕底部 —— 用户是来打字的）
 * —— 排序：**时间倒序，新的排最高**（ts 大的在前）。
 */
function openMsgSheet(flagId) {
  const f = findFlag(flagId);
  if (!f) return toast('找不到这个 Flag');
  const day = latestDayOf(f);
  const note = noteOf(f, day);
  const shots = todayPhotosRow(f);
  const msgs = publicMsgsOf(f);

  openSheet('', `
    <!-- ① 目标人今天：照片 + 心情 + 时间 -->
    <div class="msg-sheet-top">
      <div class="ms-head">
        ${ava(f.user.name, 'sm')}
        <div style="flex:1;min-width:0">
          <div class="ms-name">${f.user.name}</div>
          <div class="ms-time">第 ${day} 天 · ${msgDateOf({ ts: 100 })}</div>
        </div>
      </div>
      ${shots.length ? `
      <div class="today-row">
        ${shots.slice(0, 4).map((x, i) => `
          <div class="tr-cell" data-act="openPhoto" data-id="${f.id}"
               data-kind="${x.kind}" data-src="${x.src}" data-idx="${i}">
            <img src="${x.src}" alt="今天拍的照片 ${i+1}" loading="lazy">
          </div>`).join('')}
      </div>` : ''}
      ${note ? `
      <div class="ms-note">${note}</div>` : ''}
    </div>

    <!-- ② 围观者的留言（时间倒序） -->
    <div class="ms-list">
      ${msgs.length ? msgs.map(m => `
      <div class="ms-item" data-mid="${m.id}">
        ${ava(m.name, 'xs')}
        <div class="ms-body">
          <div class="ms-meta">
            <span class="ms-who">${m.name}</span>
            <span class="ms-when">${msgDateOf(m)}</span>
          </div>
          <div class="ms-text">${m.text}</div>
        </div>
        <button class="ms-like ${m.liked ? 'on' : ''}" data-act="likeMsg" data-id="${f.id}" data-mid="${m.id}">
          ${ic('thumbsUp')}<span>${m.likes || 0}</span>
        </button>
      </div>`).join('') : `
      <div class="ms-empty">还没有留言</div>`}
    </div>

    <!-- ③ 输入框（最下面） -->
    <div class="ms-input">
      <input class="input" id="feedMsgInput" maxlength="60" placeholder="说点什么…" style="flex:1;min-width:0">
      <button class="btn sm" id="feedMsgSend" disabled>发送</button>
    </div>
  `);
  /* 半屏不要标题（没有多余文案） */
  const t = $('#sheetTitle');
  if (t) t.textContent = '';
  /* ⚠️ 留言半屏用自己的一套排版（.msg-sheet）—— 高度、留白跟别的弹层不一样 */
  const sh = $('#sheet');
  if (sh) sh.classList.add('msg-sheet');
  const inp = $('#feedMsgInput');
  const btn = $('#feedMsgSend');
  if (!inp || !btn) return;
  inp.addEventListener('input', () => { btn.disabled = inp.value.trim().length === 0; });
  btn.addEventListener('click', () => {
    const text = inp.value.trim();
    if (!text) return;
    /* ⚠️ 留言【公开可见】—— 所有人能看到（见需求规格 3.5.2） */
    addPublicMsg(f.id, text, { name: ME.name });
    closeSheet();
    toast('留言已发送');
    if (typeof render === 'function') render(route, routeId, { push: false });
  });
  /* 打开就聚焦 —— 用户是来打字的 */
  setTimeout(() => { try { inp.focus(); } catch (_) {} }, 380);
}

/* ---------------- 返回 ---------------- */
function goBack() {
  /* ⚠️ 2026-11-24（本轮）：从某个半屏跳去别的页面时，返回键要回到那个半屏。
     —— 三个场景：
        ① 从【召集令报名情况】跳去看用户主页 → 回报名情况
        ② 从【见证席名单】跳去看用户主页 → 回见证席名单
        ③ 从【候选池】跳去看用户主页 → 回候选池 */
  if (pendingSheetBack === 'recruit') {
    pendingSheetBack = null;
    openRecruitSheet();
    return;
  }
  if (pendingSheetBack === 'witness') {
    pendingSheetBack = null;
    openWitnessListSheet(pendingSheetFlagId);
    return;
  }
  /* ⚠️ 2026-11-24（本轮，用户口径 Part 三②）：从候选池跳去看用户主页后，
     返回键要回到【候选池】页面，继续挑人 —— 而不是回到上一个页面。
     —— 候选池是**选人的工作台**：用户跳主页是去看「这个人靠不靠谱」，
        看完必须能回到那列人继续挑下一个。 */
  if (pendingSheetBack === 'pool') {
    pendingSheetBack = null;
    render('witnessPool', null, { push: false });
    return;
  }
  /* ⚠️ 2026-11-24（本轮，用户口径 Part 二②）：从【补卡模式】返回 ——
     —— 补卡页是从首页的补卡提醒卡进来的，返回应该回**首页**，
        而且必须**退出补卡模式** ——
        否则用户回到首页后再点「去打卡」，看到的还是补卡页。
     —— 做法：清模式 + 回首页（不走通用栈 —— 栈里那条是「首页」，
        但那时首页的补卡提醒卡还在，正好回来继续用）。 */
  if (isMakeupMode() && route === 'checkin') {
    exitMakeupMode();
    clearCheckinDraft(routeId);
    render('home', null, { push: false });
    return;
  }
  const r = ROUTES[route];
  if (r && r.tab) {
    const s = tabStack[r.tab];
    if (s.length) {
      const p = s.pop();
      render(p.r, p.id, {push:false, day: p.day});
      return;
    }
  }
  if (stack.length) {
    const p = stack.pop();
    render(p.r, p.id, {push:false, day: p.day});
    return;
  }
  render('home', null, {push:false});
}

/* ---------------- 大标题折叠 ---------------- */
function bindScroll() {
  const sc = $('.screen-scroll');
  if (!sc) return;
  const nav = $('.nav');
  if (!nav) return;
  const onScroll = () => {
    const h = sc.scrollTop;
    nav.classList.toggle('scrolled', h > 34);
  };
  sc.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
}

/* ---------------- 补卡（见需求规格 9.5 / ⚠️ 2026-11-24 改） ----------------
   ⚠️ 用户口径：「给用户一个按钮，点击补卡，并且做 12 小时倒计时。」
   —— 所以补卡按钮现在要【校验 12 小时窗口】：
        窗口开着 → 补成功
        窗口关了 → 明确告诉用户「12 小时已过，这次算断卡了」

   ⚠️ 2026-11-24（本轮，用户口径 Part 二②）：**补卡复用今日打卡页** ——
   —— 用户口径：「补卡功能保留；点击补卡进入的页面内容与今日打卡完全一致，
      区别仅在于打卡对象是昨天的卡。」
   —— 所以「点补卡」不再直接补完，而是：
        ① 进【补卡模式】的今日打卡页（enterMakeupMode）
        ② 用户照常拍照 / 写心情 / 传生活照
        ③ 点「补上这张卡」才真正写入（走 doMakeupCheckin）
   —— 为什么不再「一键补完」：
        补卡是要**补一张物证**的 —— 那天真的称了、真的拍了。
        一键补完等于凭空造一张打卡照，那跟「补卡」这回事的意思完全相反。 */
/** 进入补卡模式（首页的补卡提醒卡 / 补卡按钮点它） */
function enterMakeup(flagId) {
  const f = findFlag(flagId);
  if (!f) return toast('找不到这个 Flag');
  const mw = makeupWindow(f);
  if (mw.state === 'none') return toast('没有需要补的卡');
  if (mw.state === 'expired') return toast('12 小时已过，这次算断卡了');
  enterMakeupMode(f.id);
  render('checkin', f.id);
}

/** 提交补卡（补卡模式下的「补上这张卡」按钮）
 *  ⚠️ 2026-11-25（本轮修复）：**必须用【正在补的那一局】的 id**，
 *     不能用 myMainFlag()。
 *     原来这里 `const f = myMainFlag()` —— myMainFlag() 取的是
 *     「我第一个进行中的 Flag」。当存在多局 / 那一局不是第一个时：
 *       · 补卡写到了**别的局**上（数据串局，性质最严重）；
 *       · 打卡照 / 生活照 / 心情也 commit 到了别的局（commitXxx 里
 *         是 `FLAGS[flagId] || myMainFlag()`，flagId 传错就落到主局）。
 *     —— 补卡的目标在进入补卡模式时就确定了（enterMakeupMode(flagId)
 *        记在 STATE.checkinDraft.flagId 里），提交时照它取。
 */
function submitMakeupCheckin() {
  /* ① 优先：补卡模式里记下的那一局 */
  const draftId = (STATE.checkinDraft && STATE.checkinDraft.flagId) || null;
  const f = (draftId && findFlag(draftId)) || myMainFlag();
  if (!f) { toast('你还没有进行中的 Flag'); render('myFlags'); return; }
  if (!hasCheckinShot()) { toast('先拍一张打卡照'); render(route, routeId, {push:false}); return; }
  const day = checkinTargetDay(f);
  const w = f.curWeight ? (f.curWeight - 0.1).toFixed(1) : 0;
  const r = doMakeup(f.id, w, day);
  /* ⚠️ 2026-11-25：doMakeup 现在可能返回 {ok:false, reason}（超窗拒绝），
     这时不能继续提交照片 / 心情 —— 否则会出现「补卡被拒但照片写进去了」。 */
  if (!r || r.ok === false) {
    toast((r && r.reason) || '补卡失败');
    render(route, routeId, { push: false });
    return;
  }
  /* 补卡也要落物证 / 生活照 / 心情 —— 跟打卡一样（见 R2.30②） */
  commitCheckinShot(f.id, day);
  commitExtraPhotos(f.id, day);
  commitCheckinNote(f.id, day);
  clearCheckinDraft(f.id);
  exitMakeupMode();
  toast('补上了 —— 标「补」，不算断卡，但连续天数不增加');
  render('home', null, { push: false });
}

/* ---------------- 目标人回声弹层（见需求规格 3.5.1） ---------------- */
function openReplySheet(msgIdx) {
  const f = findFlag(routeId);
  if (!f) return toast('找不到这个 Flag');
  const m = f.msgs && f.msgs[Number(msgIdx)];
  if (!m) return toast('找不到这条留言');
  if (m.reply) return toast('这条已经回过了 —— 一条留言只能回一次');

  openSheet('回一句', `
    <div class="note sky" style="margin-bottom:14px">
      <b>你的回声所有人可见</b> —— 围观者会看到「${ME.name} 回了一句……」。<br>
      但<b>留言内容仍然只有你看得到</b>，而且<b>没人能回复你的回声</b>。
    </div>
    <div style="background:var(--bg-2);border-radius:var(--r-sm);padding:12px 13px;margin-bottom:12px">
      <div style="font-size:12px;color:var(--ink-3);margin-bottom:5px">对方留言（仅你可见）</div>
      <div style="font-size:13.5px;color:var(--ink-2);line-height:1.6">${m.text}</div>
    </div>
    <textarea class="textarea" id="replyText" placeholder="说点什么回应 TA…" style="min-height:84px" maxlength="30"></textarea>
    <div class="bar-row" style="margin:8px 0 0">
      <span>≤30 字</span><span id="replyCount">0 / 30</span>
    </div>
    <button class="btn block mt" id="sendReply" disabled>发送回声</button>
  `);

  const ta = $('#replyText');
  const btn = $('#sendReply');
  const cnt = $('#replyCount');
  ta.addEventListener('input', () => {
    cnt.textContent = ta.value.length + ' / 30';
    btn.disabled = ta.value.trim().length === 0;
  });
  btn.addEventListener('click', () => {
    const r = replyToMsg(f.id, Number(msgIdx), ta.value);
    if (!r) return toast('发送失败');
    closeSheet();
    toast('回声已发出 —— 所有人都看到了');
    render(route, routeId, {push:false});
  });
}

/* ---------------- 全局事件委托 ---------------- */
document.addEventListener('click', e => {
  // 说明点
  const infoEl = e.target.closest('[data-info]');
  if (infoEl) { e.stopPropagation(); openInfo(infoEl.dataset.info); return; }

  // 目标人回声（见需求规格 3.5.1）—— 只有目标人点得到
  const replyEl = e.target.closest('[data-reply]');
  if (replyEl) { e.preventDefault(); openReplySheet(replyEl.dataset.reply); return; }

  // 补卡（见需求规格 9.5）
  // ⚠️ 2026-11-24：补卡按钮现在在【首页】的补卡提醒卡里（data-makeup-btn），
  //   整张卡也可点（data-makeup）。两个都要拦住，别让外层「去打卡」抢走点击。
  // ⚠️ 2026-11-24（本轮，用户口径 Part 二②）：点补卡不再「一键补完」，
  //   而是【进补卡模式的今日打卡页】—— 内容一样，只是打的是昨天那张。
  const mkBtnEl = e.target.closest('[data-makeup-btn]');
  if (mkBtnEl) { e.preventDefault(); e.stopPropagation(); enterMakeup(mkBtnEl.dataset.makeupBtn); return; }
  const mkEl = e.target.closest('[data-makeup]');
  if (mkEl) { e.preventDefault(); e.stopPropagation(); enterMakeup(mkEl.dataset.makeup); return; }

  // 登录方式切换（微信 / 手机号）—— 一次只显示一种方式
  // stopImmediatePropagation：阻止后面那个通用 `.seg` 处理器再 toggle 一次视觉态
  const ltEl = e.target.closest('[data-login-tab]');
  if (ltEl) {
    e.preventDefault();
    e.stopImmediatePropagation();
    /* 刚拖拽完的这次 click 不算点击 —— 已经在拖拽结束时切好了 */
    if (segSuppressClick) return;
    /* 浮层里的 tab 与登录页的 tab 是两套 DOM，scope 要分开 */
    switchLoginTab(ltEl.dataset.loginTab, ltEl.closest('#sheetBody') ? 'sheet' : 'login');
    return;
  }

  // 勾选框 —— 两种：
  //   data-check="privacy"       登录协议（单一真相源在 STATE.privacyAgreed）
  //   data-check="createXxx"     分步引导的步骤确认（写进 STATE.createDraft）
  // 用 stopImmediatePropagation 阻止后面那个通用 `.check` 监听器再 toggle 一次
  const chkEl = e.target.closest('[data-check]');
  if (chkEl) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const key = chkEl.dataset.check;
    if (key === 'privacy') {
      STATE.privacyAgreed = !STATE.privacyAgreed;
      syncPrivacyButtons();
      return;
    }
    /* 分步引导的勾选：写入草稿 → 切视觉态 → 联动底部按钮的 disabled
       ⚠️ 2026-11-24（本轮）：打钩框从原第 4 步「交押金」挪到第 3 步「确认并支付」——
          字段名从 createPay 改成 createDeposit。 */
    const d = STATE.createDraft;
    const field = { createDeposit:'agreedPay' }[key];
    if (!field) return;
    d[field] = !d[field];
    chkEl.classList.toggle('on', d[field]);
    const btn = document.querySelector('.wiz-cta .btn');
    if (btn) btn.classList.toggle('disabled', !d[field]);
    return;
  }

  // 动作（真实改变状态）
  const actEl = e.target.closest('[data-act]');
  if (actEl) { e.preventDefault(); handleAct(actEl.dataset.act, actEl); return; }

  /* ⚠️ 2026-11-24（本轮）：点通知本身 = 标记这一条已读 ——
     —— 之前只有「全部已读」能清未读状态，点单条没反应。
     —— 通知行的点击要在【跳转之前】处理：如果这一行带了跳转目标
        （data-go），点它既标记已读又跳过去；没有跳转目标的
        （比如「欢迎来到亏了」这种）点它就只是标记已读 + 重画（去掉蓝底和红点）。 */
  const notifEl = e.target.closest('[data-notif-key]');
  if (notifEl) {
    const key = notifEl.dataset.notifKey;
    const goTarget = notifEl.dataset.go || '';
    const goId = notifEl.dataset.id || null;
    const wasUnread = unreadNotifCount() > 0;
    markNotifRead(key);
    if (goTarget) {
      render(goTarget, goId);
    } else {
      render(route, routeId, { push: false });
    }
    return;
  }

  /* ⚠️ 2026-11-24（本轮）：data-no-nav —— 「只作展示、不可点击」的块。
     —— 需求：筹备中页面的**灰色倒计时卡片**改为仅作展示，不可点击
        （原来它跟着整张可点的卡一起点进立据页）。
     —— 为什么用 JS 拦而不是 pointer-events:none：
        pointer-events:none 会让点击**穿透**到外层带 data-go 的元素，
        结果还是被带进立据页 —— 必须在事件层面直接把这次点击丢掉。
     —— 放在所有跳转/动作处理之前，保证它什么都触发不了。 */
  if (e.target.closest('[data-no-nav]')) { e.preventDefault(); return; }

  // 跳转
  const goEl = e.target.closest('[data-go]');
  if (goEl) {
    e.preventDefault();
    const target = goEl.dataset.go;    const id = goEl.dataset.id || null;
    /* data-day —— 打卡照片按天定位（见需求规格 R2.5） */
    const day = goEl.dataset.day || null;
    /* ⚠️ 2026-11-24（本轮）：data-from —— 从某个半屏跳去看用户主页，
       返回键要回到【那个半屏】，而不是回到上一个页面。
       —— 三个场景：
          ① data-from="recruit"  →【召集令报名情况】
          ② data-from="witness"  →【见证席名单】（返回时要记得是哪个 Flag）
          ③ data-from="pool"     →【见证席候选池】（从候选池点头像进主页）
       —— ⚠️ 跳页之前【先把半屏关掉】——
          用户口径：「在见证席召集令半框中点击用户头像进入其用户主页时，
            当前半框不会消失，属异常；进入主页后该半框应关闭。」
          不关掉的话，主页上会压着一个旧半屏 —— 层级错了，而且半屏还挡着主页。 */
    if (goEl.dataset.from === 'recruit') {
      pendingSheetBack = 'recruit';
    }
    if (goEl.dataset.from === 'witness') {
      pendingSheetBack = 'witness';
      pendingSheetFlagId = goEl.dataset.flagId || routeId;
    }
    if (goEl.dataset.from === 'pool') {
      pendingSheetBack = 'pool';
    }
    /* 从半屏跳走 → 半屏必须先关掉 */
    if (goEl.dataset.from) closeSheet();
    /* 未登录且跳向需登录的页面 —— 弹登录浮层，记住来源 */
    if (!isLoggedIn() && needLoginPage(target)) {
      pendingLoginRoute = { r: target, id };
      openLoginSheet();
      return;
    }
    if (target === 'flagDetail' && !id) render('flagDetail', 'f_own');
    else {
      /* ⚠️ 同一时间只能有一个进行中的 Flag（见需求规格 R1.6）——
         已有进行中的 Flag 时，不让进发起页。 */
      if ((target === 'create' || target === 'createGoal') && !canCreateFlag().ok) {
        const cur = canCreateFlag().current;
        dialog(
          '你已经有一个进行中的 Flag 了',
          `「${cur.title}」还在进行中。<br><br>` +
          `同一时间只能立<b>一个</b> Flag —— 想开新的，先把原来这个取消掉。`,
          '去看看',
          () => render('flagDetail', cur.id, { push: false })
        );
        return;
      }
      /* 进入分步引导第 1 步时重置草稿与周期/押金选择 ——
         否则会带着单页里的旧值进来（比如默认 30 天但新用户只能立 7/14 天） */
      if (target === 'createGoal') resetCreateDraft();
      /* 进入打卡页时重置「补充照片」草稿（见需求规格 R2.6）
         ⚠️ 上传动作独立于打卡按钮，但【重新进页面】= 新的一次上传，
            不重置会把上一轮待传的照片带过来。
         ⚠️ 2026-11-24（本轮，用户口径 Part 二②）：正常点「去打卡」进来时，
            要**退出补卡模式** —— 否则用户从首页点「去打卡」，看到的却是补卡页。
            补卡模式只能由【补卡入口】显式进入（enterMakeup）。 */
      if (target === 'checkin') {
        if (!isMakeupMode()) resetCheckinDraft(id);
      }
      render(target, id, { day });
    }
    return;
  }

  // Toast
  const t = e.target.closest('[data-toast]');
  if (t) { toast(t.dataset.toast); return; }

  // 返回
  if (e.target.closest('[data-back]')) { goBack(); return; }

  // Tab
  const tabEl = e.target.closest('[data-tab]');
  if (tabEl) {
    const key = tabEl.dataset.tab;
    const r = ROUTES[key === 'me' ? 'profile' : key];
    if (!r) return;
    if (route !== r.r) render(r.r, null, {push:false});
    else {
      const s = tabStack[key];
      if (s && s.length) { const p = s.pop(); render(p.r, p.id, {push:false}); }
    }
    return;
  }
  // 开关
  const sw = e.target.closest('.switch');
  if (sw) { sw.classList.toggle('on'); return; }

  // 单选组
  const seg = e.target.closest('.seg button');
  if (seg) { $$('button', seg.parentElement).forEach(b => b.classList.remove('on')); seg.classList.add('on'); return; }

  const opt = e.target.closest('.opt-card');
  if (opt && opt.parentElement.classList.contains('opt-grid')) {
    // 不可选的周期 —— 原因写在卡片上（信用分不够，见需求规格 R10.2）
    if (opt.dataset.locked) { toast('信用分不够，还不能立这个周期'); return; }
    $$('.opt-card', opt.parentElement).forEach(o => o.classList.remove('on'));
    opt.classList.add('on');
    // 周期切换 → 重算押金可选区间（见需求规格 R10.2）
    if (opt.dataset.period) {
      STATE.periodSel = Number(opt.dataset.period);
      const dr = depositRange(STATE.credit, STATE.periodSel, isFirstFlag());
      /* ⚠️ 0 元档只在【首次免费】时出现 —— 周期切换后要保持当前档位仍可选 */
      const opts = dr.options || [];
      STATE.depSel = opts.indexOf(STATE.depSel) >= 0 ? STATE.depSel : (opts.length ? opts[opts.length-1] : 0);
      render(route, routeId, {push:false});
    }
    return;
  }

  // 判定选项
  const vo = e.target.closest('.verdict-opt');
  if (vo) {
    $$('.verdict-opt').forEach(v => v.classList.remove('on'));
    vo.classList.add('on');
    return;
  }

  // 短语
  const chip = e.target.closest('.chip');
  if (chip) {
    /* ⚠️ 2026-11-24（本轮）：筛选抽屉里的 chip 带着 data-fkey / data-fval ——
       它们是真筛选（会改 STATE.sqFilter 并重画广场），
       不能被下面这段「只切高亮、不做别的」的通用 chip 逻辑吃掉。 */
    if (chip.dataset.fkey) {
      setSquareFilter(chip.dataset.fkey, chip.dataset.fval);
      $$('.chip', chip.parentElement).forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      /* 重画抽屉 —— 让「查看 N 个 Flag」实时更新 */
      const sheetBody = document.querySelector('#sheetBody');
      if (sheetBody) sheetBody.innerHTML = filterPanel();
      return;
    }
    $$('.chip', chip.parentElement).forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    return;
  }

  // 押金档位
  const dp = e.target.closest('.dep-pick');
  if (dp) {
    // 锁定档位（超出信用上限）：不可点，只提示
    if (dp.dataset.depLock) { toast('信用分不够，升级信用才能选这个档位'); return; }
    $$('.dep-pick').forEach(d => d.classList.remove('on')); dp.classList.add('on');
    if (dp.dataset.dep) {
      STATE.depSel = Number(dp.dataset.dep);
      render(route, routeId, {push:false});
    }
    return;
  }

  // 复选
  const chk = e.target.closest('.check');
  if (chk) { chk.classList.toggle('on'); return; }

  // 折叠区
  const fb = e.target.closest('.fold-btn');
  if (fb) { fb.closest('.fold').classList.toggle('open'); return; }
});

/* ---------------- 说明弹层 ---------------- */
const INFO_TITLE = {
  product:'这是什么产品', deposit:'押金', depositFormula:'押金上限怎么算',
  creditScore:'信用分', tierStrength:'见证席强度分级', newUser:'第一个 Flag 免费',
  lossCalc:'失败实际损失', witnessSystem:'双席结构',
  witnessBenefit:'见证席的三项收益',
  witnessCalib:'判定质量校准',
  asyncSettle:'异步结算',
  witnessApply:'怎么成为见证席',
  antiCheat:'防作弊规则', messageBoard:'受控留言板',
  recordCard:'记录卡规则', failCard:'失败记录卡',
  safeStop:'健康安全门槛', compliance:'押金与收益规则',
  credible:'「立据」是什么', spread:'分享路径分级',
  recruit:'见证席召集令',
  supervisorCard:'围观者也有记录卡',
  rulesLock:'规则锁死',
  stateMachine:'目标状态机', breakRules:'断卡规则', privacy:'隐私与安全',
  photoPrivacy:'打卡照片公开',
  agreement:'用户协议',
  prepPeriod:'筹备期', effectiveTier:'有效档位',
  /* ⚠️ 2026-11-23 用户口径：「把见证席面板中的判定怎么算、见证门槛、物证怎么判删了。」
     —— 见证席面板底部那三个「?」删掉后，这三个说明弹层（verdict / witnessQuorum / evidence）
        就没有入口了 —— 它们的内容已经并进 witnessApply（右上角那个「?」）。 */
  witnessPool:'见证席候选池',
  /* 立 Flag 分步引导 */
  createPeriod:'信用分与周期', createDeposit:'押金区间怎么算',
};

function openInfo(key) {
  const html = INFO[key];
  if (!html) return toast('暂无说明');
  openSheet(INFO_TITLE[key] || '说明', wrapTables(html));
  bindSheetInner();
}
function bindSheetInner() {
  $$('#sheetBody [data-info]').forEach(el => {
    if (el.__bound) return;
    el.__bound = true;
    el.addEventListener('click', ev => {
      ev.stopPropagation();
      const k = el.dataset.info;
      if (INFO[k]) {
        sheetTitle.innerHTML = INFO_TITLE[k] || '说明';
        sheetBody.innerHTML = wrapTables(INFO[k]);
        sheetBody.scrollTop = 0;
        bindSheetInner();
      }
    });
  });
}
/* 宽表格横向可滚动，避免列被挤扁 */
function wrapTables(html) {
  return html.replace(/<table[\s\S]*?<\/table>/g,
    m => `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:10px -20px;padding:0 20px">${m}</div>`);
}

/* ---------------- 页面内局部绑定 ---------------- */
function localBind(r) {
  /* 心情 / 体悟输入（见需求规格 R2.11）—— 实时写草稿 + 更新字数 */
  if (r === 'checkin') {
    const ta = $('#checkinNote');
    const cnt = $('#noteCount');
    if (ta) {
      ta.addEventListener('input', () => {
        /* ⚠️ 15 字硬上限 —— maxlength 之外的兜底（粘贴等场景） */
        const v = ta.value.slice(0, CHECKIN_NOTE_MAX);
        if (v !== ta.value) ta.value = v;
        setCheckinNote(v);
        if (cnt) cnt.textContent = String(v.length);
      });
    }
  }

  if (r === 'verdict') {
    /* ⚠️ 2026-11-25（本轮修复）：这一整块【删掉了】——
       原因：#submitVerdict 这个 DOM 元素在页面上**根本不存在**。
       —— 2026-11-23 用户口径改了之后，判定入口改成
          「点『去判定』→ 弹三选一小框 → 提交」，
          判定详情页（pages.js 的 PAGES.verdictDetail）里只有
          data-act="openVerdictPicker" 这一个按钮，压根没有 #submitVerdict。
       —— 所以 `if (btn)` 永远为 false，这整段是**死代码**：
          而它承载着【判定提交后的结算逻辑】（信用分入账、
             「分值待结算」提示框、1.4 秒后异步结算 +2/+3），
          这些逻辑**从来没有被执行过** ——
          也就是说：见证席判定通过，信用分**一直没加过**。
       —— 现在结算统一挂在 openVerdictPicker 的回调里（见 action 分发处），
          那才是判定真正提交的地方。判定只有一条路径，也只能有一条。
       —— 旧代码里的「分值待结算」提示框也一并搬到了新路径里，UI 不变。 */
  }
  /* ⚠️ 2026-11-24（本轮）：目标详情页原本那个留言输入框（#flagMsgInput）
     删掉了 —— 留言入口统一走 openMsgSheet()（和广场同一个半屏），
     所以这里不用再单独绑定输入框事件。 */
  /* 分步引导第 1 步：输入即时写入草稿 —— 用户返回上一步改完再回来时内容还在 */
  if (r === 'createGoal') {
    const map = { cgTitle:'title', cgStart:'start', cgTarget:'target' };
    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        STATE.createDraft[map[id]] = el.value;
      });
    });
  }
}

/* ---------------- 头像加载降级 ---------------- */
/* img.avatar 加载失败时：Unsplash -> pravatar -> 本地矢量人像 */
document.addEventListener('error', e => {
  const img = e.target;
  if (!img || img.tagName !== 'IMG' || !img.classList.contains('avatar')) return;
  if (img.dataset.fb1) {
    img.src = img.dataset.fb1;
    delete img.dataset.fb1;
  } else if (img.dataset.fb2) {
    img.src = img.dataset.fb2;
    delete img.dataset.fb2;
  } else {
    // 最后兜底：生成一个字母头像
    img.removeAttribute('src');
    img.textContent = (img.alt || '?').slice(0, 1);
    img.style.background = 'var(--ink-4)';
    img.style.color = '#fff';
    img.style.display = 'flex';
    img.style.alignItems = 'center';
    img.style.justifyContent = 'center';
  }
}, true);

/* ---------------- 启动 ---------------- */
render('splash');

/* 「开始」按钮在 viewport.innerHTML 里，重新渲染后是新的 DOM 节点，
   直接绑监听器会丢。这里用事件委托兜住。 */
document.addEventListener('click', e => {
  if (e.target.closest('#splashBtn')) { render('login'); return; }
});
