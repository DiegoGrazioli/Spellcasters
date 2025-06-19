import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'index.html',
        home: 'home.html',
        lab: 'lab.html',
        'player-info': 'player-info.html',
        arena: 'arena.html',
        'element-pattern-preview': 'element-pattern-preview.html'
      }
    }
  }
});