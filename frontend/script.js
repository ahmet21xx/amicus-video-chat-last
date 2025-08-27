document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const loginWrapper = document.getElementById("login-wrapper");
  const videoChatWrapper = document.getElementById("video-chat-wrapper");
  const welcomeMessage = document.getElementById("welcomeMessage");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (username && password) {
      // Hoş geldin mesajı
      welcomeMessage.textContent = `Hoş geldin, ${username}`;

      // Login ekranını kapat
      loginWrapper.style.display = "none";
      // Video chat ekranını aç
      videoChatWrapper.style.display = "block";

      // Kamerayı başlat
      startVideoChat();
    } else {
      alert("Lütfen kullanıcı adı ve şifre giriniz.");
    }
  });
});

// Kamera başlatma
async function startVideoChat() {
  try {
    const localVideo = document.getElementById("localVideo");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
  } catch (err) {
    console.error("Kamera/Mikrofon hatası:", err);
    alert("Kamera veya mikrofon erişimi reddedildi!");
  }
}
