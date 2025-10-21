const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "https://b-fawn-nine.vercel.app",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Ana sayfa - test için
app.get('/', (req, res) => {
  res.send('✅ Zahir Chat Backend Çalışıyor!');
});

// Odaları ve kullanıcıları saklama
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('✅ Yeni kullanıcı bağlandı:', socket.id);

  socket.on('join-room', ({ roomCode, username }) => {
    console.log(`📥 ${username} ${roomCode} odasına katılıyor...`);
    
    socket.join(roomCode);
    socket.username = username;
    socket.roomCode = roomCode;

    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, new Set());
      console.log(`🆕 Yeni oda oluşturuldu: ${roomCode}`);
    }
    
    rooms.get(roomCode).add(username);
    const users = Array.from(rooms.get(roomCode));

    console.log(`✅ ${username} ${roomCode} odasına katıldı. Kullanıcılar:`, users);

    socket.emit('room-joined', { roomCode, users });
    socket.to(roomCode).emit('user-joined', { username });
    io.to(roomCode).emit('users-update', { users });
  });

  socket.on('send-message', ({ roomCode, message }) => {
    console.log(`💬 ${socket.username}: ${message}`);
    
    const messageData = {
      username: socket.username,
      message: message,
      timestamp: new Date().toISOString()
    };
    
    io.to(roomCode).emit('new-message', messageData);
  });

  socket.on('typing', ({ roomCode }) => {
    socket.to(roomCode).emit('user-typing', { username: socket.username });
  });

  socket.on('stop-typing', ({ roomCode }) => {
    socket.to(roomCode).emit('user-stop-typing', { username: socket.username });
  });

  socket.on('leave-room', ({ roomCode, username }) => {
    console.log(`👋 ${username} ${roomCode} odasından ayrılıyor`);
    
    socket.leave(roomCode);
    
    const room = rooms.get(roomCode);
    if (room) {
      room.delete(username);
      const users = Array.from(room);
      
      if (room.size === 0) {
        rooms.delete(roomCode);
        console.log(`🗑️ ${roomCode} odası silindi`);
      } else {
        io.to(roomCode).emit('users-update', { users });
        socket.to(roomCode).emit('user-left', { username });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Kullanıcı ayrıldı:', socket.id);
    
    if (socket.roomCode && socket.username) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        room.delete(socket.username);
        const users = Array.from(room);
        
        if (room.size === 0) {
          rooms.delete(socket.roomCode);
          console.log(`🗑️ ${socket.roomCode} odası silindi`);
        } else {
          io.to(socket.roomCode).emit('users-update', { users });
          socket.to(socket.roomCode).emit('user-left', { username: socket.username });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: Port ${PORT}`);
});
