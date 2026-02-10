const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const REQUIRED_HEARTS = 200;

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store game state
let gameState = {
    progress: 0,
    progress: 0,
    status: 'waiting', // waiting, playing, finished
    players: 0,
    totalHearts: 0
};

const WINNING_PROGRESS = 100; // Finish line value

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    // Track connected players to handle disconnects correctly
    socket.isPlayer = false;

    // Send current state to new connector
    socket.emit('init_state', gameState);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.isPlayer) {
            gameState.players = Math.max(0, gameState.players - 1);
            io.emit('player_count', gameState.players);
        }
    });

    // Handle player join
    socket.on('join_game', () => {
        if (!socket.isPlayer) {
            socket.isPlayer = true;
            gameState.players++;
            io.emit('player_count', gameState.players);
        }
        // Always send current state on join to ensure client is synced
        socket.emit('init_state', gameState);
    });

    // Handle game start
    socket.on('start_game', () => {
        if (gameState.status === 'waiting' || gameState.status === 'finished') {
            gameState.status = 'playing';
            gameState.progress = 0;
            gameState.isRaceFinished = false;
            io.emit('game_started');
            io.emit('update_progress', 0);
        }
    });

    // Handle heart tap from player
    socket.on('send_heart', () => {
        if (gameState.status === 'playing') {
            // Increment heart count
            gameState.totalHearts++;

            // Calculate progress based on ratio: currentHearts / requiredHearts
            // Total hearts needed to win
            gameState.progress = Math.min(WINNING_PROGRESS, (gameState.totalHearts / REQUIRED_HEARTS) * WINNING_PROGRESS);

            // Broadcast heart effect to everyone (or just host)
            io.emit('heart_received');

            // Broadcast new position and heart count
            io.emit('update_progress', { progress: gameState.progress, totalHearts: gameState.totalHearts });

            // Check win condition
            if (gameState.progress >= WINNING_PROGRESS) {
                gameState.status = 'finished';
                gameState.progress = WINNING_PROGRESS;
                io.emit('game_over');
            }
        }
    });

    // Reset game (can be called by host)
    socket.on('reset_game', () => {
        gameState.progress = 0;
        gameState.totalHearts = 0;
        gameState.status = 'waiting';
        io.emit('reset_game'); // This now means "Back to Lobby"
        io.emit('update_progress', { progress: 0, totalHearts: 0 });
    });
});

// Endpoint to generate QR code for the player URL
app.get('/qrcode', async (req, res) => {
    try {
        // Dynamically determine local IP is tricky without specific config, 
        // usually we use req.headers.host if we trust it, or a specific environment variable.
        // For local dev, we might just assume localhost or let the frontend build the link.
        // But for mobile testing, we need the IP.
        // Let's rely on the client to tell us the host url or just send a string the client renders.

        // Simpler approach: Send the URL as a query param or let client handle it?
        // Let's actually generate it server side if we know the host.
        // Note: req.protocol + '://' + req.get('host') + '/player.html'

        const url = req.query.url || `${req.protocol}://${req.get('host')}/player.html`;
        const qrImage = await QRCode.toDataURL(url);
        res.json({ qrImage, url });
    } catch (err) {
        res.status(500).send('Error generating QR code');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
