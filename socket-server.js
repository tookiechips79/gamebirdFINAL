import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

let gameState = null;
let usersState = null;
let historyState = null;

// Track the client's timerStartedAt we last stamped, so we only replace it once per start
let lastStampedClientTs = null;

io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id} (${io.engine.clientsCount} total)`);

  if (gameState) socket.emit('game:state', gameState);
  if (usersState) socket.emit('users:state', usersState);
  if (historyState) socket.emit('history:state', historyState);

  socket.on('game:update', (newState) => {
    let state = newState;
    let serverModified = false;

    // When the timer starts (or restarts), replace timerStartedAt with the server's
    // own clock. This way every client measures elapsed against the same reference
    // regardless of how their device clocks differ.
    if (newState.isTimerRunning && newState.timerStartedAt &&
        newState.timerStartedAt !== lastStampedClientTs) {
      lastStampedClientTs = newState.timerStartedAt;
      state = { ...newState, timerStartedAt: Date.now() };
      serverModified = true;
    }

    gameState = state;

    if (serverModified) {
      // Echo corrected state back to ALL clients including sender
      io.emit('game:state', state);
    } else {
      // Normal relay: skip sender to avoid redundant state application
      socket.broadcast.emit('game:state', state);
    }
  });

  // NTP-lite: lets clients calculate their clock offset to this server
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
