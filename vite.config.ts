import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { imagetools } from 'vite-imagetools';

/**
 * Injects the absolute site URL into index.html (Open Graph / canonical need
 * absolute URLs) and emits sitemap.xml at build time.
 */
function siteUrlPlugin(siteUrl: string): Plugin {
  const base = siteUrl.replace(/\/$/, '');
  return {
    name: 'k233-site-url',
    transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', base) },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /checkout\nDisallow: /order/\n\nSitemap: ${base}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // On Vercel, fall back to the production domain Vercel provides.
  const siteUrl =
    env.SITE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:5173');
  return {
    plugins: [
      react(),
      siteUrlPlugin(siteUrl),
      // Turns `?w=…&format=webp` image imports (e.g. the gallery folder) into optimised files.
      // Auto-rotate first so phone photos with EXIF orientation come out upright.
      imagetools({
        extendTransforms: (builtins) => [() => (image) => image.rotate(), ...builtins],
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          // While the API is (re)starting, answer with a clean 503 instead of Vite's 500.
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if (!('writeHead' in res) || res.headersSent) return;
              res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '1' });
              res.end(JSON.stringify({ error: 'API starting, retry', code: 'API_STARTING' }));
            });
          },
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            motion: ['framer-motion'],
            // recharts is intentionally not listed: it is only reached through the
            // lazy admin Dashboard, so Rollup keeps it out of the public bundle.
          },
        },
      },
    },
  };
});
