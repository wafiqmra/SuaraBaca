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

// Event Listeners
speedRange.addEventListener("input", updateSpeedLabel);
uploadArea.addEventListener("click", () => imageInput.click());
uploadArea.addEventListener("dragover", handleDragOver);
uploadArea.addEventListener("dragleave", handleDragLeave);
uploadArea.addEventListener("drop", handleDrop);
imageInput.addEventListener('change', handleFileUpload);

// Functions
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
    
    // Use Tesseract.js to extract text
    Tesseract.recognize(
      e.target.result,
      'ind', // Bahasa Indonesia
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            progressBar.style.width = `${Math.round(m.progress * 100)}%`;
            statusText.textContent = `Memproses: ${m.progress * 100}%`;
          }
        }
      }
    ).then(({ data: { text } }) => {
      extractedText = text.trim();
      outputText.textContent = extractedText || "❗ Tidak ditemukan teks yang bisa dibaca.";
      progressContainer.style.display = 'none';
      readButton.disabled = false;
      copyButton.disabled = false;
      isProcessing = false;
      
      if (extractedText) {
        // Auto-read if text is short
        if (extractedText.length < 500) {
          readText();
        }
      }
    }).catch(err => {
      console.error(err);
      outputText.textContent = "❌ Terjadi kesalahan saat memproses gambar.";
      progressContainer.style.display = 'none';
      isProcessing = false;
    });
  };
  reader.readAsDataURL(file);
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