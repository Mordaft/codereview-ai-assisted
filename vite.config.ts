import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
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
              name: 'langchain-core',
              test: /[\\/]node_modules[\\/]@langchain[\\/]core/,
              maxSize: 400 * 1024,
              priority: 9,
            },
            {
              name: 'langsmith',
              test: /[\\/]node_modules[\\/]langsmith/,
              priority: 8,
            },
            {
              name: 'zod',
              test: /[\\/]node_modules[\\/]zod/,
              priority: 7,
            },
            {
              name: 'langgraph',
              test: /[\\/]node_modules[\\/]@langchain[\\/]langgraph/,
              priority: 6,
            },
          ],
        },
      },
    },
  },
})