import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: [path.resolve(__dirname, '..'), path.resolve(__dirname)] }
  },
  resolve: {
    alias: {
      // ensure shared/events resolves to the TS source, not any built CJS
      '../../../shared/events': path.resolve(__dirname, '../shared/events.ts'),
      '../../shared/events': path.resolve(__dirname, '../shared/events.ts'),
      '../shared/events': path.resolve(__dirname, '../shared/events.ts'),
      shared: path.resolve(__dirname, '../shared'),
    }
  }
})
