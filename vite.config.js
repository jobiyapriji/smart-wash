import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@apps': path.resolve(__dirname, 'apps'),
      '@src': path.resolve(__dirname, 'src'),
      '@i18n': path.resolve(__dirname, 'src/i18n'),
      '@services': path.resolve(__dirname, 'src/services'),
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4550',
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-faceapi': ['@vladmandic/face-api'],
          'vendor-mediapipe': ['@mediapipe/hands', '@mediapipe/camera_utils'],
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
});
