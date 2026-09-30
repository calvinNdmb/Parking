// Icônes SVG inline (traits arrondis, 24×24).

const svg = (body: string, extra = '') =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  locate: svg('<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  layers: svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  nav: svg('<path d="m3 11 18-8-8 18-2-8-8-2Z"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  car: svg('<path d="M5 17h14M6 17v2M18 17v2"/><path d="M4 13.5 5.8 8a2 2 0 0 1 1.9-1.4h8.6A2 2 0 0 1 18.2 8L20 13.5V17H4v-3.5Z"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/>'),
  suv: svg('<path d="M3 17h18M5 17v2M19 17v2"/><path d="M3 13V9.5A2.5 2.5 0 0 1 5.5 7H15l4 4.5 2 .5V17H3v-4Z"/><path d="M8 7v4.5h11"/>'),
  moto: svg('<circle cx="5.5" cy="17" r="2.6"/><circle cx="18.5" cy="17" r="2.6"/><path d="M8.1 17h6.6l2.6-6.2-1.8-4.3h-2.2"/><path d="M3.5 13.2c1.4-2 3.3-2.7 6-2.7h4.3l-2.6 4.1H4.3z" fill="currentColor"/>'),
  bolt: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>'),
  bike: svg('<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h6l3.5 7.5M9 9l3.5 7.5h-7M13.5 6h2.5"/>'),
  walk: svg('<circle cx="13" cy="4" r="2"/><path d="m9 21 2.5-7M13 21v-5l-2-3 1-5 3 3 3 1M8 12l1-4 3-1"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  pin: svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  parking: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5"/>'),
};
