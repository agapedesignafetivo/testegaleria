// ===============================
// CABINE DE FOTOS - CRIS PRODUÇÕES
// (versão com UMA moldura)
// ===============================

const CONFIG = {
  FOTO: { width: 720, height: 1280 }, // 9:16
  VIDEO_FPS: 24,
  MAX_BRILHOS: 15,
  API_URL: 'https://moldurapersonalizadabycriisproducoes-production.up.railway.app/convert',
  // apenas uma moldura
  MOLDURA: 'moldura1.png'
};

// ATALHO
const el = id => document.getElementById(id);

// ELEMENTOS
const video = el('video');
const overlay = el('overlay');
const photoCanvas = el('photoCanvas');
const recordCanvas = el('recordCanvas');
const preview = el('preview');
const statusEl = el('status');
const recIndicator = el('recIndicator');
const recTimeEl = el('recTime');
const brilhosCanvas = el('brilhosCanvas');
const brilhoImg = el('brilhoImg');
const videoPreviewOverlay = el('videoPreviewOverlay');
const videoPreview = el('videoPreview');
const btnDownloadVideo = el('btnDownloadVideo');
const btnRecordAgain = el('btnRecordAgain');

// BOTÕES
const btnCamera = el('btnCamera');
const btnPhoto = el('btnPhoto');
const btnStartRec = el('btnStartRec');
const btnStopRec = el('btnStopRec');
const btnBrilhos = el('btnBrilhos');

const btnGallery = el('btnGallery');
const galleryInput = el('galleryInput');

let galleryImage = null;


const btnDownloadPhoto = el('btnDownloadPhoto');

btnDownloadPhoto.onclick = () => {
  if (!galleryImage) {
    status('Nenhuma foto da galeria selecionada', true);
    return;
  }

  // desenha a foto da galeria no canvas
  const { width, height } = CONFIG.FOTO;
  photoCanvas.width = width;
  photoCanvas.height = height;
  const ctx = photoCanvas.getContext('2d');

  // preenche fundo preto
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // ajusta a imagem proporcionalmente
  const img = galleryImage;
  const imgAspect = img.width / img.height;
  const canvasAspect = width / height;

  let dw, dh, dx, dy;

  if (imgAspect > canvasAspect) {
    dh = height;
    dw = height * imgAspect;
    dx = (width - dw) / 2;
    dy = 0;
  } else {
    dw = width;
    dh = width / imgAspect;
    dx = 0;
    dy = (height - dh) / 2;
  }

  ctx.drawImage(img, dx, dy, dw, dh);

  // aplica a moldura
  ctx.drawImage(overlay, 0, 0, width, height);

  // gera e baixa o arquivo
  const dataUrl = photoCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'foto-galeria-moldura.png';
  a.click();

  status('Foto da galeria salva com moldura');
};




// ESTADO
let stream;
let usingFront = true;
let brilhosAtivos = true;
let brilhos = [];
let drawing = false;
let mediaRecorder = null;
let chunks = [];
let lastVideoUrl = null;
let recTimer = null;
let recStartTime = null;

// garante que a imagem de moldura usada é a do config
overlay.src = CONFIG.MOLDURA;

// ===============================
// STATUS TOPO
// ===============================
function status(msg, erro = false) {
  statusEl.textContent = msg;
  statusEl.style.display = 'inline-block';
  statusEl.style.backgroundColor = erro ? 'rgba(180,0,0,0.7)' : 'rgba(0,0,0,0.6)';
  setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
}

// ===============================
// CÂMERA
// ===============================
async function startCamera() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: usingFront ? 'user' : 'environment' },
      audio: true
    });

    video.srcObject = stream;
    video.style.transform = usingFront ? 'scaleX(-1)' : 'none';

    video.onloadedmetadata = () => {
      initBrilhos();
    };
  } catch (e) {
    console.error(e);
    status('Erro ao acessar câmera/microfone', true);
  }
}

// ===============================
// DESENHO PROPORCIONAL (CROP 9:16)
// ===============================
function drawVideoFit(ctx, video, W, H, mirror) {
  if (video.readyState < 2 || !video.videoWidth) return;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const videoAspect = vw / vh;
  const canvasAspect = W / H;

  let dw, dh, dx, dy;

  if (videoAspect > canvasAspect) {
    dh = H;
    dw = H * videoAspect;
    dx = (W - dw) / 2;
    dy = 0;
  } else {
    dw = W;
    dh = W / videoAspect;
    dx = 0;
    dy = (H - dh) / 2;
  }

  ctx.save();
  if (mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, dx, dy, dw, dh);
  ctx.restore();
}

// ===============================
// FOTO
// ===============================
function takePhoto() {
  if (!stream || video.readyState < 2) {
    status('Aguarde a câmera carregar...', true);
    return;
  }

  const { width, height } = CONFIG.FOTO;
  photoCanvas.width = width;
  photoCanvas.height = height;
  const ctx = photoCanvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  if (galleryImage) {
  // FOTO DA GALERIA
  const img = galleryImage;
  const imgAspect = img.width / img.height;
  const canvasAspect = width / height;

  let dw, dh, dx, dy;

  if (imgAspect > canvasAspect) {
    dh = height;
    dw = height * imgAspect;
    dx = (width - dw) / 2;
    dy = 0;
  } else {
    dw = width;
    dh = width / imgAspect;
    dx = 0;
    dy = (height - dh) / 2;
  }

  ctx.drawImage(img, dx, dy, dw, dh);

} else {
  // FOTO DA CÂMERA (original)
  drawVideoFit(ctx, video, width, height, usingFront);
}

  ctx.drawImage(overlay, 0, 0, width, height);

  const dataUrl = photoCanvas.toDataURL('image/png');
  preview.src = dataUrl;
  preview.style.display = 'block';
  setTimeout(() => preview.style.display = 'none', 3000);
  preview.onclick = () => { preview.style.display = 'none'; };

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'foto-moldura.png';
  a.click();

  status('Foto salva (moldura única)');
}

// ===============================
// VÍDEO (GRAVAÇÃO)
// ===============================
function startRecording() {
  if (!stream || video.readyState < 2) {
    status('Aguarde a câmera carregar...', true);
    return;
  }

  const { width, height } = CONFIG.FOTO;
  recordCanvas.width = width;
  recordCanvas.height = height;
  const ctx = recordCanvas.getContext('2d');

  drawing = true;

  function drawFrame() {
    if (!drawing) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    drawVideoFit(ctx, video, width, height, usingFront);
    ctx.drawImage(overlay, 0, 0, width, height);

    requestAnimationFrame(drawFrame);
  }

  drawFrame();

  const canvasStream = recordCanvas.captureStream(CONFIG.VIDEO_FPS);
  const mixedStream = new MediaStream([...canvasStream.getVideoTracks()]);
  const audioTrack = stream.getAudioTracks()[0];
  if (audioTrack) mixedStream.addTrack(audioTrack);

  chunks = [];
  mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm' });

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    drawing = false;
    const blob = new Blob(chunks, { type: 'video/webm' });
    if (blob.size) {
      sendToServer(blob);
    } else {
      status('Vídeo vazio, tente novamente', true);
    }
  };

  // REC + TEMPO
  recStartTime = Date.now();
  recIndicator.style.display = 'flex';
  recTimeEl.textContent = '00:00';
  if (recTimer) clearInterval(recTimer);
  recTimer = setInterval(() => {
    const diff = Math.floor((Date.now() - recStartTime) / 1000);
    const mm = String(Math.floor(diff / 60)).padStart(2, '0');
    const ss = String(diff % 60).padStart(2, '0');
    recTimeEl.textContent = `${mm}:${ss}`;
  }, 1000);

  mediaRecorder.start(200);
  btnStartRec.style.display = 'none';
  btnStopRec.style.display = 'inline-block';
  status('🔴 Gravando...');
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();

    recIndicator.style.display = 'none';
    if (recTimer) {
      clearInterval(recTimer);
      recTimer = null;
    }

    btnStartRec.style.display = 'inline-block';
    btnStopRec.style.display = 'none';
    status('Processando vídeo...');
  }
}

// ===============================
// ENVIO PARA API (WEBM -> MP4)
// ===============================
async function sendToServer(blob) {
  status('Enviando para conversão...');
  try {
    const formData = new FormData();
    formData.append('video', blob, 'video.webm');

    const resp = await fetch(CONFIG.API_URL, {
      method: 'POST',
      body: formData
    });

    if (!resp.ok) throw new Error('API falhou');

    const mp4Blob = await resp.blob();
    const url = URL.createObjectURL(mp4Blob);

    if (lastVideoUrl) URL.revokeObjectURL(lastVideoUrl);
    lastVideoUrl = url;

    videoPreview.src = url;
    videoPreviewOverlay.style.display = 'flex';
    status('Vídeo pronto (veja o preview)');
  } catch (e) {
    console.error(e);
    status('Erro na conversão', true);
  }
}

// ===============================
// BRILHOS ANIMADOS
// ===============================
function criarBrilho() {
  brilhos.push({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 18 + 12,
    opacity: Math.random() * 0.5 + 0.5,
    dx: (Math.random() - 0.5) * 0.25,
    dy: (Math.random() - 0.5) * 0.25,
    dOpacity: (Math.random() - 0.5) * 0.02
  });
  if (brilhos.length > CONFIG.MAX_BRILHOS) brilhos.shift();
}

function animarBrilhos() {
  const ctx = brilhosCanvas.getContext('2d');
  ctx.clearRect(0, 0, brilhosCanvas.width, brilhosCanvas.height);

  if (brilhosAtivos) {
    brilhos.forEach(b => {
      b.x += b.dx;
      b.y += b.dy;
      b.opacity += b.dOpacity;

      if (b.opacity <= 0 || b.opacity >= 1) b.dOpacity *= -1;

      if (b.x < -10 || b.x > 110 || b.y < -10 || b.y > 110) {
        b.x = Math.random() * 100;
        b.y = Math.random() * 100;
        b.size = Math.random() * 18 + 12;
        b.opacity = Math.random() * 0.5 + 0.5;
        b.dx = (Math.random() - 0.5) * 0.25;
        b.dy = (Math.random() - 0.5) * 0.25;
        b.dOpacity = (Math.random() - 0.5) * 0.02;
      }

      const x = b.x * brilhosCanvas.width / 100;
      const y = b.y * brilhosCanvas.height / 100;
      ctx.save();
      ctx.globalAlpha = b.opacity;
      ctx.drawImage(brilhoImg, x - b.size / 2, y - b.size / 2, b.size, b.size);
      ctx.restore();
    });
  }

  requestAnimationFrame(animarBrilhos);
}

function initBrilhos() {
  if (!video.videoWidth) return;
  brilhosCanvas.width = video.videoWidth;
  brilhosCanvas.height = video.videoHeight;
  brilhos = [];
  for (let i = 0; i < CONFIG.MAX_BRILHOS; i++) criarBrilho();
  animarBrilhos();
}

// ===============================
// EVENTOS DOS BOTÕES
// ===============================


btnCamera.onclick = () => {
  usingFront = !usingFront;
  startCamera();
};

btnPhoto.onclick = takePhoto;
btnStartRec.onclick = startRecording;
btnStopRec.onclick = stopRecording;

btnDownloadVideo.onclick = () => {
  if (!lastVideoUrl) return;
  const a = document.createElement('a');
  a.href = lastVideoUrl;
  a.download = 'video-moldura.mp4';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  status('Download do vídeo solicitado');
};

btnRecordAgain.onclick = () => {
  videoPreviewOverlay.style.display = 'none';
  videoPreview.pause();

  if (lastVideoUrl) {
    URL.revokeObjectURL(lastVideoUrl);
    lastVideoUrl = null;
  }

  startRecording();
  status('🔴 Gravando novamente');
};

btnBrilhos.onclick = () => {
  brilhosAtivos = !brilhosAtivos;
  status(brilhosAtivos ? 'Brilhos ON ✨' : 'Brilhos OFF');
};


btnGallery.onclick = () => {
  galleryInput.click();
};

galleryInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    galleryImage = new Image();
    galleryImage.src = reader.result;
  };
  reader.readAsDataURL(file);
};


// ===============================
// INICIALIZAÇÃO
// ===============================
startCamera();
