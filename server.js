const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Odaları ve kullanıcıları saklama
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Yeni kullanıcı bağlandı:', socket.id);

  // Odaya katılma
  socket.on('join-room', ({ roomCode, username }) => {
    socket.join(roomCode);
    socket.username = username;
    socket.roomCode = roomCode;

    // Oda yoksa oluştur
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, new Set());
    }
    
    rooms.get(roomCode).add(username);
    const users = Array.from(rooms.get(roomCode));

    // Kullanıcıya oda bilgisi gönder
    socket.emit('room-joined', { roomCode, users });

    // Diğer kullanıcılara bildir
    socket.to(roomCode).emit('user-joined', { username });
    
    // Güncel kullanıcı listesi
    io.to(roomCode).emit('users-update', { users });

    console.log(`${username} ${roomCode} odasına katıldı`);
  });

  // Mesaj gönderme
  socket.on('send-message', ({ roomCode, message }) => {
    const messageData = {
      username: socket.username,
      message: message,
      timestamp: new Date().toISOString()
    };
    
    // Odadaki herkese (gönderen dahil) mesajı gönder
    io.to(roomCode).emit('new-message', messageData);
    console.log(`${socket.username}: ${message}`);
  });

  // Yazıyor bildirimi
  socket.on('typing', ({ roomCode }) => {
    socket.to(roomCode).emit('user-typing', { username: socket.username });
  });

  socket.on('stop-typing', ({ roomCode }) => {
    socket.to(roomCode).emit('user-stop-typing', { username: socket.username });
  });

  // Bağlantı kopma
  socket.on('disconnect', () => {
    if (socket.roomCode && socket.username) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        room.delete(socket.username);
        const users = Array.from(room);
        
        // Oda boşsa sil
        if (room.size === 0) {
          rooms.delete(socket.roomCode);
        } else {
          io.to(socket.roomCode).emit('users-update', { users });
        }
        
        socket.to(socket.roomCode).emit('user-left', { username: socket.username });
      }
    }
    console.log('Kullanıcı ayrıldı:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
});
