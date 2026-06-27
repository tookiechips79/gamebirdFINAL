const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
app.get('/', (req, res) => res.send('GameBird socket server running'));
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  allowEIO3: true,
});

let gameState = null;
let usersState = null;
let historyState = null;
let lastStampedClientTs = null;
let lastTimerVersion = null;

io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id} (${io.engine.clientsCount} total)`);

  if (gameState) socket.emit('game:state', gameState);
  if (usersState) socket.emit('users:state', usersState);
  if (historyState) socket.emit('history:state', historyState);

  socket.on('game:update', (newState) => {
    let state = newState;
    let serverModified = false;

    // Reset when timer is cleared
    if (!newState.timerStartedAt) {
      lastStampedClientTs = null;
      lastTimerVersion = null;
    }

    // Use timerVersion as definitive signal for a new timer start
    const isNewStart = newState.isTimerRunning &&
      newState.timerStartedAt &&
      newState.timerVersion != null &&
      newState.timerVersion !== lastTimerVersion;

    if (isNewStart) {
      lastStampedClientTs = newState.timerStartedAt;
      lastTimerVersion = newState.timerVersion;
      state = { ...newState, timerStartedAt: Date.now() };
      serverModified = true;
    } else if (newState.isTimerRunning && gameState && gameState.timerStartedAt) {
      // Not a new start — preserve the server-stamped timerStartedAt
      state = { ...newState, timerStartedAt: gameState.timerStartedAt };
    }

    gameState = state;

    if (serverModified) {
      io.emit('game:state', state);
    } else {
      socket.broadcast.emit('game:state', state);
    }
  });

  socket.on('time:ping', (clientTs) => {
    socket.emit('time:pong', { clientTs, serverTs: Date.now() });
  });

  socket.on('users:update', (newUsers) => {
    usersState = newUsers;
    socket.broadcast.emit('users:state', newUsers);
  });

  socket.on('history:update', (newHistory) => {
    historyState = newHistory;
    socket.broadcast.emit('history:state', newHistory);
  });

  socket.on('disconnect', () => {
    console.log(`[socket] client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`GameBird socket server running on :${PORT}`);
});
