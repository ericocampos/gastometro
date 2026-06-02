import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marca: { DEFAULT: '#0a7d52', escuro: '#0b6644', claro: '#34d399' },
      },
    },
  },
  plugins: [],
}
export default config
