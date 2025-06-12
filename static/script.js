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
const spellCheckButton = document.getElementById('spellCheckButton');
const spellCheckLoading = document.getElementById('spellCheckLoading');
const simplifyButton = document.getElementById('simplifyButton');

// Variables
let extractedText = "";
let isProcessing = false;
let isDyslexiaMode = false;
let isSimplified = false;

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
  spellCheckButton.disabled = true;
  simplifyButton.disabled = true;

  processImageFile(file);
}

async function processImageFile(file) {
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
    ).then(async ({ data: { text } }) => {
      extractedText = text.trim();
      
      // Show raw text first
      outputText.textContent = extractedText || "❗ Tidak ditemukan teks yang bisa dibaca.";
      progressContainer.style.display = 'none';
      readButton.disabled = false;
      copyButton.disabled = false;
      spellCheckButton.disabled = false;
      simplifyButton.disabled = false;
      isProcessing = false;
      
      if (extractedText) {
        // Auto-read if text is short
        if (extractedText.length < 500) {
          readText();
        }
        
        // Auto-check spelling for short texts
        if (extractedText.length < 1000) {
          await checkSpellingManually();
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

async function checkSpellingManually() {
  if (!extractedText || isProcessing) return;
  
  spellCheckLoading.style.display = 'block';
  spellCheckButton.disabled = true;
  outputText.textContent = extractedText;
  
  try {
    const result = await checkSpelling(extractedText);
    
    if (result && result.matches && result.matches.length > 0) {
      const processedText = highlightSpellingErrors(extractedText, result.matches);
      outputText.innerHTML = processedText;
      setupSpellingErrorEvents();
    } else {
      outputText.textContent = extractedText;
      alert("Tidak ditemukan kesalahan ejaan yang signifikan.");
    }
  } catch (error) {
    console.error('Error:', error);
    outputText.textContent = extractedText;
    alert("Gagal memeriksa ejaan. Silakan coba lagi nanti.");
  } finally {
    spellCheckLoading.style.display = 'none';
    spellCheckButton.disabled = false;
  }
}

async function checkSpelling(text) {
  try {
    const cleanedText = text
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    
    // Try LanguageTool API first
    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: `text=${encodeURIComponent(cleanedText)}&language=id-ID&enabledOnly=false`
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking spelling:', error);
    return enhancedSimpleSpellCheck(text);
  }
}

function enhancedSimpleSpellCheck(text) {
  const commonErrors = {
    // Common OCR errors
    'ek': 'yang', 'gebe': 'harus', 'umenyeberang': 'menyeberang', 
    'spm': 'saat', 'liat': 'lihat', 'bror': 'bro',
    
    // Common abbreviations
    'yg': 'yang', 'dgn': 'dengan', 'tdk': 'tidak', 'org': 'orang',
    'utk': 'untuk', 'pd': 'pada', 'sdh': 'sudah', 'blm': 'belum',
    'dlm': 'dalam', 'jg': 'juga', 'bg': 'bagi', 'tsb': 'tersebut',
    
    // Common typos
    'adl': 'adalah', 'dpn': 'depan', 'klo': 'kalau', 'kmrn': 'kemarin',
    'kyk': 'kayak', 'msh': 'masih', 'nggak': 'tidak', 'skrg': 'sekarang'
  };
  
  let matches = [];
  
  Object.keys(commonErrors).forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        offset: match.index,
        length: word.length,
        message: `Kata tidak baku: ${word}`,
        replacements: [{value: commonErrors[word]}]
      });
    }
  });
  
  return {matches};
}

function highlightSpellingErrors(text, matches) {
  if (!matches || matches.length === 0) return text;
  
  let result = text;
  let offset = 0;
  
  const sortedMatches = [...matches].sort((a, b) => b.offset - a.offset);
  
  sortedMatches.forEach(match => {
    const start = match.offset + offset;
    const end = start + match.length;
    
    if (start >= 0 && end <= result.length) {
      const originalWord = result.substring(start, end);
      
      if (!originalWord.includes('spelling-error')) {
        const suggestions = match.replacements?.slice(0, 3).map(r => r.value).join(', ') || 'Tidak ada saran';
        const highlighted = `<span class="spelling-error" data-original="${originalWord}" 
          data-suggestions="${suggestions}" title="${match.message || 'Kesalahan ejaan'}">
          ${originalWord}</span>`;
        
        result = result.substring(0, start) + highlighted + result.substring(end);
        offset += highlighted.length - originalWord.length;
      }
    }
  });
  
  return result;
}

async function correctSpelling(text) {
  const result = await checkSpelling(text);
  if (!result || !result.matches) return text;
  
  // Filter only spelling errors (ignore grammar for now)
  const spellingErrors = result.matches.filter(match => match.rule.category.id === 'TYPOS');
  return highlightSpellingErrors(text, spellingErrors);
}

function setupSpellingErrorEvents() {
  document.querySelectorAll('.spelling-error').forEach(element => {
    element.addEventListener('click', function() {
      const suggestions = this.getAttribute('data-suggestions').split(', ');
      if (suggestions.length > 0) {
        showSuggestionDropdown(this, suggestions);
      }
    });
  });
}

function showSuggestionDropdown(element, suggestions) {
  // Remove any existing dropdown
  const existingDropdown = document.getElementById('suggestion-dropdown');
  if (existingDropdown) existingDropdown.remove();
  
  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.id = 'suggestion-dropdown';
  dropdown.className = 'suggestion-dropdown';
  
  suggestions.forEach(suggestion => {
    const option = document.createElement('div');
    option.className = 'suggestion-option';
    option.textContent = suggestion;
    option.addEventListener('click', () => {
      // Replace the error with the selected suggestion
      const range = document.createRange();
      range.selectNode(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Update the extractedText variable
      const originalText = element.getAttribute('data-original');
      const regex = new RegExp(originalText, 'g');
      extractedText = extractedText.replace(regex, suggestion);
      
      // Replace in DOM
      element.replaceWith(document.createTextNode(suggestion));
      dropdown.remove();
    });
    dropdown.appendChild(option);
  });
  
  // Position dropdown
  const rect = element.getBoundingClientRect();
  dropdown.style.position = 'absolute';
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.top = `${rect.bottom + window.scrollY}px`;
  
  document.body.appendChild(dropdown);
  
  // Close dropdown when clicking elsewhere
  setTimeout(() => {
    const clickHandler = (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', clickHandler);
      }
    };
    document.addEventListener('click', clickHandler);
  }, 0);
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
  
  // Create temporary element to strip HTML tags
  const temp = document.createElement('div');
  temp.innerHTML = outputText.innerHTML;
  const plainText = temp.textContent || temp.innerText || '';
  
  navigator.clipboard.writeText(plainText)
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

function simplifyText() {
  if (!extractedText) {
    alert("Tidak ada teks untuk disederhanakan.");
    return;
  }

  // Show processing state
  isProcessing = true;
  outputText.textContent = "🔄 Menyederhanakan teks...";
  simplifyButton.disabled = true;

  // Process in chunks to avoid UI freezing
  setTimeout(() => {
    try {
      const simplified = applySimplificationRules(extractedText);
      
      // Display with word highlighting
      outputText.innerHTML = '';
      outputText.classList.add('simplified-text');
      
      const words = simplified.split(' ');
      words.forEach((word, i) => {
        const span = document.createElement('span');
        span.className = 'simplified-word';
        span.textContent = word + ' ';
        span.addEventListener('click', () => {
          document.querySelectorAll('.simplified-word').forEach(w => w.classList.remove('highlight'));
          span.classList.add('highlight');
          speakWord(word);
        });
        outputText.appendChild(span);
      });

      isSimplified = true;
    } catch (error) {
      console.error("Error simplifying text:", error);
      outputText.textContent = extractedText;
      alert("Gagal menyederhanakan teks. Silakan coba lagi.");
    } finally {
      isProcessing = false;
      simplifyButton.disabled = false;
    }
  }, 100);
}

function applySimplificationRules(text) {
  // Common simplification rules for Indonesian
  const simplificationRules = {
    'memperhatikan': 'lihat',
    'menyebabkan': 'buat',
    'berkembang': 'tumbuh',
    'menyampaikan': 'beri',
    'menggunakan': 'pakai',
    'terdapat': 'ada',
    'memiliki': 'punya',
    'melakukan': 'buat',
    'mengetahui': 'tahu',
    'mengatakan': 'bilang',
    'berpartisipasi': 'ikut',
    'mengindikasikan': 'tunjuk',
    'memperoleh': 'dapat',
    'berkomunikasi': 'bicara',
    'menginterpretasikan': 'artikan',
    'memperhitungkan': 'hitung',
    'menyimpulkan': 'simpul',
    'mengidentifikasi': 'tahu',
    'mengevaluasi': 'nilai',
    'menyederhanakan': 'sederhana',
    'mempertimbangkan': 'pikir',
    'menunjukkan': 'tunjuk',
    'mengandung': 'ada',
    'menyajikan': 'tunjuk',
    'menggambarkan': 'gambar',
    'menyebutkan': 'sebut',
    'menjelaskan': 'jelas',
    'membandingkan': 'banding',
    'menanggapi': 'jawab',
    'menyadari': 'tahu',
    'memahami': 'mengerti',
    'mengenali': 'tahu',
    'mengungkapkan': 'bilang',
    'menyampaikan': 'sampai',
    'mengajukan': 'aju',
    'mengakui': 'aku',
    'menghasilkan': 'buat',
    'menyediakan': 'sedia',
    'mengikuti': 'ikut',
    'mengalihkan': 'alih',
    'mengubah': 'ubah',
    'mengenai': 'tentang',
    'terhadap': 'ke',
    'dengan': 'pakai',
    'sehingga': 'jadi',
    'namun': 'tapi',
    'oleh karena itu': 'jadi',
    'di samping itu': 'juga',
    'meskipun': 'walau',
    'apabila': 'jika',
    'ketika': 'saat',
    'sebelum': 'sebelum',
    'sesudah': 'setelah',
    'selama': 'waktu',
    'sementara': 'sambil',
    'karena': 'sebab',
    'sebab': 'karena',
    'dengan demikian': 'jadi',
    'dalam rangka': 'untuk',
    'berdasarkan': 'dari',
    'menurut': 'dari',
    'sehubungan dengan': 'tentang',
    'sebagai contoh': 'contoh',
    'seperti': 'macam',
    'seperti halnya': 'seperti',
    'yaitu': 'adalah',
    'yakni': 'adalah',
    'antara lain': 'contoh',
    'dan lain-lain': 'dsb',
    'dan sebagainya': 'dsb',
    'serta': 'dan',
    'atau': 'atau'
  };

  // Split into sentences first
  let sentences = text.split(/([.!?]+)/);
  let simplifiedText = '';

  for (let i = 0; i < sentences.length; i++) {
    let sentence = sentences[i];
    
    // Only process sentence content (skip punctuation)
    if (i % 2 === 0) {
      // Process each word
      let words = sentence.split(' ');
      let simplifiedWords = words.map(word => {
        // Remove punctuation for comparison
        let cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').toLowerCase();
        
        // Check if word needs simplification
        if (simplificationRules[cleanWord]) {
          return simplificationRules[cleanWord];
        }
        
        // Check for prefixes/suffixes
        if (cleanWord.length > 6) {
          // Common Indonesian prefixes
          const prefixes = ['me', 'mem', 'men', 'meng', 'meny', 'ber', 'ter', 'di', 'ke', 'pe', 'pem', 'pen', 'peng', 'peny'];
          for (const prefix of prefixes) {
            if (cleanWord.startsWith(prefix)) {
              const root = cleanWord.slice(prefix.length);
              if (simplificationRules[root]) {
                return simplificationRules[root];
              }
            }
          }
        }
        
        return word;
      });
      
      sentence = simplifiedWords.join(' ');
    }
    
    simplifiedText += sentence;
  }

  // Break long sentences into shorter ones
  simplifiedText = simplifiedText.replace(/([^.!?]+)([.!?]+)/g, (match, sentence, punctuation) => {
    if (sentence.length > 15) {
      // Split at commas or conjunctions
      const splitPoints = [' dan ', ' atau ', ' tetapi ', ' namun ', ' karena ', ' sehingga ', ' yaitu ', ' yang '];
      for (const point of splitPoints) {
        if (sentence.includes(point)) {
          return sentence.replace(point, punctuation + point.trim()) + punctuation;
        }
      }
      
      // Split at natural breaks if no conjunctions found
      if (sentence.length > 20) {
        const mid = Math.floor(sentence.length / 2);
        const spacePos = sentence.indexOf(' ', mid);
        if (spacePos > -1) {
          return sentence.substring(0, spacePos) + punctuation + 
                 sentence.substring(spacePos + 1) + punctuation;
        }
      }
    }
    return sentence + punctuation;
  });

  return simplifiedText;
}

function speakWord(word) {
  // Stop any ongoing speech
  window.speechSynthesis.cancel();
  
  const speech = new SpeechSynthesisUtterance(word);
  speech.lang = 'id-ID';
  speech.rate = parseFloat(speedRange.value);
  
  window.speechSynthesis.speak(speech);
}

function resetUI() {
  progressContainer.style.display = 'none';
  spellCheckLoading.style.display = 'none';
  isProcessing = false;
  readButton.disabled = true;
  copyButton.disabled = true;
  spellCheckButton.disabled = true;
  simplifyButton.disabled = true;
  
  if (isSimplified) {
    outputText.classList.remove('simplified-text');
    isSimplified = false;
  }
  
}