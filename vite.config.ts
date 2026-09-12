import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'dexie',
              test: /[\\/]node_modules[\\/]dexie/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})