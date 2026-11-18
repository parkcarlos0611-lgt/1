import { defineConfig } from 'vite';
// relative base: the build runs from any folder (game page preview, Capacitor, Electron); es2022 for iOS 15+ / current WebViews
export default defineConfig({ base: './', build: { outDir: 'dist', assetsInlineLimit: 0, target: 'es2022', rollupOptions: { input: { main: 'index.html', proto1: 'proto1.html' } } } });
