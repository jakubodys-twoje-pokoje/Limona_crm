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
        limona: {
          bg: '#0a0a0a',
          surface: '#141414',
          'surface-2': '#1a1a1a',
          border: '#2a2a2a',
          lime: '#84cc16',
          'lime-hover': '#a3e635',
          'lime-active': '#65a30d',
          white: '#FFFFFF',
          text: '#E0E0E0',
          'text-muted': '#808080',
          'text-dim': '#4a4a4a',
          green: '#00E676',
          red: '#FF3D3D',
          yellow: '#FFD600',
          blue: '#448AFF',
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
