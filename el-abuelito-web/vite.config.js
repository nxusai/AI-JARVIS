import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el sitio funciona en la raíz del dominio o en una subcarpeta.
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
