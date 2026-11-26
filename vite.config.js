import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this project below /emlak/, so keep generated URLs relative.
export default defineConfig({
  base: './',
  plugins: [react()],
})
