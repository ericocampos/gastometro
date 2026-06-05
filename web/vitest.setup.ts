import '@testing-library/jest-dom/vitest'

// ResizeObserver não existe no jsdom; polyfill mínimo para recharts (ResponsiveContainer)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
