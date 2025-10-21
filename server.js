// server.js - DÜZELTİLMİŞ VERSİYON
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

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
  console.log('✅ Yeni kullanıcı bağlandı:', socket.id);

  // Odaya katılma
  socket.on('join-room', ({ roomCode, username }) => {
    console.log(`📥 ${username} ${roomCode} odasına katılmak istiyor...`);
    
    socket.join(roomCode);
    socket.username = username;
    socket.roomCode = roomCode;

    // Oda yoksa oluştur
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, new Set());
      console.log(`🆕 Yeni oda oluşturuldu: ${roomCode}`);
    }
    
    rooms.get(roomCode).add(username);
    const users = Array.from(rooms.get(roomCode));

    console.log(`✅ ${username} ${roomCode} odasına katıldı. Toplam kullanıcı: ${users.length}`);

    // Kullanıcıya oda bilgisi gönder
    socket.emit('room-joined', { roomCode, users });

    // Diğer kullanıcılara bildir
    socket.to(roomCode).emit('user-joined', { username });
    
    // Güncel kullanıcı listesi
    io.to(roomCode).emit('users-update', { users });
  });

  // Mesaj gönderme
  socket.on('send-message', ({ roomCode, message }) => {
    console.log(`💬 ${socket.username}: ${message}`);
    
    const messageData = {
      username: socket.username,
      message: message,
      timestamp: new Date().toISOString()
    };
    
    // Odadaki herkese (gönderen dahil) mesajı gönder
    io.to(roomCode).emit('new-message', messageData);
  });

  // Yazıyor bildirimi
  socket.on('typing', ({ roomCode }) => {
    socket.to(roomCode).emit('user-typing', { username: socket.username });
  });

  socket.on('stop-typing', ({ roomCode }) => {
    socket.to(roomCode).emit('user-stop-typing', { username: socket.username });
  });

  // Odadan ayrılma
  socket.on('leave-room', ({ roomCode, username }) => {
    console.log(`👋 ${username} ${roomCode} odasından ayrılıyor...`);
    socket.leave(roomCode);
    
    const room = rooms.get(roomCode);
    if (room) {
      room.delete(username);
      const users = Array.from(room);
      
      if (room.size === 0) {
        rooms.delete(roomCode);
        console.log(`🗑️ ${roomCode} odası silindi (boş)`);
      } else {
        io.to(roomCode).emit('users-update', { users });
        socket.to(roomCode).emit('user-left', { username });
      }
    }
  });

  // Bağlantı kopma
  socket.on('disconnect', () => {
    console.log('❌ Kullanıcı ayrıldı:', socket.id);
    
    if (socket.roomCode && socket.username) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        room.delete(socket.username);
        const users = Array.from(room);
        
        if (room.size === 0) {
          rooms.delete(socket.roomCode);
          console.log(`🗑️ ${socket.roomCode} odası silindi (boş)`);
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
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
  console.log(`📱 Tarayıcıda aç ve test et!`);
});
