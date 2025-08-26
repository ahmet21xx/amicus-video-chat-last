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
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

const backendUrl = 'https://amicus-video-chat-last.onrender.com';

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

registerBtn.addEventListener('click', async () => {
    const username = registerUsername.value.trim();
    const password = registerPassword.value.trim();
    if (!username || !password) { alert('Lütfen kullanıcı adı ve şifre girin.'); return; }

    try {
        const res = await fetch(`${backendUrl}/register`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username,password})
        });
        const data = await res.json();
        if(res.ok){
            alert('Kayıt başarılı! Lütfen giriş yapın.');
            registerContainer.style.display='none';
            loginContainer.style.display='flex';
        } else { alert('Kayıt başarısız: '+data.message); }
    } catch(err){ console.error(err); alert('Kayıt sırasında bir hata oluştu.'); }
});

loginBtn.addEventListener('click', async () => {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) { alert('Lütfen kullanıcı adı ve şifre girin.'); return; }

    try {
        const res = await fetch(`${backendUrl}/login`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username,password})
        });
        const data = await res.json();
        if(res.ok){
            alert('Giriş başarılı!');
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            loginContainer.style.display='none';
            chatContainer.style.display='flex';
            currentUserIdDisplay.textContent=currentUser.id;
            init();
            updateFriendsList();
        } else { alert('Giriş başarısız: '+data.message); }
    } catch(err){ console.error(err); alert('Giriş sırasında bir hata oluştu.'); }
});

async function init() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
        localVideo.srcObject=localStream;

        socket = io(backendUrl, { query: { userId: currentUser.id } });

        socket.on('connect', () => { console.log('Sunucuya bağlandı, ID:', socket.id); });

        socket.on('yourId', id => { currentUser.socketId=id; });

        socket.on('matchFound', data => {
            remotePeerId = data.partnerId;
            if(remotePeerId<currentUser.socketId){ setupPeerConnection(true); }
        });

        socket.on('receiveCall', async data => {
            await setupPeerConnection(false);
            try{
                if(data.signal.type==='offer'||data.signal.type==='answer'){
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
                    if(data.signal.type==='offer'){
                        const answer=await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);
                        socket.emit('callUser',{userToCall:data.from, signalData:answer, from:currentUser.socketId});
                    }
                } else if(data.signal.candidate){
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal));
                }
            } catch(e){ console.error(e); }
        });

        socket.on('callAccepted', async signal => {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        });

    } catch(e){ console.error('Medya akışı hatası:', e); alert('Kamera ve mikrofon erişimi gerekli!'); }
}

async function setupPeerConnection(isCaller){
    if(peerConnection) peerConnection.close();
    peerConnection = new RTCPeerConnection(iceServers);
    localStream.getTracks().forEach(track=>peerConnection.addTrack(track,localStream));
    peerConnection.ontrack=event=>{ remoteVideo.srcObject=event.streams[0]; };
    peerConnection.onicecandidate=event=>{ if(event.candidate){ socket.emit('callUser',{userToCall:remotePeerId, signalData:event.candidate, from:currentUser.socketId}); } };
    if(isCaller){
        const offer=await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('callUser',{userToCall:remotePeerId, signalData:offer, from:currentUser.socketId});
    }
}

findMatchBtn.addEventListener('click', async ()=>{
    if(!socket){ alert('Lütfen önce giriş yapın!'); return; }
    if(peerConnection) peerConnection.close();
    remoteVideo.srcObject=null;
    remotePeerId=null;
    await init();
    socket.emit('findMatch');
});

disconnectBtn.addEventListener('click', ()=>{
    if(peerConnection){ peerConnection.close(); peerConnection=null; remoteVideo.srcObject=null; remotePeerId=null; }
});

async function updateFriendsList(){
    if(!currentUser) return;
    try{
        const res=await fetch(`${backendUrl}/friends/${currentUser.id}`);
        const data=await res.json();
        if(res.ok){
            friendsListContainer.innerHTML='';
            data.friends.forEach(friend=>{
                const li=document.createElement('li');
                li.textContent=friend.username;
                li.addEventListener('click',()=>startCallWithFriend(friend.id));
                friendsListContainer.appendChild(li);
            });
        }
    }catch(err){ console.error(err); }
}

async function startCallWithFriend(friendId){
    if(!socket){ alert('Lütfen önce giriş yapın!'); return; }
    if(peerConnection) peerConnection.close();
    remoteVideo.srcObject=null;
    try{
        const res=await fetch(`${backendUrl}/get-user-socket-id/${friendId}`);
        if(!res.ok){ alert((await res.json()).message); return; }
        const data=await res.json();
        const friendSocketId=data.socketId;
        if(!friendSocketId){ alert('Arkadaşınız şu anda çevrimdışı.'); return; }
        remotePeerId=friendSocketId;
        await setupPeerConnection(true);
    }catch(err){ console.error(err); alert('Arkadaşınıza bağlanırken hata oluştu.'); }
}
