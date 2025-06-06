// Gestione dati player persistenti

function getCurrentUsername() {
  return localStorage.getItem('currentPlayer');
}

function getPlayers() {
  return JSON.parse(localStorage.getItem('players') || '[]');
}

function savePlayers(players) {
  localStorage.setItem('players', JSON.stringify(players));
}

function getPlayerData() {
  const username = getCurrentUsername();
  if (!username) return null;
  const players = getPlayers();
  return players.find(p => p.username === username) || null;
}

function savePlayerData(data) {
  const username = getCurrentUsername();
  if (!username) return;
  let players = getPlayers();
  const idx = players.findIndex(p => p.username === username);
  if (idx !== -1) {
    players[idx] = { ...players[idx], ...data };
    savePlayers(players);
  }
}

export { getPlayerData, savePlayerData };
