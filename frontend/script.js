let localStream;
let peerConnection;
let socket;
let currentUser = {};
let remotePeerId = null;

const servers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

// HTML elementlerini seçiyoruz
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const findMatchBtn = document.getElementById('findMatchBtn');
const disconnectBtn = document.getElementById('disconnectBtn');

async function init() {
    // Socket bağlantısı
    socket = io();

    // Socket kimliği al
    socket.on("yourID", (id) => {
        currentUser.socketId = id;
        console.log("Socket ID:", id);
    });

    // Eşleşme bulunduğunda
    socket.on("matchFound", async (data) => {
        console.log("Eşleşme bulundu:", data);

        remotePeerId = data.user2 === currentUser.socketId ? data.user1 : data.user2;

        // Eğer ben user1'im, peer connection başlat
        if (data.user1 === currentUser.socketId) {
            await setupPeerConnection(true);
        }
    });

    // Gelen sinyali işle
    socket.on("callMade", async (data) => {
        await receiveCall(data.signal, data.from);
    });
}

// Peer bağlantısını başlat
async function setupPeerConnection(isInitiator) {
    peerConnection = new RTCPeerConnection(servers);

    // Lokal video stream
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Karşı tarafın videosunu al
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // ICE candidate gönder
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && peerConnection.remoteDescription) {
            socket.emit('callUser', {
                userToCall: remotePeerId,
                signalData: event.candidate,
                from: currentUser.socketId
            });
        }
    };

    if (isInitiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit('callUser', {
            userToCall: remotePeerId,
            signalData: offer,
            from: currentUser.socketId
        });
    }
}

// Gelen çağrıyı işle
async function receiveCall(signal, from) {
    if (signal.type === "offer") {
        await setupPeerConnection(false);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('callUser', {
            userToCall: from,
            signalData: answer,
            from: currentUser.socketId
        });
    } else if (signal.type === "answer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (signal.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal));
    }
}

// Bağlantıyı kes
function disconnectCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
    }
    remotePeerId = null;
    console.log("Bağlantı kesildi.");
}

// --- Butonlar ---
findMatchBtn.addEventListener('click', () => {
    if (!socket) {
        alert("Lütfen önce giriş yapın!");
        return;
    }
    console.log("Eşleşme aranıyor...");
    if (peerConnection) peerConnection.close();
    remoteVideo.srcObject = null;
    remotePeerId = null;
    socket.emit("findMatch");
});

disconnectBtn.addEventListener('click', disconnectCall);

// Sayfa açıldığında başlat
init();
