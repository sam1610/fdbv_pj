import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/graphql': {
        target: 'https://ukgmeoxyrvg5bbfwawi3yl67ay.appsync-api.us-east-1.amazonaws.com',
        changeOrigin: true,
        secure: false,
        headers: {
          'x-api-key': 'da2-4dz4ffqygbarfebs7qxp7n6wiq',
        },
      },
    },
  },
});
