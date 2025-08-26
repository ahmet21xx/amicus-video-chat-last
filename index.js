const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");

const app = express();
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
