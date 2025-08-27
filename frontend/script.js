// Login kontrolü
document.getElementById("loginBtn").addEventListener("click", () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (username === "test" && password === "1234") {
    document.getElementById("login-container").classList.add("hidden");
    document.getElementById("chat-container").classList.remove("hidden");
    initVideo();
  } else {
    alert("Hatalı kullanıcı adı veya şifre!");
  }
});

// WebRTC değişkenleri
let localStream;
let peerConnection;
const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Video başlat
async function initVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = localStream;
  } catch (err) {
    console.error("Kamera/mikrofon hatası:", err);
  }
}

// Arkadaş ekle butonu
document.getElementById("addFriendBtn").addEventListener("click", () => {
  alert("Arkadaş ekleme özelliği yakında aktif olacak!");
});

// Yeni bağlantı kur
document.getElementById("startCallBtn").addEventListener("click", async () => {
  peerConnection = new RTCPeerConnection(servers);

  // Lokal stream ekle
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Remote video
  peerConnection.ontrack = (event) => {
    document.getElementById("remoteVideo").srcObject = event.streams[0];
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  console.log("Teklif oluşturuldu:", offer);
  alert("Bağlantı için karşı tarafa SDP teklifini gönderin (şimdilik elle).");
});

// Bağlantıyı kes
document.getElementById("endCallBtn").addEventListener("click", () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    alert("Bağlantı sonlandırıldı.");
  }
});
