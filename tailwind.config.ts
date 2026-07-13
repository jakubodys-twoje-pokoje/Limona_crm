import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Wartości pochodzą z CSS custom properties (globals.css), zdefiniowanych
        // jako trójki RGB (np. "10 10 10"), żeby modyfikatory opacity Tailwinda
        // (np. bg-limona-lime/20) działały poprawnie przez <alpha-value>.
        // Dzięki temu motyw (dark/light/contrast) da się przełączać atrybutem
        // data-theme na <html>, bez przebudowy — patrz globals.css i ThemeProvider.
        limona: {
          bg: 'rgb(var(--limona-bg) / <alpha-value>)',
          surface: 'rgb(var(--limona-surface) / <alpha-value>)',
          'surface-2': 'rgb(var(--limona-surface-2) / <alpha-value>)',
          border: 'rgb(var(--limona-border) / <alpha-value>)',
          lime: 'rgb(var(--limona-lime) / <alpha-value>)',
          'lime-hover': 'rgb(var(--limona-lime-hover) / <alpha-value>)',
          'lime-active': 'rgb(var(--limona-lime-active) / <alpha-value>)',
          white: 'rgb(var(--limona-white) / <alpha-value>)',
          text: 'rgb(var(--limona-text) / <alpha-value>)',
          'text-muted': 'rgb(var(--limona-text-muted) / <alpha-value>)',
          'text-dim': 'rgb(var(--limona-text-dim) / <alpha-value>)',
          green: 'rgb(var(--limona-green) / <alpha-value>)',
          red: 'rgb(var(--limona-red) / <alpha-value>)',
          yellow: 'rgb(var(--limona-yellow) / <alpha-value>)',
          blue: 'rgb(var(--limona-blue) / <alpha-value>)',
        },
      },
      fontFamily: {
        heading: ['Oswald', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'lime-glow': '0 0 20px rgba(132, 204, 22, 0.15)',
        'lime-glow-lg': '0 0 25px rgba(132, 204, 22, 0.15)',
      },
    },
  },
  plugins: [],
}

export default config
