// Design tokens for claude_elects charts.
//
// Party colours come in two flavours:
//   brand  - the party's own official colour, from data/parties.csv
//   chart  - a screen-tuned variant with the same hue identity, adjusted so it
//            sits inside a usable lightness band and clears the chroma floor
//
// Why the second set exists: several official party colours are unusable as
// lines on white. PS #FFDB00 has a contrast ratio of 1.33:1 against the page --
// effectively invisible. The tuned variants keep the hue (PS stays yellow,
// KOK stays blue) while being legible. Brand colours are still available for
// solid fills, where the contrast problem does not arise.

export const partyChartColor = {
  KOK:  '#0A6C99',
  PS:   '#C08A00',
  SDP:  '#E11931',
  KESK: '#00853F',
  VIHR: '#5AA512',
  VAS:  '#E8005E',
  RKP:  '#D6A400',
  KD:   '#17497F',
  LIIK: '#0093AB',
  MUUT: '#8A9099',
};

// Finnish party colours collide by nature: two blues (KOK/KD), two greens
// (KESK/VIHR), two yellows (PS/RKP), two reds (SDP/VAS). No recolouring fixes
// this while keeping party identity. The fix is editorial, not chromatic:
// never run more than ~3 parties at full colour in one chart, mute the rest,
// and direct-label every visible line so identity never rests on colour alone.
export const knownCollisions = [
  ['KOK', 'KD'], ['KESK', 'VIHR'], ['PS', 'RKP'], ['SDP', 'VAS'],
];

export const ink = {
  primary:   '#121212',
  secondary: '#454545',
  muted:     '#6E6E6E',
  faint:     '#9B9B9B',
  rule:      '#DADADA',
  grid:      '#EAEAEA',
  surface:   '#FFFFFF',
};

// Muted treatment for parties that are not the story in a given chart.
export const mutedLine = '#C6C6C6';
export const mutedLabel = '#8A8A8A';

export const type = {
  sans: "'Libre Franklin', 'Helvetica Neue', Arial, sans-serif",
  serif: "'Source Serif 4', Georgia, serif",
  mono: "'Roboto Mono', 'SF Mono', monospace",
};

// Output sizes. Add a row here and it becomes renderable immediately.
export const sizes = {
  ig:     { w: 1080, h: 1350, name: 'Instagram 4:5' },
  igsq:   { w: 1080, h: 1080, name: 'Instagram 1:1' },
  x:      { w: 1600, h: 900,  name: 'X / landscape 16:9' },
  story:  { w: 1080, h: 1920, name: 'Story 9:16' },
};
