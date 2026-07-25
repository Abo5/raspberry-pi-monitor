// Bench design system — colour tokens (docs/13-DESIGN-SYSTEM.md §2).
// Dark is the primary appearance; light is a selected companion set.

export interface ColorTokens {
  surface: {
    canvas: string;
    raised: string;
    raised2: string;
    sunken: string;
    overlay: string;
    scrim: string;
  };
  border: {
    hairline: string;
    subtle: string;
    strong: string;
    focus: string;
    destructive: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    onAccent: string;
    onCritical: string;
  };
  accent: {
    base: string;
    high: string;
    pressed: string;
    muted: string;
    washAlpha: number; // accent.base at this alpha over surface
  };
  status: {
    ok: string;
    info: string;
    warning: string;
    critical: string;
    offline: string;
    unknown: string;
  };
  thermal: {
    // step 0 = nominal (uses text.secondary), then 1..5
    steps: [string, string, string, string, string];
  };
  viz: {
    categorical: string[]; // 8 slots, fixed order, never cycled
    sequential: string[]; // 100..700
    gridline: string;
    axis: string;
    tick: string;
    deEmphasis: string;
    gapHatch: string;
  };
  terminal: {
    ground: string;
    ansi: string[]; // 16
    cursor: string;
    selectionAlpha: number;
  };
  letterbox: string; // the one sanctioned pure black
}

export const dark: ColorTokens = {
  surface: {
    canvas: '#0B0F12',
    raised: '#141A1F',
    raised2: '#1C242B',
    sunken: '#06090B',
    overlay: '#1F2831',
    scrim: 'rgba(0,0,0,0.62)',
  },
  border: {
    hairline: '#232C34',
    subtle: '#2A343C',
    strong: '#5A6873',
    focus: '#2FBCCF',
    destructive: '#F2564F',
  },
  text: {
    primary: '#EEF3F5',
    secondary: '#A7B4BC',
    tertiary: '#85929A',
    disabled: '#4E5A62',
    onAccent: '#04191C',
    onCritical: '#140605',
  },
  accent: {
    base: '#2FBCCF',
    high: '#5AD0E0',
    pressed: '#1E93A3',
    muted: '#0E6874',
    washAlpha: 0.12,
  },
  status: {
    ok: '#2FB463',
    info: '#4E9BEC',
    warning: '#E0A61C',
    critical: '#F2564F',
    offline: '#7A8A94',
    unknown: '#9A938A',
  },
  thermal: {
    steps: ['#E6B731', '#E89400', '#E76E08', '#DB4822', '#C9222B'],
  },
  viz: {
    categorical: [
      '#10A6AD', '#D67523', '#8B78DE', '#2E9E52',
      '#CF60A4', '#AB9017', '#4687D8', '#D7564D',
    ],
    sequential: ['#B7E4EA', '#8FD3DD', '#63C0CD', '#2FA9BA', '#0B8B9B', '#046F7C', '#01545E'],
    gridline: '#1E262D',
    axis: '#2E3941',
    tick: '#85929A',
    deEmphasis: '#5A6873',
    gapHatch: '#39434B',
  },
  terminal: {
    ground: '#06090B',
    ansi: [
      '#3A444C', '#E2685F', '#3CC06F', '#D9A72B', '#5A9CE8', '#C97BC8', '#2FBCCF', '#C7D1D7',
      '#5A6873', '#FF8078', '#5AD98A', '#EFBE47', '#7FB6F2', '#DE97DC', '#5AD4E4', '#EEF3F5',
    ],
    cursor: '#2FBCCF',
    selectionAlpha: 0.24,
  },
  letterbox: '#000000',
};

export const light: ColorTokens = {
  surface: {
    canvas: '#EEF1F3',
    raised: '#FFFFFF',
    raised2: '#F7F9FA',
    sunken: '#E2E7EA',
    overlay: '#FFFFFF',
    scrim: 'rgba(13,20,24,0.40)',
  },
  border: {
    hairline: '#DCE3E7',
    subtle: '#D3DBE0',
    strong: '#78848B',
    focus: '#026E77',
    destructive: '#C22118',
  },
  text: {
    primary: '#0D1418',
    secondary: '#4A5860',
    tertiary: '#5E6C74',
    disabled: '#9AA6AD',
    onAccent: '#FFFFFF',
    onCritical: '#FFFFFF',
  },
  accent: {
    base: '#026E77',
    high: '#0A8B96',
    pressed: '#015159',
    muted: '#B7E4EA',
    washAlpha: 0.1,
  },
  status: {
    ok: '#0F7A3D',
    info: '#1160C4',
    warning: '#8A6100',
    critical: '#C22118',
    offline: '#5B6970',
    unknown: '#6E665C',
  },
  thermal: {
    steps: ['#B58C00', '#AF6F00', '#AA4D00', '#A22400', '#8C0010'],
  },
  viz: {
    categorical: [
      '#00999F', '#B65E07', '#7838F8', '#08833C',
      '#C60F91', '#8B7404', '#0D6BCC', '#C70A18',
    ],
    sequential: ['#B7E4EA', '#8FD3DD', '#63C0CD', '#2FA9BA', '#0B8B9B', '#046F7C', '#01545E'],
    gridline: '#E7ECEF',
    axis: '#CBD4D9',
    tick: '#5E6C74',
    deEmphasis: '#78848B',
    gapHatch: '#C6CFD4',
  },
  // TerminalSurface defaults to the dark palette in both appearances (§2.2 exception).
  terminal: {
    ground: '#06090B',
    ansi: [
      '#3A444C', '#E2685F', '#3CC06F', '#D9A72B', '#5A9CE8', '#C97BC8', '#2FBCCF', '#C7D1D7',
      '#5A6873', '#FF8078', '#5AD98A', '#EFBE47', '#7FB6F2', '#DE97DC', '#5AD4E4', '#EEF3F5',
    ],
    cursor: '#2FBCCF',
    selectionAlpha: 0.24,
  },
  letterbox: '#000000',
};

/** accent.wash / status washes: hex + alpha helper */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
