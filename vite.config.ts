import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['lucide-react'], // Pré-bundler lucide-react pour réduire les requêtes
  },
  server: {
    host: '0.0.0.0', // Permet l'accès depuis le réseau local
    port: 5173, // Port par défaut de Vite
    strictPort: false, // Si le port est occupé, Vite essaiera le suivant
  },
});
