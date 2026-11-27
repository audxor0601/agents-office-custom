// Theme = palette (hex) + lighting. Picked once at load; switching reloads the page.
// ponytail: reload instead of live swap, because materials are cached at build time.

const defaultColors = {
  // Environment
  sky: 0x2b2d3a,
  floor: 0xd4c9a8,
  carpet: 0x6b5b73,
  wall: 0xf5f0e8,
  ceiling: 0xf2ede5,
  divider: 0xd0d0d0,

  // Furniture
  desk: 0xc4a882,
  deskLegs: 0x8b7355,
  monitor: 0x2a2a3e,
  monitorScreen: 0x1a3a5c,
  monitorScreenActive: 0x2a5a2a,
  monitorScreenError: 0x5a2a2a,
  whiteboard: 0xf0f0f0,
  whiteboardFrame: 0x888888,
  bookshelf: 0x8b6914,
  coffeeMachine: 0x444444,
  coffeeCounter: 0xb8a88a,
  cup: 0xf5f5f0,

  // Stickman
  skin: 0xf5deb3,
  limb: 0x333344,
  shoe: 0x222233,

  // Accent colors for agents
  accents: [0x4a90d9, 0xd94a4a, 0x4ad94a, 0xd9d94a, 0xd94ad9, 0x4ad9d9, 0xd9904a, 0x904ad9],

  // Books
  books: [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085, 0xd35400, 0x2c3e50],

  // Plants
  pot: 0xb5651d,
  plant: 0x2d7a3a,
  plantLight: 0x4caf50,
};

export type Palette = typeof defaultColors;

export interface Lighting {
  ambient: { color: number; intensity: number };
  hemi: { sky: number; ground: number; intensity: number };
  lamp: { color: number; intensity: number; panel: number };
  exposure: number;
  // Red warning beacons: [x, y, z] positions, pulsing
  alarms: [number, number, number][];
}

export interface Theme {
  label: string;
  colors: Palette;
  lighting: Lighting;
}

const themes = {
  default: {
    label: '기본 사무실',
    colors: defaultColors,
    lighting: {
      ambient: { color: 0x9999bb, intensity: 1.0 },
      hemi: { sky: 0xdddde8, ground: 0x998866, intensity: 0.6 },
      lamp: { color: 0xfff5e6, intensity: 3, panel: 0xeeeeff },
      exposure: 1.0,
      alarms: [],
    },
  },
  'command-center': {
    label: '지휘통제실',
    colors: {
      ...defaultColors,
      sky: 0x07090e,
      // Same tones as before, lifted slightly so toon-shading steps read under light
      floor: 0x474c54,        // dark gray
      carpet: 0x4a5238,       // olive
      wall: 0x34466f,         // dark navy
      ceiling: 0x2a3244,
      divider: 0x505840,
      desk: 0x6c7362,         // olive-gray
      deskLegs: 0x2e3236,
      monitor: 0x1c2026,
      monitorScreen: 0x2f9a7a,        // soft teal glow (emissive)
      monitorScreenActive: 0x3aa860,
      whiteboard: 0x1d2738,
      whiteboardFrame: 0x3a3f46,
      bookshelf: 0x3b4230,
      coffeeMachine: 0x26292d,
      coffeeCounter: 0x363a3e,
      cup: 0x9a9c94,
      books: [0x4a5236, 0x2c3a52, 0x3e4a2c, 0x55503a, 0x2a3140, 0x46503c, 0x5a4a32, 0x22262e],
      pot: 0x33363a,
      plant: 0x3a4628,
      plantLight: 0x55643a,
    },
    lighting: {
      // Room dimmed; blue spill from situation board (CommandScreens.ts, 3 spots × 4) is the key light
      // +30% room fill (board spots and screens unchanged, so the blue glow stays):
      // ambient 0.98→1.27, hemi 0.52→0.68, lamps 1.85→2.4
      ambient: { color: 0xa8b4d8, intensity: 1.27 },
      hemi: { sky: 0xc0cff0, ground: 0x5a5a4c, intensity: 0.68 },
      lamp: { color: 0xd4e2ff, intensity: 2.4, panel: 0xb8c8e8 },
      exposure: 1.0,
      // On the side walls near the back corners (back wall is the situation board)
      alarms: [[-14.8, 5.3, -10], [14.8, 5.3, -10]],
    },
  },
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof themes;
const NAMES = Object.keys(themes) as ThemeName[];
const KEY = 'agents-office-theme';

function loadName(): ThemeName {
  try {
    const v = localStorage.getItem(KEY);
    if (v && v in themes) return v as ThemeName;
  } catch {}
  return 'default';
}

export const themeName = loadName();
export const theme: Theme = themes[themeName];

export function nextThemeLabel(): string {
  return themes[NAMES[(NAMES.indexOf(themeName) + 1) % NAMES.length]].label;
}

export function switchTheme(): void {
  const next = NAMES[(NAMES.indexOf(themeName) + 1) % NAMES.length];
  try { localStorage.setItem(KEY, next); } catch {}
  location.reload();
}
