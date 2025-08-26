// HTML elementleri
const registerContainer = document.getElementById('registerContainer');
const loginContainer = document.getElementById('loginContainer');
const chatContainer = document.getElementById('chatContainer');
const registerUsername = document.getElementById('registerUsername');
const registerPassword = document.getElementById('registerPassword');
const registerBtn = document.getElementById('registerBtn');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const goToLogin = document.getElementById('goToLogin');
const goToRegister = document.getElementById('goToRegister');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const findMatchBtn = document.getElementById('findMatchBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const friendInput = document.getElementById('friendInput');
const addFriendBtn = document.getElementById('addFriendBtn');
const currentUserIdDisplay = document.getElementById('currentUserId');
const friendsListContainer = document.getElementById('friendsList');

let localStream, peerConnection, socket;
let remotePeerId = null;
let currentUser = null;

const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};
const backendUrl = 'https://amicus-video-chat-last.onrender.com';

// Başlangıç ekranı
function showInitialScreen() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        loginContainer.style.display = 'none';
        registerContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        currentUserIdDisplay.textContent = currentUser.id;
        init();
        updateFriendsList();
    } else {
        registerContainer.style.display = 'none';
        loginContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
    }
}
showInitialScreen();

// Ekran geçişleri
goToLogin.addEventListener('click', e => {
    e.preventDefault();
    registerContainer.style.display = 'none';
    loginContainer.style.display = 'flex';
});
goToRegister.addEventListener('click', e => {
    e.preventDefault();
    loginContainer.style.display = 'none';
    registerContainer.style.display = 'flex';
});

// Kayıt işlemi
registerBtn.addEventListener('click', async () => {
    const username = registerUsername.value.trim();
    const password = registerPassword.value.trim();
    if (!username || !password) return alert('Lütfen kullanıcı adı ve şifre girin.');

    try {
        const response = await fetch(`${backendUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Kayıt başarılı! Giriş yapabilirsiniz.');
            registerContainer.style.display = 'none';
            loginContainer.style.display = 'flex';
        } else alert('Kayıt başarısız: ' + data.message);
    } catch (err) {
        console.error(err);
        alert('Kayıt sırasında hata oluştu.');
    }
});

// Giriş işlemi
loginBtn.addEventListener('click', async () => {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) return alert('Lütfen kullanıcı adı ve şifre girin.');

    try {
        const response = await fetch(`${backendUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            loginContainer.style.display = 'none';
            chatContainer.style.display = 'flex';
            currentUserIdDisplay.textContent = currentUser.id;
            await init();
            updateFriendsList();
        } else {
            alert('Giriş başarısız: ' + data.message);
        }
    } catch (err) {
        console.error(err);
        alert('Giriş sırasında hata oluştu.');
    }
});

// WebRTC ve Socket.io başlat
async function init() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        socket = io(backendUrl, { query: { userId: currentUser.id } });

        socket.on('connect', () => console.log('Sunucuya bağlandı', socket.id));

        socket.on('matchFound', data => {
            remotePeerId = data.partnerId;
            if (remotePeerId < socket.id) setupPeerConnection(true);
        });

        socket.on('receiveCall', async data => {
            await setupPeerConnection(false);
            if (data.signal) {
                try {
                    if (data.signal.type === 'offer' || data.signal.type === 'answer') {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
                        if (data.signal.type === 'offer') {
                            const answer = await peerConnection.createAnswer();
                            await peerConnection.setLocalDescription(answer);
                            socket.emit('callUser', { userToCall: data.from, signalData: answer, from: socket.id });
                        }
                    } else if (data.signal.candidate) {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal));
                    }
                } catch (e) {
                    console.error('Sinyal işlenirken hata:', e);
                }
            }
        });

        socket.on('callAccepted', async signal => {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        });

    } catch (e) {
        console.error('Medya akışı hatası:', e);
        alert('Kamera ve mikrofon erişimi gerekli!');
    }
}

// PeerConnection kur
async function setupPeerConnection(isCaller) {
    if (peerConnection) peerConnection.close();
    peerConnection = new RTCPeerConnection(iceServers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => { remoteVideo.srcObject = event.streams[0]; };
    peerConnection.onicecandidate = event => {
        if (event.candidate && remotePeerId) {
            socket.emit('callUser', { userToCall: remotePeerId, signalData: event.candidate, from: socket.id });
        }
    };

    if (isCaller) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('callUser', { userToCall: remotePeerId, signalData: offer, from: socket.id });
    }
}

// Eşleşme bul
findMatchBtn.addEventListener('click', () => {
    if (!socket) return alert('Lütfen giriş yapın!');
    if (peerConnection) peerConnection.close();
    remoteVideo.srcObject = null;
    remotePeerId = null;
    socket.emit('findMatch');
});

// Bağlantıyı kes
disconnectBtn.addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        remoteVideo.srcObject = null;
        remotePeerId = null;
        console.log('Bağlantı kesildi');
    }
});

// Arkadaş ekleme
addFriendBtn.addEventListener('click', async () => {
    if (!currentUser) return alert('Önce giriş yapın.');
    const friendId = parseInt(friendInput.value.trim());
    if (isNaN(friendId)) return alert('Geçerli ID girin.');
    if (friendId === currentUser.id) return alert('Kendinizi ekleyemezsiniz.');

    try {
        const response = await fetch(`${backendUrl}/add-friend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromId: currentUser.id, toId: friendId })
        });
        const data = await response.json();
        alert(data.message);
        if (response.ok) updateFriendsList();
    } catch (err) {
        console.error('Arkadaş ekleme hatası:', err);
        alert('Hata oluştu.');
    }
});

// Arkadaş listesini güncelle
async function updateFriendsList() {
    if (!currentUser) return;
    try {
        const response = await fetch(`${backendUrl}/friends/${currentUser.id}`);
        const data = await response.json();
        if (response.ok) {
            friendsListContainer.innerHTML = '';
            data.friends.forEach(friend => {
                const li = document.createElement('li');
                li.textContent = friend.username;
                li.addEventListener('click', () => startCallWithFriend(friend.id));
                friendsListContainer.appendChild(li);
            });
        }
    } catch (err) {
        console.error('Arkadaş listesi çekilemedi:', err);
    }
}

// Arkadaşla çağrı başlat
async function startCallWithFriend(friendId) {
    if (!socket) return alert('Lütfen giriş yapın!');
    if (peerConnection) peerConnection.close();
    remoteVideo.srcObject = null;
    try {
        const response = await fetch(`${backendUrl}/get-user-socket-id/${friendId}`);
        if (!response.ok) { alert((await response.json()).message); return; }
        const data = await response.json();
        const friendSocketId = data.socketId;
        if (!friendSocketId) return alert('Arkadaş çevrimdışı.');
        remotePeerId = friendSocketId;
        await setupPeerConnection(true);
        console.log(`Arkadaşa arama başlatılıyor: ID ${friendId}, Socket ID ${friendSocketId}`);
    } catch (err) { console.error('Arkadaş socket ID hatası:', err); alert('Hata oluştu.'); }
}
