import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.test.mjs'],
    clearMocks: true,
    restoreMocks: true,
  },
})
