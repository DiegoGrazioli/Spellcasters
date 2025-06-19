import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/spellcasters', // directory dove si trovano i tuoi HTML principali
  build: {
    outDir: '../../dist', // dove vuoi che vada la build finale (ad esempio nella root del progetto)
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'src/spellcasters/index.html',
        home: 'src/spellcasters/home.html',
        lab: 'src/spellcasters/lab.html',
        'player-info': 'src/spellcasters/player-info.html',
        'arena': 'src/spellcasters/arena.html',
        'element-pattern-preview': 'src/spellcasters/element-pattern-preview.html'
        // aggiungi qui altri HTML se ne hai
      }
    }
  }
});