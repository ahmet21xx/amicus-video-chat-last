const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const USERS_FILE = 'users.json';
let nextUserId = 1; 

// Online olan kullanıcıların ID'leri ve Socket ID'lerini tutar
let onlineUsers = {}; 

// Eğer users.json yoksa veya boşsa, başlangıç verilerini oluştur
if (!fs.existsSync(USERS_FILE) || fs.readFileSync(USERS_FILE, 'utf8').trim() === '') {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
} else {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    if (users.length > 0) {
        nextUserId = Math.max(...users.map(u => u.id)) + 1;
    }
}

// Frontend dosyalarını sun
app.use(express.static(path.join(__dirname, 'frontend')));

// Kayıt API'si
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Tüm alanları doldurun.' });
    }

    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ message: 'Bu kullanıcı adı zaten mevcut.' });
    }

    const newUser = {
        id: nextUserId++,
        username,
        password, 
        friends: []
    };
    users.push(newUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users));
    res.json({ message: 'Kayıt başarılı!', user: { id: newUser.id, username: newUser.username } });
});

// Giriş API'si
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Tüm alanları doldurun.' });
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(400).json({ message: 'Kullanıcı adı veya şifre hatalı.' });
    }

    res.json({ message: 'Giriş başarılı!', user: { id: user.id, username: user.username } });
});

// Arkadaşlık isteği gönderme API'si
app.post('/add-friend', (req, res) => {
    const { fromId, toId } = req.body;
    if (!fromId || !toId) {
        return res.status(400).json({ message: 'Eksik kullanıcı bilgisi.' });
    }

    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    const sender = users.find(u => u.id === fromId);
    const receiver = users.find(u => u.id === toId);

    if (!sender || !receiver) {
        return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }
    
    if (sender.friends.includes(toId) || receiver.friends.includes(fromId)) {
        return res.status(400).json({ message: 'Zaten arkadaşsınız.' });
    }
    
    sender.friends.push(toId);
    receiver.friends.push(fromId);

    fs.writeFileSync(USERS_FILE, JSON.stringify(users));
    
    res.json({ message: 'Arkadaşlık isteği başarıyla gönderildi!' });
});

// Arkadaş listesini getirme API'si
app.get('/friends/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }
    
    const friendsList = user.friends.map(friendId => {
        const friend = users.find(u => u.id === friendId);
        return { id: friend.id, username: friend.username };
    });

    res.json({ friends: friendsList });
});

// Kullanıcının Socket ID'sini getirme API'si
app.get('/get-user-socket-id/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const socketId = onlineUsers[userId];
    if (socketId) {
        res.json({ socketId });
    } else {
        res.status(404).json({ message: 'Kullanıcı çevrimdışı veya bulunamadı.' });
    }
});

// Rastgele eşleşme havuzu
let waitingUsers = [];

io.on('connection', (socket) => {
    console.log('Yeni bir kullanıcı bağlandı:', socket.id);
    const userId = socket.handshake.query.userId;
    console.log(`Kullanıcı ID'si: ${userId}`);

    // Kullanıcı ID'si ile Socket ID'sini eşleştirme
    if (userId) {
        onlineUsers[userId] = socket.id;
    }

    // Kullanıcıya kendi ID'sini gönder
    socket.emit('yourId', socket.id);

    // Rastgele eşleşme bulma
    socket.on('findMatch', () => {
        if (waitingUsers.length > 0) {
            const partnerSocketId = waitingUsers.shift(); 
            const partnerSocket = io.sockets.sockets.get(partnerSocketId);

            if (partnerSocket && partnerSocket.connected) {
                console.log(`Eşleşme bulundu: ${socket.id} ve ${partnerSocketId}`);
                socket.emit('matchFound', { partnerId: partnerSocket.id });
                partnerSocket.emit('matchFound', { partnerId: socket.id });
            } else {
                waitingUsers.push(socket.id);
                console.log('Eşleşme bulunamadı, kullanıcı havuza eklendi:', socket.id);
            }
        } else {
            waitingUsers.push(socket.id);
            console.log('Eşleşme bekleniyor, kullanıcı havuza eklendi:', socket.id);
        }
    });

    // WebRTC sinyalizasyon olayları
    socket.on('callUser', (data) => {
        io.to(data.userToCall).emit('receiveCall', { signal: data.signalData, from: data.from });
    });

    socket.on('acceptCall', (data) => {
        io.to(data.to).emit('callAccepted', data.signal);
    });
    
    // Bağlantı kesildiğinde
    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı:', socket.id);
        // Havuzdan kullanıcıyı kaldır
        waitingUsers = waitingUsers.filter(id => id !== socket.id);
        
        // Online kullanıcılar listesinden kaldır
        for (const [userId, socketId] of Object.entries(onlineUsers)) {
            if (socketId === socket.id) {
                delete onlineUsers[userId];
                break;
            }
        }
    });
});

// Sunucuyu başlat (Express ve Socket.IO için)
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Backend çalışıyor: http://localhost:${port}`);
});
