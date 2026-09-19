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
            {
              name: 'langgraph',
              test: /[\\/]node_modules[\\/]@langchain[\\/]langgraph/,
              priority: 30,
            },
            {
              name: 'langchain-core',
              test: /[\\/]node_modules[\\/](?:@langchain[\\/]core|langsmith)/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
})