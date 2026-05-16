// Tiny inline SVG icons. No font dep.

import m from 'mithril';

type IconName =
  | 'search'
  | 'chevronDown'
  | 'chart'
  | 'logs'
  | 'settings'
  | 'health'
  | 'sun'
  | 'moon'
  | 'auto'
  | 'copy'
  | 'close'
  | 'file'
  | 'play'
  | 'circle';

interface Attrs {
  icon: IconName;
  size?: number;
  className?: string;
}

const PATHS: Record<IconName, string> = {
  search:
    'M11 4a7 7 0 1 1-4.95 11.95l-3.27 3.28-1.42-1.41 3.28-3.28A7 7 0 0 1 11 4Zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 11 6Z',
  chevronDown: 'M6 9l6 6 6-6',
  chart:
    'M3 19V5h2v14H3Zm4 0v-9h2v9H7Zm4 0V8h2v11h-2Zm4 0v-6h2v6h-2Zm4 0V3h2v16h-2Z',
  logs:
    'M4 4h16v3H4V4Zm0 6h16v3H4v-3Zm0 6h10v3H4v-3Z',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9.4 4-2-1.2.1-.8-.1-.8 2-1.2-2-3.4-2.3 1L16 5l-1-2H9L8 5l-1.1.6-2.3-1-2 3.4 2 1.2-.1.8.1.8-2 1.2 2 3.4 2.3-1 1.1.6 1 2h6l1-2 1.1-.6 2.3 1 2-3.4Z',
  health: 'M21 8h-4l-3 9-4-18-3 9H1',
  sun: 'M12 4V2m0 20v-2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z',
  auto: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 2v14a7 7 0 0 0 0-14Z',
  copy: 'M9 9h11v11H9V9Zm-5-5h11v2H6v11H4V4Z',
  close: 'M6 6l12 12m0-12L6 18',
  file: 'M14 2H6v20h12V6l-4-4Zm0 0v4h4',
  play: 'M8 5l11 7-11 7V5Z',
  circle: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z',
};

const STROKE_ONLY = new Set<IconName>([
  'chevronDown',
  'sun',
  'moon',
  'health',
  'close',
  'file',
]);

export const Icon: m.Component<Attrs> = {
  view({attrs}) {
    const size = attrs.size ?? 16;
    const path = PATHS[attrs.icon];
    const stroke = STROKE_ONLY.has(attrs.icon);
    return m(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: stroke ? 'none' : 'currentColor',
        stroke: stroke ? 'currentColor' : 'none',
        'stroke-width': stroke ? 2 : 0,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        class: attrs.className,
        'aria-hidden': 'true',
      },
      m('path', {d: path}),
    );
  },
};
