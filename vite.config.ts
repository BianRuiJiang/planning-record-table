import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages 项目页使用固定子路径；相对资源也能避免路径拼接错误。
export default defineConfig({
  base: '/planning-record-table/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
  },
})
