import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the same build works on GitHub Pages subpaths and itch.io zips.
  base: './',
  // content/ is the committed asset root (docs/03 section 11): audio files
  // live under content/audio and are looked up at runtime as audio/...;
  // generated PWA icons live under content/icons.
  publicDir: 'content',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sigilbound II',
        short_name: 'Sigilbound II',
        description: 'Craft your own spells. Roam the Vale. Battles strike from the tall grass.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0d0a1c',
        theme_color: '#16112b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell + icons. Audio is optional by design
        // (synth fallback) and cached on first play instead.
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        globIgnores: ['**/maps/**', '**/dialogue/**'],
        runtimeCaching: [
          {
            urlPattern: /audio\/.*\.ogg$/,
            handler: 'CacheFirst',
            options: { cacheName: 'sb2-audio', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
  },
});
