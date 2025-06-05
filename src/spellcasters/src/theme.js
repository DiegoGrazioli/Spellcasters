// theme.js - gestione modalità giorno/notte

let currentTheme = 'day';
const DAY_COLOR = '#ffffff';
const NIGHT_COLOR = '#111111';

function setTheme(mode) {
  currentTheme = mode === 'night' ? 'night' : 'day';
  document.body.style.backgroundColor = currentTheme === 'night' ? NIGHT_COLOR : DAY_COLOR;
  localStorage.setItem('mode', currentTheme);
  // Notifica eventuali listener
  if (typeof window.onThemeChange === 'function') window.onThemeChange(currentTheme);
}

function getTheme() {
  return currentTheme;
}

function initTheme() {
  const saved = localStorage.getItem('mode');
  setTheme(saved === 'night' ? 'night' : 'day');
}

window.addEventListener("keydown", (e) => {
  if (e.key === 'n' || e.key === 'N') {
    setTheme('night');
  }
  if (e.key === 'g' || e.key === 'G') {
    setTheme('day');
  }
});

// Crea un toggle DOM per cambiare tema
function createThemeToggle() {
  const btn = document.createElement('button');
  btn.textContent = currentTheme === 'night' ? '🌙 Notte' : '☀️ Giorno';
  btn.style.margin = '10px';
  btn.onclick = () => {
    setTheme(currentTheme === 'night' ? 'day' : 'night');
    btn.textContent = currentTheme === 'night' ? '🌙 Notte' : '☀️ Giorno';
  };
  // Aggiorna testo se cambia tema da altrove
  window.onThemeChange = (theme) => {
    btn.textContent = theme === 'night' ? '🌙 Notte' : '☀️ Giorno';
  };
  return btn;
}

export { setTheme, getTheme, initTheme, createThemeToggle, DAY_COLOR, NIGHT_COLOR };
