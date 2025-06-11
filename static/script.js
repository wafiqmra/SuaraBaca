// DOM Elements
const imageInput = document.getElementById('imageInput');
const uploadArea = document.getElementById('uploadArea');
const preview = document.getElementById('preview');
const outputText = document.getElementById('outputText');
const speedRange = document.getElementById('speedRange');
const speedLabel = document.getElementById('speedLabel');
const readButton = document.getElementById('readButton');
const stopButton = document.getElementById('stopButton');
const copyButton = document.getElementById('copyButton');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');
const dyslexiaButton = document.getElementById('dyslexiaButton');

// Variables
let extractedText = "";
let isProcessing = false;
let isDyslexiaMode = false;
let cameraStream = null;

// Event Listeners
speedRange.addEventListener("input", updateSpeedLabel);
uploadArea.addEventListener("click", () => imageInput.click());
uploadArea.addEventListener("dragover", handleDragOver);
uploadArea.addEventListener("dragleave", handleDragLeave);
uploadArea.addEventListener("drop", handleDrop);
imageInput.addEventListener('change', handleFileUpload);

// Functions

function openCamera() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraView');
  
  modal.style.display = 'block';
  
  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(stream => {
      cameraStream = stream;
      video.srcObject = stream;
    })
    .catch(err => {
      console.error("Error mengakses kamera: ", err);
      alert("Tidak dapat mengakses kamera. Pastikan Anda memberikan izin.");
      closeCamera();
    });
}

function closeCamera() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraView');
  
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  
  video.srcObject = null;
  modal.style.display = 'none';
}

function captureFromCamera() {
  const video = document.getElementById('cameraView');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Konversi ke blob untuk diproses
  canvas.toBlob(blob => {
    const file = new File([blob], 'capture.png', { type: 'image/png' });
    imageInput.files = [file];
    handleFileUpload();
    closeCamera();
  }, 'image/png');
}

function updateSpeedLabel() {
  speedLabel.textContent = speedRange.value;
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.add('highlight');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.remove('highlight');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.remove('highlight');
  
  if (e.dataTransfer.files.length) {
    imageInput.files = e.dataTransfer.files;
    handleFileUpload();
  }
}

function handleFileUpload() {
  const file = imageInput.files[0];
  if (!file) return;

  // Check file type
  if (!file.type.match('image.*')) {
    alert('Silakan unggah file gambar (JPG, PNG)');
    return;
  }

  // Show processing UI
  isProcessing = true;
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  statusText.textContent = 'Memproses file...';
  outputText.textContent = "🔄 Sedang memproses teks...";
  readButton.disabled = true;
  copyButton.disabled = true;

  processImageFile(file);
}

function processImageFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    preview.src = e.target.result;
    preview.style.display = 'block';
    
    // Preprocess gambar sebelum OCR
    preprocessImage(e.target.result)
      .then(processedImage => {
        return Tesseract.recognize(
          processedImage,
          'ind+eng', // Gabungkan bahasa Indonesia dan Inggris
          {
            logger: m => updateProgress(m),
            tessedit_pageseg_mode: 6, // Mode segmentasi otomatis
            preserve_interword_spaces: '1' // Pertahankan spasi antar kata
          }
        );
      })
      .then(({ data: { text } }) => {
        extractedText = postProcessText(text.trim());
        outputText.textContent = extractedText || "❗ Tidak ditemukan teks yang bisa dibaca.";
        progressContainer.style.display = 'none';
        readButton.disabled = false;
        copyButton.disabled = false;
        isProcessing = false;
        
        if (extractedText && extractedText.length < 500) {
          readText();
        }
      })
      .catch(err => {
        console.error(err);
        outputText.textContent = "❌ Terjadi kesalahan saat memproses gambar.";
        progressContainer.style.display = 'none';
        isProcessing = false;
      });
  };
  reader.readAsDataURL(file);
}

async function preprocessImage(imageData) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Gambar ke canvas
      ctx.drawImage(img, 0, 0);
      
      // Preprocessing sederhana
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Tingkatkan kontras
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = data[i + 1] = data[i + 2] = avg < 128 ? 0 : 255;
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageData;
  });
}

function postProcessText(text) {
  // Perbaiki kesalahan OCR umum
  const replacements = {
    'b1': 'bl',
    'l0': 'lo',
    '1l': 'll',
    '\\|': 'I',
    // Tambahkan penggantian lain yang sering terjadi
  };
  
  let result = text;
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key, 'g');
    result = result.replace(regex, value);
  }
  
  return result;
}

function readText() {
  if (!extractedText || isProcessing) {
    alert("Belum ada teks untuk dibaca atau masih memproses.");
    return;
  }
  
  // Stop any ongoing speech
  window.speechSynthesis.cancel();
  
  const speech = new SpeechSynthesisUtterance(extractedText);
  speech.lang = 'id-ID';
  speech.rate = parseFloat(speedRange.value);
  
  // Enable stop button while reading
  stopButton.disabled = false;
  
  // Re-enable read button when done
  speech.onend = () => {
    stopButton.disabled = true;
  };
  
  window.speechSynthesis.speak(speech);
}

function stopReading() {
  window.speechSynthesis.cancel();
  stopButton.disabled = true;
}

function copyText() {
  if (!extractedText) {
    alert("Tidak ada teks untuk disalin.");
    return;
  }
  
  navigator.clipboard.writeText(extractedText)
    .then(() => {
      // Show temporary feedback
      const originalText = copyButton.innerHTML;
      copyButton.innerHTML = '<span>✓</span> Tersalin!';
      setTimeout(() => {
        copyButton.innerHTML = originalText;
      }, 2000);
    })
    .catch(err => {
      console.error('Gagal menyalin teks: ', err);
      alert("Gagal menyalin teks. Silakan coba lagi.");
    });
}

function toggleDyslexiaMode() {
  isDyslexiaMode = !isDyslexiaMode;
  document.body.classList.toggle('dyslexia-mode', isDyslexiaMode);
  dyslexiaButton.innerHTML = isDyslexiaMode ? 
    '<span>👓</span> Mode Normal' : 
    '<span>👓</span> Mode Disleksia';
}

function resetUI() {
  progressContainer.style.display = 'none';
  isProcessing = false;
  readButton.disabled = true;
  copyButton.disabled = true;
}

// Tambahkan di script.js
function saveToHistory(imageData, extractedText) {
  const history = JSON.parse(localStorage.getItem('ocrHistory') || '[]');
  history.unshift({
    date: new Date().toISOString(),
    image: imageData,
    text: extractedText
  });
  
  // Simpan maksimal 10 riwayat
  if (history.length > 10) history.pop();
  
  localStorage.setItem('ocrHistory', JSON.stringify(history));
}

// Panggil fungsi ini setelah ekstraksi teks berhasil
saveToHistory(preview.src, extractedText);

function playSound(type) {
  const sounds = {
    success: 'https://assets.mixkit.co/sfx/preview/mixkit-positive-interface-beep-221.mp3',
    error: 'https://assets.mixkit.co/sfx/preview/mixkit-warning-alarm-688.mp3',
    capture: 'https://assets.mixkit.co/sfx/preview/mixkit-camera-shutter-click-1133.mp3'
  };
  
  const audio = new Audio(sounds[type]);
  audio.play().catch(e => console.log("Autoplay prevented:", e));
}

// Panggil di tempat yang sesuai:
// playSound('success') ketika berhasil
// playSound('error') ketika gagal
// playSound('capture') saat mengambil foto