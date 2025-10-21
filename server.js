const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Statik dosyaları servis et
app.use(express.static('public'));

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Odalar ve mesajlar
const rooms = new Map();

// Oda kodu oluştur
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

io.on('connection', (socket) => {
    console.log('Yeni kullanıcı bağlandı:', socket.id);
    
    // Oda oluşturma
    socket.on('createRoom', (data) => {
        let roomCode = generateRoomCode();
        
        // Benzersiz oda kodu olana kadar dene
        while (rooms.has(roomCode)) {
            roomCode = generateRoomCode();
        }
        
        // Yeni oda oluştur
        rooms.set(roomCode, {
            code: roomCode,
            players: [{
                id: data.playerId,
                name: data.playerName,
                socketId: socket.id
            }],
            messages: [],
            createdAt: Date.now()
        });
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerId = data.playerId;
        
        console.log(`Oda oluşturuldu: ${roomCode} - ${data.playerName}`);
        
        socket.emit('roomCreated', {
            roomCode: roomCode,
            players: rooms.get(roomCode).players
        });
    });
    
    // Odaya katılma
    socket.on('joinRoom', (data) => {
        const roomCode = data.roomCode.toUpperCase();
        
        if (!rooms.has(roomCode)) {
            socket.emit('roomNotFound');
            console.log(`Oda bulunamadı: ${roomCode}`);
            return;
        }
        
        const room = rooms.get(roomCode);
        
        // Oyuncu zaten odada mı kontrol et
        const existingPlayer = room.players.find(p => p.id === data.playerId);
        if (!existingPlayer) {
            room.players.push({
                id: data.playerId,
                name: data.playerName,
                socketId: socket.id
            });
        }
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerId = data.playerId;
        
        console.log(`${data.playerName} odaya katıldı: ${roomCode}`);
        
        // Katılan kişiye bilgi gönder
        socket.emit('roomJoined', {
            roomCode: roomCode,
            players: room.players
        });
        
        // Eski mesajları gönder
        if (room.messages.length > 0) {
            socket.emit('chatHistory', room.messages);
        }
        
        // Diğer oyunculara bildir
        socket.to(roomCode).emit('playersUpdate', room.players);
    });
    
    // Mesaj gönderme
    socket.on('chatMessage', (data) => {
        const roomCode = data.roomCode;
        
        if (!rooms.has(roomCode)) {
            console.log(`Mesaj gönderilemedi - Oda bulunamadı: ${roomCode}`);
            return;
        }
        
        const message = {
            playerId: data.playerId,
            playerName: data.playerName,
            message: data.message,
            timestamp: Date.now()
        };
        
        // Mesajı kaydet
        rooms.get(roomCode).messages.push(message);
        
        // Tüm odaya gönder
        io.to(roomCode).emit('chatMessage', message);
        
        console.log(`[${roomCode}] ${data.playerName}: ${data.message}`);
    });
    
    // Odadan çıkma
    socket.on('leaveRoom', (data) => {
        const roomCode = data.roomCode;
        
        if (!rooms.has(roomCode)) {
            console.log(`Odadan çıkılamadı - Oda bulunamadı: ${roomCode}`);
            return;
        }
        
        const room = rooms.get(roomCode);
        
        // Oyuncuyu listeden çıkar
        room.players = room.players.filter(p => p.id !== data.playerId);
        
        socket.leave(roomCode);
        
        console.log(`${data.playerId} odadan ayrıldı: ${roomCode}`);
        
        // Oda boşsa sil
        if (room.players.length === 0) {
            rooms.delete(roomCode);
            console.log(`Oda silindi (boş kaldı): ${roomCode}`);
        } else {
            // Diğer oyunculara bildir
            io.to(roomCode).emit('playersUpdate', room.players);
        }
    });
    
    // Bağlantı koptuğunda
    socket.on('disconnect', () => {
        console.log('Kullanıcı bağlantısı koptu:', socket.id);
        
        // Kullanıcının olduğu odayı bul
        if (socket.roomCode && socket.playerId) {
            const room = rooms.get(socket.roomCode);
            
            if (room) {
                // Oyuncuyu listeden çıkar
                room.players = room.players.filter(p => p.socketId !== socket.id);
                
                console.log(`${socket.playerId} bağlantısı koptu - Odadan çıkarıldı: ${socket.roomCode}`);
                
                // Oda boşsa sil
                if (room.players.length === 0) {
                    rooms.delete(socket.roomCode);
                    console.log(`Oda silindi (boş kaldı): ${socket.roomCode}`);
                } else {
                    // Diğer oyunculara bildir
                    io.to(socket.roomCode).emit('playersUpdate', room.players);
                }
            }
        }
    });
});

// Oda temizleme (Her 1 saatte bir boş odaları sil)
setInterval(() => {
    const now = Date.now();
    let deletedCount = 0;
    
    rooms.forEach((room, code) => {
        // 1 saatten eski ve boş odaları sil
        if (room.players.length === 0 && (now - room.createdAt) > 3600000) {
            rooms.delete(code);
            deletedCount++;
        }
    });
    
    if (deletedCount > 0) {
        console.log(`${deletedCount} eski oda temizlendi`);
    }
}, 3600000); // Her 1 saat

// Server durumu (her 5 dakikada bir)
setInterval(() => {
    console.log(`📊 Aktif oda sayısı: ${rooms.size}`);
    let totalPlayers = 0;
    rooms.forEach(room => totalPlayers += room.players.length);
    console.log(`👥 Toplam oyuncu: ${totalPlayers}`);
}, 300000); // Her 5 dakika

// Server'ı başlat
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log('═══════════════════════════════════════');
    console.log('🚀 Zahir Chat Sunucusu Başlatıldı!');
    console.log('═══════════════════════════════════════');
    console.log(`📡 Sunucu adresi: http://localhost:${PORT}`);
    console.log(`⏰ Başlangıç zamanı: ${new Date().toLocaleString('tr-TR')}`);
    console.log('═══════════════════════════════════════');
});
