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
const sendLikeBtn = document.getElementById('sendLikeBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const likeAnimation = document.getElementById('likeAnimation');
const friendInput = document.getElementById('friendInput');
const addFriendBtn = document.getElementById('addFriendBtn');
const messageInput = document.getElementById('message');
const sendMessageBtn = document.getElementById('sendMessage');
const currentUserIdDisplay = document.getElementById('currentUserId');
const friendsListContainer = document.getElementById('friendsList');

let localStream, remoteStream, peerConnection, socket;
let remotePeerId = null;
let currentUser = null; 

// WebRTC STUN Sunucusu Ayarları
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

// Backend URL'si
const backendUrl = 'https://amicus-video-chat-last.onrender.com';

// Sayfa yüklenince önce kayıt ekranı göster
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

// Kayıt ekranı -> Login ekranı
goToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerContainer.style.display = 'none';
    loginContainer.style.display = 'flex';
});

// Login ekranı -> Kayıt ekranı
goToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginContainer.style.display = 'none';
    registerContainer.style.display = 'flex';
});

// Kayıt butonu
registerBtn.addEventListener('click', async () => {
    const username = registerUsername.value.trim();
    const password = registerPassword.value.trim();
    if (!username || !password) {
        alert('Lütfen kullanıcı adı ve şifre girin.');
        return;
    }
    try {
        const response = await fetch(`${backendUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Kayıt başarılı! Lütfen giriş yapın.');
            registerContainer.style.display = 'none';
            loginContainer.style.display = 'flex';
        } else {
            alert('Kayıt başarısız: ' + data.message);
        }
    } catch (err) {
        console.error(err);
        alert('Kayıt sırasında bir hata oluştu.');
    }
});

// Login butonu
loginBtn.addEventListener('click', async () => {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) {
        alert('Lütfen kullanıcı adı ve şifre girin.');
        return;
    }
    try {
        const response = await fetch(`${backendUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Giriş başarılı!');
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            loginContainer.style.display = 'none';
            chatContainer.style.display = 'flex';
            currentUserIdDisplay.textContent = currentUser.id;
            init();
            updateFriendsList(); 
        } else {
            alert('Giriş başarısız: ' + data.message);
        }
    } catch (err) {
        console.error(err);
        alert('Giriş sırasında bir hata oluştu.');
    }
});

// init fonksiyonu
async function init() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        socket = io(backendUrl, {
            query: { userId: currentUser.id }
        });

        socket.on('connect', () => {
            console.log('Sunucuya bağlandı, ID:', socket.id);
        });

        socket.on('yourId', (id) => {
            currentUser.socketId = id;
            console.log("Kendi Socket ID'm:", currentUser.socketId);
        });

        socket.on('matchFound', (data) => {
            remotePeerId = data.partnerId;
            console.log("Eşleşme bulundu, partner ID:", remotePeerId);
            
            if (remotePeerId < currentUser.socketId) {
                console.log("Eşleşmeyi başlatan: Ben");
                setupPeerConnection(true);
            }
        });
        
        socket.on('receiveCall', async (data) => {
            console.log("Gelen arama:", data);
            await setupPeerConnection(false); // setupPeerConnection artık async
            try {
                if (data.signal.type === 'offer') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.emit('acceptCall', { signal: answer, to: data.from });
                } else if (data.signal.type === 'candidate') {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal));
                }
            } catch (e) {
                console.error("Gelen sinyal verisi işlenirken hata oluştu:", e);
            }
        });

        socket.on('callAccepted', async (signal) => {
            console.log("Arama kabul edildi.");
            await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        });

    } catch (e) {
        console.error('Medya akışı hatası:', e);
        alert('Kamera ve mikrofon erişimi gerekli!');
    }
}

// PeerConnection'ı kuran fonksiyon
async function setupPeerConnection(isCaller) {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    peerConnection = new RTCPeerConnection(iceServers);
    
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('callUser', {
                userToCall: remotePeerId,
                signalData: event.candidate,
                from: currentUser.socketId
            });
        }
    };
    
    if (isCaller) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('callUser', {
            userToCall: remotePeerId,
            signalData: offer,
            from: currentUser.socketId
        });
    }
}

// Yeni Eşleşme Bul butonu
findMatchBtn.addEventListener('click', async () => {
    if (!socket) {
        alert('Lütfen önce giriş yapın!');
        return;
    }
    console.log("Eşleşme aranıyor...");
    if (peerConnection) peerConnection.close();
    remoteVideo.srcObject = null;
    remotePeerId = null;

    await init();
    socket.emit('findMatch');
});

// Bağlantıyı kesme butonu
disconnectBtn.addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        remoteVideo.srcObject = null;
        remotePeerId = null;
        console.log("Bağlantı kesildi.");
    }
});


// Arkadaş Ekleme butonu
addFriendBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert('Lütfen önce giriş yapın!');
        return;
    }

    const friendId = parseInt(friendInput.value.trim());

    if (isNaN(friendId)) {
        alert('Lütfen geçerli bir ID girin.');
        return;
    }

    if (friendId === currentUser.id) {
        alert('Kendinizi arkadaş olarak ekleyemezsiniz.');
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/add-friend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromId: currentUser.id, toId: friendId })
        });
        const data = await response.json();
        alert(data.message);

        if (response.ok) {
            updateFriendsList();
        }
    } catch (err) {
        console.error("Arkadaş ekleme hatası:", err);
        alert('Arkadaşlık isteği gönderilirken bir hata oluştu.');
    }
});


// Arkadaş listesini güncelleyen fonksiyon
async function updateFriendsList() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${backendUrl}/friends/${currentUser.id}`);
        const data = await response.json();

        if (response.ok) {
            friendsListContainer.innerHTML = '';
            data.friends.forEach(friend => {
                const friendItem = document.createElement('li');
                friendItem.textContent = friend.username;
                friendItem.addEventListener('click', () => startCallWithFriend(friend.id));
                friendsListContainer.appendChild(friendItem);
            });
        }
    } catch (err) {
        console.error("Arkadaş listesi çekilemedi:", err);
    }
}

// Arkadaşa görüntülü arama başlatan fonksiyon
async function startCallWithFriend(friendId) {
    if (!socket) {
        alert('Lütfen önce giriş yapın!');
        return;
    }

    if (peerConnection) {
        peerConnection.close();
    }
    remoteVideo.srcObject = null;

    try {
        const response = await fetch(`${backendUrl}/get-user-socket-id/${friendId}`);
        if (!response.ok) {
            const error = await response.json();
            alert(error.message);
            return;
        }
        const data = await response.json();
        const friendSocketId = data.socketId;

        if (!friendSocketId) {
            alert('Arkadaşınız şu anda çevrimdışı.');
            return;
        }

        remotePeerId = friendSocketId;
        await setupPeerConnection(true);

        console.log(`Arkadaşa arama başlatılıyor: ID ${friendId}, Socket ID ${friendSocketId}`);

    } catch (err) {
        console.error("Arkadaş socket ID'si alınırken hata oluştu:", err);
        alert('Arkadaşınıza bağlanırken bir hata oluştu.');
    }
}
