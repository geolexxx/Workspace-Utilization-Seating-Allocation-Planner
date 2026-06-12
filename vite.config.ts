/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Workspace-Utilization-Seating-Allocation-Planner/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
