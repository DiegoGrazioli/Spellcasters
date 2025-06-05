// home.js - schermata home con selezione modalità
import { createThemeToggle, initTheme } from './theme.js';

function showHomeScreen(onSelect) {
  // Pulisci il body
  document.body.innerHTML = '';

  // Container principale
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.height = '100vh';
  container.style.gap = '32px';

  // Titolo
  const title = document.createElement('h1');
  title.textContent = 'Spellcasters';
  title.style.fontFamily = 'serif';
  title.style.fontSize = '3rem';
  title.style.marginBottom = '24px';
  container.appendChild(title);

  // Pulsanti
  const labBtn = document.createElement('button');
  labBtn.textContent = 'Lab';
  labBtn.style.fontSize = '2rem';
  labBtn.style.padding = '16px 48px';
  labBtn.onclick = () => onSelect('lab');

  const arenaBtn = document.createElement('button');
  arenaBtn.textContent = 'Arena';
  arenaBtn.style.fontSize = '2rem';
  arenaBtn.style.padding = '16px 48px';
  arenaBtn.onclick = () => onSelect('arena');

  // Toggle tema
  const themeToggle = createThemeToggle();

  // Layout
  container.appendChild(labBtn);
  container.appendChild(arenaBtn);
  container.appendChild(themeToggle);

  document.body.appendChild(container);
}

// Inizializza tema all'avvio
initTheme();

export { showHomeScreen };
