export const darkColors = {
  // Base Colors
  background: {
    primary: '#060706',
    secondary: '#08090A',
    tertiary: '#0F1211',
    elevated: '#141614',
    pitch: '#0B1F14',
  },

  // Text Colors
  text: {
    primary: '#F2F1EC',
    secondary: '#8B908A',
    tertiary: '#6E736D',
    quaternary: '#5C615B',
    disabled: '#4E534D',
    dimmed: '#3E433D',
    onBrand: '#08090A',
  },

  // Brand Colors. `fill` is for lime surfaces (with `text.onBrand` labels);
  // `ink` is for lime used as text, lines, dots and bricks.
  brand: {
    fill: '#C8F24E',
    ink: '#C8F24E',
    tint: 'rgba(200, 242, 78, 0.06)',
  },

  // Accent Colors
  accent: {
    warning: '#FFC24A',
    danger: '#FF6B4A',
    club: '#1E4D33',
  },

  // Border Colors
  border: {
    subtle: 'rgba(242, 241, 236, 0.10)',
    default: 'rgba(242, 241, 236, 0.14)',
    medium: 'rgba(242, 241, 236, 0.22)',
    strong: 'rgba(242, 241, 236, 0.28)',
  },

  // Speed zones, walk → sprint
  zone: {
    walk: '#3E433D',
    jog: '#5C615B',
    run: '#1E4D33',
    highRun: '#8FA36A',
    sprint: '#C8F24E',
  },

  // Empty calendar / grid cells
  cell: 'rgba(242, 241, 236, 0.10)',

  // Overlay Colors
  overlay: {
    light: 'rgba(8, 9, 10, 0.55)',
    medium: 'rgba(0, 0, 0, 0.60)',
  },
};

export type Colors = typeof darkColors;

export const lightColors: Colors = {
  background: {
    primary: '#EFEEE8',
    secondary: '#F2F1EC',
    tertiary: '#FFFFFF',
    elevated: '#FFFFFF',
    pitch: '#0B1F14',
  },
  text: {
    primary: '#08090A',
    secondary: '#454A45',
    tertiary: '#5C615B',
    quaternary: '#80857F',
    disabled: '#80857F',
    dimmed: '#A9ADA6',
    onBrand: '#08090A',
  },
  brand: {
    fill: '#C8F24E',
    ink: '#4A6A00',
    tint: 'rgba(74, 106, 0, 0.07)',
  },
  accent: {
    warning: '#8A5A00',
    danger: '#C2361A',
    club: '#1E4D33',
  },
  border: {
    subtle: 'rgba(8, 9, 10, 0.10)',
    default: 'rgba(8, 9, 10, 0.14)',
    medium: 'rgba(8, 9, 10, 0.24)',
    strong: 'rgba(8, 9, 10, 0.32)',
  },
  zone: {
    walk: '#D9DAD3',
    jog: '#A9ADA6',
    run: '#1E4D33',
    highRun: '#8FA36A',
    sprint: '#4A6A00',
  },
  cell: 'rgba(8, 9, 10, 0.08)',
  overlay: {
    light: 'rgba(8, 9, 10, 0.55)',
    medium: 'rgba(0, 0, 0, 0.60)',
  },
};
