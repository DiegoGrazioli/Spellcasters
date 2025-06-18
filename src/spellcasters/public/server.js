import { WebSocketServer } from 'ws';

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

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

    broadcastOnlinePlayers();
});

function broadcastPlayers() {
    const playerList = players.map(player => ({ id: player.id, name: player.name }));
    players.forEach(player => {
        player.ws.send(JSON.stringify({ type: 'update', players: playerList }));
    });
}

function broadcastOnlinePlayers() {
    const count = wss.clients.size;
    const msg = JSON.stringify({ type: 'onlinePlayers', count });
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(msg);
    });
}

console.log(`WebSocket server running on port ${port}`);