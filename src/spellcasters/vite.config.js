import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022', // Supporta top-level await
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'index.html',
        home: 'home.html',
        lab: 'lab.html',
        'player-info': 'player-info.html',
        arena: 'arena.html',
        'element-pattern-preview': 'element-pattern-preview.html',
        game: 'game.html'
      }
    }
  },
  esbuild: {
    target: 'es2022' // Supporta top-level await anche per esbuild
  }
});