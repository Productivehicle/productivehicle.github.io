document.addEventListener('DOMContentLoaded', function() {
  const apiKey = GEMINI_API_KEY;
  const OMDb_API = '96e07346';
  
  // Elements
  const toggleSwitch = document.getElementById('toggleSwitch');
  const pickBtn = document.getElementById('pickBtn');
  const resultCard = document.getElementById('resultCard');
  const resultContent = document.getElementById('resultContent');
  const saveBtn = document.getElementById('saveBtn');
  const customBtn = document.getElementById('customBtn');
  const customModal = document.getElementById('customModal');
  const customInput = document.getElementById('customInput');
  const saveCustomBtn = document.getElementById('saveCustomBtn');
  const cancelCustomBtn = document.getElementById('cancelCustomBtn');
  const historyBtn = document.getElementById('historyBtn');
  const historyModal = document.getElementById('historyModal');
  const historyList = document.getElementById('historyList');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');

  let customInstructions = '';
  let currentResult = null;

  // Fetch movie/show image from OMDb
  async function getMovieImage(title, year) {
    try {
      const url = `https://www.omdbapi.com/?apikey=${OMDb_API}&t=${encodeURIComponent(title)}&y=${year}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.Poster && data.Poster !== 'N/A') {
        return data.Poster;
      }
    } catch (error) {
      console.error('OMDb API error:', error);
    }
    return null;
  }

  // Custom instructions
  customBtn.addEventListener('click', () => {
    customModal.classList.remove('hidden');
    customInput.value = customInstructions;
    customInput.focus();
  });

  saveCustomBtn.addEventListener('click', () => {
    customInstructions = customInput.value.trim();
    customModal.classList.add('hidden');
  });

  cancelCustomBtn.addEventListener('click', () => {
    customModal.classList.add('hidden');
  });

  // History
  historyBtn.addEventListener('click', () => {
    loadHistory();
    historyModal.classList.remove('hidden');
  });

  closeHistoryBtn.addEventListener('click', () => {
    historyModal.classList.add('hidden');
  });

  // Main pick function
  pickBtn.addEventListener('click', async () => {
    const isMovie = toggleSwitch.checked;
    const type = isMovie ? 'movie' : 'TV series';
    
    pickBtn.disabled = true;
    pickBtn.innerHTML = '⏳';
    
    try {
      const prompt = `Suggest 1 random ${type}. ${customInstructions ? `Instructions: ${customInstructions}.` : ''} 

Return ONLY a JSON object in this exact format:
{
  "title": "Movie/Show Title",
  "year": "Release Year",
  "genre": "Genre",
  "rating": "IMDb rating if known",
  "description": "Brief 2-sentence description"
}

No imageUrl needed.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 500,
          }
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text.trim();
      
      // Clean JSON
      let jsonStr = text;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0];
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0];
      }

      currentResult = JSON.parse(jsonStr);
      
      // Fetch real movie poster
      const imageUrl = await getMovieImage(currentResult.title, currentResult.year);
      currentResult.imageUrl = imageUrl;
      
      displayResult(currentResult, isMovie);

    } catch (error) {
      console.error('Error:', error);
      alert('Error getting suggestion. Please try again.');
    } finally {
      pickBtn.disabled = false;
      pickBtn.innerHTML = '✨';
    }
  });

  // Display result
  function displayResult(result, isMovie) {
    const fallbackIcon = isMovie ? '🎬' : '📺';
    const imageHtml = result.imageUrl 
      ? `<img src="${result.imageUrl}" alt="${result.title}" class="w-24 h-36 object-cover rounded-lg bg-gray-700" onerror="this.outerHTML='<div class=&quot;w-24 h-36 bg-gray-700 rounded-lg flex items-center justify-center text-4xl&quot;>${fallbackIcon}</div>'">`
      : `<div class="w-24 h-36 bg-gray-700 rounded-lg flex items-center justify-center text-4xl">${fallbackIcon}</div>`;
    
    resultContent.innerHTML = `
      <div class="flex flex-col space-y-4">
        <div class="flex space-x-4">
          ${imageHtml}
          <div class="flex-1">
            <h3 class="text-xl font-bold text-white">${result.title}</h3>
            <p class="text-gray-300">${result.year} • ${result.genre}</p>
            ${result.rating ? `<p class="text-yellow-400">⭐ ${result.rating}</p>` : ''}
            <p class="text-sm text-gray-400 mt-2">${result.description}</p>
          </div>
        </div>
      </div>
    `;
    resultCard.classList.remove('hidden');
  }

  // Save function
  saveBtn.addEventListener('click', () => {
    if (!currentResult) return;
    
    const saved = JSON.parse(localStorage.getItem('savedMovies') || '[]');
    const newItem = {
      ...currentResult,
      savedAt: new Date().toLocaleDateString(),
      type: toggleSwitch.checked ? 'Movie' : 'Series'
    };
    
    saved.unshift(newItem);
    localStorage.setItem('savedMovies', JSON.stringify(saved));
    alert('💾 Saved!');
  });

// Load history
function loadHistory() {
  const saved = JSON.parse(localStorage.getItem('savedMovies') || '[]');
  
  if (saved.length === 0) {
    historyList.innerHTML = '<p class="text-gray-400 text-center py-4">No saved items yet</p>';
    return;
  }
  
  historyList.innerHTML = saved.map((item, index) => {
    const fallbackIcon = item.type === 'Movie' ? '🎬' : '📺';
    const imageHtml = item.imageUrl ?
      `<img src="${item.imageUrl}" alt="${item.title}" class="w-24 h-36 object-cover rounded-lg bg-gray-700" 
           onerror="this.outerHTML='<div class=&quot;w-24 h-36 bg-gray-700 rounded-lg flex items-center justify-center text-4xl&quot;>${fallbackIcon}</div>'">` :
      `<div class="w-24 h-36 bg-gray-700 rounded-lg flex items-center justify-center text-4xl">${fallbackIcon}</div>`;
    
    return `
      <div class="bg-gray-700 rounded-lg p-4 mb-3">
        <div class="flex space-x-4">
          ${imageHtml}
          <div class="flex-1">
            <h3 class="text-xl font-bold text-white">${item.title}</h3>
            <p class="text-gray-300">${item.year} • ${item.genre || ''}</p>
            ${item.rating ? `<p class="text-yellow-400">⭐ ${item.rating}</p>` : ''}
          </div>
          <button class="deleteBtn text-red-400 hover:text-red-600 ml-2 self-start" data-index="${index}">Delete</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach delete handlers
  document.querySelectorAll('.deleteBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-index');
      deleteSavedItem(idx);
    });
  });
}

// Delete function
function deleteSavedItem(index) {
  const saved = JSON.parse(localStorage.getItem('savedMovies') || '[]');
  saved.splice(index, 1);
  localStorage.setItem('savedMovies', JSON.stringify(saved));
  loadHistory(); // refresh list
}

  // Close modals on outside click
  [customModal, historyModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

});