import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // verde da marca (dinheiro / cívico) — clareia no escuro p/ legibilidade
        marca: { DEFAULT: 'var(--marca)', escuro: '#0b6644', claro: '#34d399' },
        // superfícies temáticas (viram via CSS vars no .dark)
        papel: 'var(--papel)',
        superficie: 'var(--superficie)',
        'superficie-2': 'var(--superficie-2)',
        borda: 'var(--borda)',
        tinta: {
          DEFAULT: 'var(--tinta)',
          suave: 'var(--tinta-suave)',
          tenue: 'var(--tinta-tenue)',
        },
      },
      boxShadow: {
        carta: '0 1px 2px rgba(20,18,12,0.04), 0 8px 24px -12px rgba(20,18,12,0.18)',
      },
    },
  },
  plugins: [],
}
export default config
