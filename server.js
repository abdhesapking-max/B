const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Veritabanı yerine geçici hafıza
const users = new Map(); // email -> {password, verified, verificationCode}
const rooms = new Map(); // roomCode -> {users: Set}

// Static dosyaları sunmak için
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io bağlantıları
io.on('connection', (socket) => {
    console.log('Yeni kullanıcı bağlandı:', socket.id);

    // Kayıt işlemi
    socket.on('register', (data) => {
        const { email, password } = data;

        if (users.has(email)) {
            socket.emit('registerError', 'Bu e-posta zaten kayıtlı!');
            return;
        }

        // 6 haneli doğrulama kodu oluştur
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        users.set(email, {
            password: password,
            verified: false,
            verificationCode: verificationCode
        });

        console.log(`Kayıt: ${email}, Kod: ${verificationCode}`);
        
        // Normalde e-posta gönderilir, burada demo için kodu gönderiyoruz
        socket.emit('registerSuccess', { 
            email: email,
            code: verificationCode // DEMO İÇİN - Gerçek uygulamada e-posta ile gönderilir
        });
    });

    // Doğrulama işlemi
    socket.on('verify', (data) => {
        const { email, code } = data;

        if (!users.has(email)) {
            socket.emit('verifyError', 'Kullanıcı bulunamadı!');
            return;
        }

        const user = users.get(email);

        if (user.verificationCode !== code) {
            socket.emit('verifyError', 'Yanlış doğrulama kodu!');
            return;
        }

        user.verified = true;
        users.set(email, user);
        
        console.log(`Doğrulandı: ${email}`);
        socket.emit('verifySuccess');
    });

    // Giriş işlemi
    socket.on('login', (data) => {
        const { email, password } = data;

        if (!users.has(email)) {
            socket.emit('loginError', 'Kullanıcı bulunamadı!');
            return;
        }

        const user = users.get(email);

        if (!user.verified) {
            socket.emit('loginError', 'Lütfen önce e-postanızı doğrulayın!');
            return;
        }

        if (user.password !== password) {
            socket.emit('loginError', 'Yanlış şifre!');
            return;
        }

        socket.email = email;
        console.log(`Giriş: ${email}`);
        socket.emit('loginSuccess', { email: email });
    });

    // Oda oluştur
    socket.on('createRoom', (data) => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        rooms.set(roomCode, {
            users: new Set([socket.email])
        });

        socket.join(roomCode);
        socket.roomCode = roomCode;

        console.log(`Oda oluşturuldu: ${roomCode} - ${socket.email}`);
        socket.emit('roomCreated', { roomCode: roomCode });
    });

    // Odaya katıl
    socket.on('joinRoom', (data) => {
        const { roomCode } = data;

        if (!rooms.has(roomCode)) {
            socket.emit('roomError', 'Oda bulunamadı!');
            return;
        }

        const room = rooms.get(roomCode);
        room.users.add(socket.email);
        
        socket.join(roomCode);
        socket.roomCode = roomCode;

        console.log(`Odaya katıldı: ${roomCode} - ${socket.email}`);
        
        // Odadaki diğer kullanıcılara bildir
        socket.to(roomCode).emit('userJoined', { email: socket.email });
        
        socket.emit('joinedRoom', { roomCode: roomCode });
    });

    // Mesaj gönder
    socket.on('sendMessage', (data) => {
        const { roomCode, message } = data;

        if (!rooms.has(roomCode)) {
            socket.emit('roomError', 'Oda bulunamadı!');
            return;
        }

        console.log(`Mesaj [${roomCode}] ${socket.email}: ${message}`);

        // Odadaki herkese (gönderen dahil) mesajı ilet
        io.to(roomCode).emit('newMessage', {
            email: socket.email,
            message: message,
            timestamp: new Date()
        });
    });

    // Odadan çık
    socket.on('leaveRoom', (data) => {
        const { roomCode } = data;

        if (rooms.has(roomCode)) {
            const room = rooms.get(roomCode);
            room.users.delete(socket.email);

            // Oda boşsa sil
            if (room.users.size === 0) {
                rooms.delete(roomCode);
                console.log(`Oda silindi: ${roomCode}`);
            }
        }

        socket.leave(roomCode);
        socket.roomCode = null;
        console.log(`Odadan çıktı: ${roomCode} - ${socket.email}`);
    });

    // Bağlantı koptuğunda
    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı:', socket.id);

        if (socket.roomCode && rooms.has(socket.roomCode)) {
            const room = rooms.get(socket.roomCode);
            room.users.delete(socket.email);

            if (room.users.size === 0) {
                rooms.delete(socket.roomCode);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
    console.log(`Server çalışıyor: http://localhost:${PORT}`);
});
