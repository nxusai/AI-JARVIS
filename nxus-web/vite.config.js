import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Cada sección es su propia página. La barra y el pie se escriben una vez
// (src/partials) y se insertan en cada HTML al compilar: el sitio sigue siendo estático.
const PAGES = ['index', 'jarvis', 'soluciones', 'industrias', 'proceso', 'nosotros', 'contacto'];

const cleanUrls = (req, _res, next) => {
  const [path, query] = req.url.split('?');
  const name = path.replace(/^\/|\/$/g, '');
  if (PAGES.includes(name)) req.url = `/${name}.html${query ? `?${query}` : ''}`;
  next();
};

const partials = () => ({
  name: 'nxus-partials',
  // En desarrollo, /jarvis también sirve jarvis.html (como en Netlify y Vercel).
  configureServer(server) { server.middlewares.use(cleanUrls); },
  configurePreviewServer(server) { server.middlewares.use(cleanUrls); },
  transformIndexHtml(html) {
    return html.replace(/<!--\s*@(\w+)\s*-->/g, (_, name) =>
      readFileSync(resolve(__dirname, `src/partials/${name}.html`), 'utf8'),
    );
  },
});

// Vista previa (ARTIFACT=1): rutas relativas y ligas a archivos .html, para
// servir el sitio desde una subcarpeta sin direcciones limpias.
const preview = process.env.ARTIFACT === '1';
const relative = () => ({
  name: 'nxus-relative',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const pages = PAGES.filter((p) => p !== 'index').join('|');
      return html
        .replace(/href="\/(#[^"]*)?"/g, 'href="index.html$1"')
        .replace(new RegExp(`href="/(${pages})(#[^"]*)?"`, 'g'), 'href="$1.html$2"')
        .replace(/(src|href)="\/(img\/|favicon\.svg|manifest\.webmanifest)/g, '$1="$2')
        .replace(/<title>NXUS AI · [^<]*<\/title>/, '<title>NXUS AI</title>');
    },
  },
});

export default defineConfig({
  base: preview ? './' : '/',
  plugins: [partials(), ...(preview ? [relative()] : [])],
  build: {
    outDir: preview ? 'dist-preview' : 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: Object.fromEntries(PAGES.map((p) => [p, resolve(__dirname, `${p}.html`)])),
    },
  },
});
