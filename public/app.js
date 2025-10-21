// Global değişkenler
let socket = io();
let currentUser = '';
let currentRoom = '';
let playerId = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// DOM elementleri
const loginScreen = document.getElementById('loginScreen');
const roomScreen = document.getElementById('roomScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const chatScreen = document.getElementById('chatScreen');

const usernameInput = document.getElementById('usernameInput');
const loginBtn = document.getElementById('loginBtn');
const welcomeName = document.getElementById('welcomeName');

const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const backToLoginBtn = document.getElementById('backToLoginBtn');

const currentRoomCode = document.getElementById('currentRoomCode');
const chatRoomCode = document.getElementById('chatRoomCode');
const playersList = document.getElementById('playersList');
const startChatBtn = document.getElementById('startChatBtn');
const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');

const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const leaveChatBtn = document.getElementById('leaveChatBtn');

// Ekran geçişleri
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// Giriş ekranı
loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Lütfen isminizi girin!');
        return;
    }
    currentUser = username;
    welcomeName.textContent = username;
    showScreen(roomScreen);
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

// Geri dön butonu
backToLoginBtn.addEventListener('click', () => {
    showScreen(loginScreen);
    usernameInput.value = '';
});

// Oda oluşturma
createRoomBtn.addEventListener('click', () => {
    socket.emit('createRoom', {
        playerId: playerId,
        playerName: currentUser
    });
});

// Odaya katılma
joinRoomBtn.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code || code.length !== 4) {
        alert('Lütfen 4 haneli oda kodunu girin!');
        return;
    }
    socket.emit('joinRoom', {
        roomCode: code,
        playerId: playerId,
        playerName: currentUser
    });
});

roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoomBtn.click();
});

// Oda kodunu kopyalama
copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoom);
    copyCodeBtn.textContent = '✓ Kopyalandı!';
    setTimeout(() => {
        copyCodeBtn.textContent = '📋 Kopyala';
    }, 2000);
});

// Sohbeti başlatma
startChatBtn.addEventListener('click', () => {
    showScreen(chatScreen);
    chatRoomCode.textContent = currentRoom;
});

// Lobbyden çıkma
leaveLobbyBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', {
        roomCode: currentRoom,
        playerId: playerId
    });
    showScreen(roomScreen);
    roomCodeInput.value = '';
});

// Mesaj gönderme
sendMessageBtn.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (!message) return;
    
    socket.emit('chatMessage', {
        roomCode: currentRoom,
        playerId: playerId,
        playerName: currentUser,
        message: message
    });
    
    messageInput.value = '';
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessageBtn.click();
});

// Chattan çıkma
leaveChatBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', {
        roomCode: currentRoom,
        playerId: playerId
    });
    showScreen(roomScreen);
    chatMessages.innerHTML = '';
    roomCodeInput.value = '';
});

// Mesaj ekleme fonksiyonu
function addMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const time = new Date(data.timestamp).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <span class="message-time">${time}</span>
        <span class="message-sender">${data.playerName}:</span>
        <span class="message-text">${data.message}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Oyuncu listesini güncelleme
function updatePlayersList(players) {
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        playersList.appendChild(li);
    });
}

// Socket.IO event listeners
socket.on('roomCreated', (data) => {
    currentRoom = data.roomCode;
    currentRoomCode.textContent = data.roomCode;
    updatePlayersList(data.players);
    showScreen(lobbyScreen);
});

socket.on('roomJoined', (data) => {
    currentRoom = data.roomCode;
    currentRoomCode.textContent = data.roomCode;
    updatePlayersList(data.players);
    showScreen(lobbyScreen);
});

socket.on('roomNotFound', () => {
    alert('Oda bulunamadı! Lütfen oda kodunu kontrol edin.');
    roomCodeInput.value = '';
});

socket.on('playersUpdate', (players) => {
    updatePlayersList(players);
});

socket.on('chatMessage', (data) => {
    addMessage(data);
});

socket.on('chatHistory', (messages) => {
    messages.forEach(msg => addMessage(msg));
});
