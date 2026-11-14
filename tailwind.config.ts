import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1B2B1F',
        dark: '#3E6B48',
        light: '#8DB580',
        paper: '#D6E8C3',
        shell: '#C9C3B6',
        shellshade: '#8E877A',
        edge: '#5E584F',
        btn: '#B0306A',
        dpad: '#2B2B2B',
        coin: '#F2B705',
        coinshade: '#A87A00',
        page: '#141414',
        tile: '#2C4A34',
      },
      fontFamily: {
        head: ['var(--font-head)', 'monospace'],
        body: ['var(--font-body)', 'monospace'],
      },
      maxWidth: { content: '1120px' },
      boxShadow: { hard: '4px 4px 0 #1B2B1F', hardlight: '4px 4px 0 #5E584F' },
    },
  },
  plugins: [],
};
export default config;
