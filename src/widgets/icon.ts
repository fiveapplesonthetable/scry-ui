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
    'M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm8.94-2.2c.04-.43.06-.86.06-1.3s-.02-.87-.06-1.3l2.03-1.58a.5.5 0 0 0 .11-.63l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.55 7.55 0 0 0-2.24-1.3l-.36-2.54A.5.5 0 0 0 15.07 2h-3.84a.5.5 0 0 0-.5.43L10.37 4.97A7.55 7.55 0 0 0 8.13 6.27l-2.4-.96a.5.5 0 0 0-.6.22L3.22 8.85a.5.5 0 0 0 .11.63L5.36 11.07a7.6 7.6 0 0 0 0 2.6L3.33 15.25a.5.5 0 0 0-.11.63l1.92 3.32a.5.5 0 0 0 .6.22l2.4-.96c.69.54 1.46.98 2.24 1.3l.36 2.54a.5.5 0 0 0 .5.43h3.84a.5.5 0 0 0 .5-.43l.36-2.54a7.55 7.55 0 0 0 2.24-1.3l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.11-.63l-2.03-1.58Z',
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
