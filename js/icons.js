/* ============================================================
   Íconos: set mínimo de SVG en línea
   ============================================================ */
const PATHS = {
  dumbbell: `<path d="M6.5 6.5l11 11M4 9v6M2 8v8M20 9v6M22 8v8M8 5l-2 2 8 8 2-2z"/>`,
  calendar: `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  trending: `<polyline points="3,17 9,11 13,15 21,6"/><polyline points="15,6 21,6 21,12"/>`,
  flame: `<path d="M12 2c1 4-4 5-4 9a4 4 0 0 0 8 0c0-1.5-1-2.5-1-4 2 1 3 3 3 5a6 6 0 0 1-12 0c0-5 4-6 6-10z"/>`,
  check: `<polyline points="20,6 9,17 4,12"/>`,
  x: `<path d="M18 6 6 18M6 6l12 12"/>`,
  trophy: `<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>`,
  trash: `<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>`,
  mail: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>`,
  lock: `<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
  logout: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>`,
  swap: `<path d="m17 2 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>`,
  scale: `<circle cx="12" cy="12" r="9"/><path d="M8 15h8M9 9l1.5 1.5M15 9l-1.5 1.5"/>`,
  home: `<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>`,
  library: `<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 3v18M14 8h3M14 12h3"/>`,
  history: `<path d="M3 3v6h6"/><path d="M3.5 13a9 9 0 1 0 2.5-7.5L3 9"/><path d="M12 7v6l4 2"/>`,
  play: `<polygon points="6,4 20,12 6,20"/>`,
  skip: `<path d="M5 4v16l10-8z"/><path d="M18 4v16"/>`,
  checkcircle: `<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 5-5"/>`,
  loader: `<path d="M12 3a9 9 0 1 0 9 9"/>`,
  edit: `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`,
  cart: `<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.8h7.2a2 2 0 0 0 2-1.6L21 8H6"/>`,
  box: `<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>`,
  sliders: `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>`,
  ruler: `<path d="M3 17 17 3l4 4L7 21l-4-4z"/><path d="m14 6 2 2M10 10l2 2M6 14l2 2"/>`,
  image: `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>`,
  eye: `<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`,
  bolt: `<polygon points="13,2 3,14 11,14 10,22 21,10 13,10"/>`,
};

export function icon(name, size, color) {
  size = size || 16; color = color || "currentColor";
  const attrs = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg ${attrs} class="og-icon-svg">${PATHS[name] || ""}</svg>`;
}
