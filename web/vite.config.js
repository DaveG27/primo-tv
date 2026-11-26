import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This minimal configuration tells Vite to enable React support.
export default defineConfig({
  plugins: [react()],
})
