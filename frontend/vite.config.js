import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento o Vite repassa /api para o backend.
// Assim a tela e a API ficam no mesmo endereço e o cookie de sessão funciona sem CORS.
const api = process.env.ENGAJADEV_API || 'http://localhost:4400';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT) || 5400,
    proxy: { '/api': api },
  },
  preview: {
    port: Number(process.env.WEB_PORT) || 5400,
    proxy: { '/api': api },
  },
});
