const WebSocket = require('ws');

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

let players = [];

wss.on('connection', (ws) => {
    console.log('Player connected.');

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'join') {
            const player = { id: players.length + 1, name: data.name, ws };
            players.push(player);
            console.log(`${data.name} joined the arena.`);
            broadcastPlayers();
        }
    });

    ws.on('close', () => {
        players = players.filter(player => player.ws !== ws);
        console.log('Player disconnected.');
        broadcastPlayers();
    });
});

function broadcastPlayers() {
    const playerList = players.map(player => ({ id: player.id, name: player.name }));
    players.forEach(player => {
        player.ws.send(JSON.stringify({ type: 'update', players: playerList }));
    });
}

console.log(`WebSocket server running on port ${port}`);