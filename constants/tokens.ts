// ═══════════════════════════════════════════════════════════════════════════
//  DELPHI · DESIGN TOKENS
//  Single source of truth for the visual system.
//  Every component in every screen pulls from this file.
//  Works in Expo (React Native) and Expo Web.
// ═══════════════════════════════════════════════════════════════════════════


// ───────────────────────────────────────────────────────────────────────────
//  RAW PALETTE
//  These are the literal hex values. Components shouldn't reach in here
//  directly — they should use the semantic theme below. Palette exists so
//  the theme can be redefined without changing the actual colors.
// ───────────────────────────────────────────────────────────────────────────
export const palette = {
  // Brand greens (Robinhood-style, slightly punchier than spec-green)
  green:        '#00D964',
  greenBright:  '#00E875',
  greenDeep:    '#00A84B',

  // Brand golds
  gold:         '#ECC97D',
  goldSoft:     '#E8C77E',
  goldDeep:     '#C99B3C',

  // Reds
  red:          '#FF4747',
  redSoft:      '#FF6868',

  // Pinks (Delphi accents — nose, paw beans, ear interiors)
  pink:         '#FF8FA8',
  pinkSoft:     '#FF99B5',
  pinkDeep:     '#C66088',

  // Spending category accents
  blue:         '#5B8DEF',
  cyan:         '#00B5D9',
  purple:       '#9C7CFF',
  purpleSoft:   '#C77DFF',
  orange:       '#FF8C5A',
  yellow:       '#FFB347',

  // Neutrals — dark
  black:        '#0A0A0A',
  nearBlack:    '#0F0F0F',
  charcoal:     '#141414',
  charcoalSoft: '#1A1A1A',
  ink:          '#1F1F1F',

  // Neutrals — light
  white:        '#FFFFFF',
  cream:        '#FAFBF8',
  bone:         '#F6F7F4',
  fog:          '#EFF1ED',
  paper:        '#E5E7E3',

  // Grays
  gray400:      '#5A5A5A',
  gray500:      '#6B6B6B',
  gray600:      '#888888',
  gray700:      '#9A9A9A',
  gray800:      '#9C9C9C',
} as const;


// ───────────────────────────────────────────────────────────────────────────
//  SEMANTIC THEMES
//  These are what components actually consume. Pass dark or light into
//  the `theme()` helper at the bottom and you get back a typed object
//  with stable semantic names (bg, card, text, border, etc.).
// ───────────────────────────────────────────────────────────────────────────
export const themeDark = {
  bg:          palette.black,
  bgSoft:      palette.nearBlack,
  card:        palette.charcoal,
  cardSoft:    palette.charcoalSoft,
  border:      palette.ink,

  text:        palette.white,
  textMuted:   palette.gray700,
  textDim:     palette.gray400,

  primary:     palette.green,
  primaryFg:   palette.black,         // text/icon color when primary is the bg
  primaryBright: palette.greenBright,
  accent:      palette.gold,
  accentFg:    palette.black,

  success:     palette.green,
  danger:      palette.red,
  warning:     palette.gold,
  info:        palette.blue,
} as const;

export const themeLight = {
  bg:          palette.bone,
  bgSoft:      palette.fog,
  card:        palette.white,
  cardSoft:    palette.cream,
  border:      palette.paper,

  text:        palette.black,
  textMuted:   palette.gray500,
  textDim:     palette.gray800,

  primary:     palette.green,
  primaryFg:   palette.black,
  primaryBright: palette.greenBright,
  accent:      palette.gold,
  accentFg:    palette.black,

  success:     palette.green,
  danger:      palette.red,
  warning:     palette.gold,
  info:        palette.blue,
} as const;

export type Theme = { [Key in keyof typeof themeDark]: string };


// ───────────────────────────────────────────────────────────────────────────
//  CATEGORY COLORS
//  Color-coded buckets so the UI reads at a glance.
// ───────────────────────────────────────────────────────────────────────────
export const categoryColor = {
  debt:       palette.red,
  cash:       palette.green,
  investment: palette.gold,
} as const;


// ───────────────────────────────────────────────────────────────────────────
//  SPENDING CATEGORY COLORS
//  Mirrors seed_default_categories() in the SQL schema. If you add a
//  category there, add the matching color here.
// ───────────────────────────────────────────────────────────────────────────
export const spendingColor = {
  // Expense
  groceries:        palette.green,
  dining:           palette.pink,
  rent:             palette.gold,
  utilities:        palette.blue,
  transportation:   palette.purple,
  subscriptions:    palette.orange,
  healthcare:       palette.red,
  entertainment:    palette.goldSoft,
  shopping:         palette.pinkSoft,
  travel:           palette.cyan,
  personalCare:     palette.yellow,
  gifts:            palette.purpleSoft,
  otherExpense:     palette.gray600,
  // Income
  salary:           palette.green,
  sideIncome:       palette.gold,
  refund:           palette.purple,
  investmentIncome: palette.cyan,
  otherIncome:      palette.gray600,
} as const;


// ───────────────────────────────────────────────────────────────────────────
//  SPACING SCALE
//  Numeric values (px on web, dp on native).
//  Use these everywhere instead of magic numbers.
// ───────────────────────────────────────────────────────────────────────────
export const space = {
  '0':   0,
  '1':   2,
  '2':   4,
  '3':   6,
  '4':   8,
  '5':   10,
  '6':   12,
  '7':   14,
  '8':   16,
  '9':   18,
  '10':  20,
  '12':  24,
  '14':  28,
  '16':  32,
  '20':  40,
  '24':  48,
  '32':  64,
} as const;


// ───────────────────────────────────────────────────────────────────────────
//  BORDER RADIUS
// ───────────────────────────────────────────────────────────────────────────
export const radius = {
  none:  0,
  sm:    8,
  md:    10,
  lg:    12,
  xl:    14,
  '2xl': 16,
  '3xl': 18,
  pill:  999,
} as const;


// ───────────────────────────────────────────────────────────────────────────
//  TYPOGRAPHY
//  Font families: native uses platform System; web uses fallback chain.
//  Numbers are font sizes in px (web) / dp (native).
// ───────────────────────────────────────────────────────────────────────────
export const fonts = {
  // For React Native: undefined = platform default (San Francisco / Roboto).
  // For Web: use the web variants in style.fontFamily.
  sans:    undefined as string | undefined,
  mono:    undefined as string | undefined,
  sansWeb: 'ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif',
  monoWeb: 'ui-monospace, "SF Mono", Menlo, monospace',
} as const;

export const fontSize = {
  micro: 10,
  xs:    11,
  sm:    12,
  base:  13,
  md:    14,
  lg:    15,
  xl:    16,
  '2xl': 18,
  '3xl': 22,
  '4xl': 28,
  hero:  38,
} as const;

export const fontWeight = {
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
  black:     '900',
} as const;

export const letterSpacing = {
  tightest: -1.4,
  tighter:  -0.7,
  tight:    -0.3,
  normal:    0,
  wide:      0.3,
  wider:     0.6,
  widest:    1.2,
} as const;


// ───────────────────────────────────────────────────────────────────────────
//  MOTION
// ───────────────────────────────────────────────────────────────────────────
export const duration = {
  instant: 100,
  fast:    180,
  base:    240,
  medium:  320,
  slow:    480,
  // Loop durations
  breathe: 2400,
  loader:  1500,
} as const;

export const easing = {
  standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  in:       'cubic-bezier(0.4, 0, 1, 1)',
  out:      'cubic-bezier(0, 0, 0.2, 1)',
  bouncy:   'cubic-bezier(0.5, 0, 0.4, 1.4)',
} as const;


// ───────────────────────────────────────────────────────────────────────────
//  SHADOWS
//  Provide both web and RN forms because they're different APIs.
// ───────────────────────────────────────────────────────────────────────────
export const shadow = {
  sm: {
    web: '0 1px 2px rgba(0,0,0,0.2)',
    rn: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 1 },
  },
  md: {
    web: '0 2px 6px rgba(0,0,0,0.25)',
    rn: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  },
  lg: {
    web: '0 8px 24px rgba(0,0,0,0.35)',
    rn: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  },
  // For the gold "Ask Delphi" CTA glow
  glow: (hex: string) => `0 0 0 1px ${hex}10, 0 8px 24px ${hex}20`,
} as const;


// ───────────────────────────────────────────────────────────────────────────
//  Z-INDEX LAYERS
// ───────────────────────────────────────────────────────────────────────────
export const z = {
  base:    0,
  raised:  1,
  fab:     5,
  sticky:  10,
  overlay: 15,
  modal:   20,
  toast:   30,
} as const;


// ───────────────────────────────────────────────────────────────────────────
//  COMPONENT TOKENS
//  Locked-in measurements for repeated patterns.
// ───────────────────────────────────────────────────────────────────────────
export const components = {
  dashboardMaxWidth:   720,
  cardPadding:         16,
  cardPaddingCompact:  12,
  fabSize:             56,
  avatar: {
    sm: 32,
    md: 36,
    lg: 44,
  },
  hitTarget:           44,            // minimum tap target on mobile
  inputHeight:         48,
} as const;


// ───────────────────────────────────────────────────────────────────────────
//  HELPERS
// ───────────────────────────────────────────────────────────────────────────

/** Pick the right semantic theme based on the user's preferred mode. */
export const theme = (mode: 'dark' | 'light'): Theme =>
  mode === 'dark' ? themeDark : themeLight;

/** Clamp a hex color to a transparency suffix for tinted backgrounds. */
export const tint = (hex: string, alpha: number): string => {
  const a = Math.max(0, Math.min(1, alpha));
  const aa = Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
  return `${hex}${aa}`;
};


// ───────────────────────────────────────────────────────────────────────────
//  DEFAULT EXPORT
//  For convenience — single import gets everything.
// ───────────────────────────────────────────────────────────────────────────
export default {
  palette,
  themeDark,
  themeLight,
  categoryColor,
  spendingColor,
  space,
  radius,
  fonts,
  fontSize,
  fontWeight,
  letterSpacing,
  duration,
  easing,
  shadow,
  z,
  components,
  theme,
  tint,
};
