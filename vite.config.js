import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: base must match the GitHub Pages sub-path exactly, or the built
// JS/CSS/asset URLs resolve to the wrong place and you get a blank page with
// 404s. The repo is served at https://bboard01.github.io/FishSlayRBeta/ so the
// base is '/FishSlayRBeta/'. If you ever rename the repo, update this.
export default defineConfig({
  base: '/FishSlayRBeta/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Keep the bundle debuggable during the migration; can tighten later.
    sourcemap: true
  }
});
