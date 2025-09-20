const GEMINI_KEY = GEMINI_API_KEY;

// ----------- LOCAL STORAGE FEATURE -----------
function saveUniversesToStorage() {
  localStorage.setItem('universes', JSON.stringify(universes));
}
function loadUniversesFromStorage() {
  const stored = localStorage.getItem('universes');
  if (stored) {
    try {
      universes = JSON.parse(stored);
      if (!Array.isArray(universes)) universes = [];
    } catch(e) {
      universes = [];
    }
  } else {
    universes = [];
  }
}
// ---------------------------------------------

let universes = [];
let currentWordMeaning = null; // Store the current word's meaning
loadUniversesFromStorage(); // <-- Load universes on page load
updateUniverseTags();

// Enter key support
document.getElementById('wordInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    generateExamples();
  }
});

document.getElementById('newUniverseInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    addUniverse();
  }
});

// Clear errors when typing
document.getElementById('wordInput').addEventListener('input', function() {
  hideError();
});

function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function hideError() {
  document.getElementById('errorMessage').style.display = 'none';
}

function toggleAddUniverse() {
  const input = document.getElementById('addUniverseInput');
  const newUniverseInput = document.getElementById('newUniverseInput');
  
  if (input.classList.contains('active')) {
    cancelAddUniverse();
  } else {
    input.classList.add('active');
    newUniverseInput.focus();
  }
}

function cancelAddUniverse() {
  const input = document.getElementById('addUniverseInput');
  const newUniverseInput = document.getElementById('newUniverseInput');
  
  input.classList.remove('active');
  newUniverseInput.value = '';
}

function addUniverse() {
  const input = document.getElementById('newUniverseInput');
  const universeName = input.value.trim();
  
  if (!universeName) {
    showError('Please enter a universe name');
    return;
  }
  
  if (universes.includes(universeName)) {
    showError('This universe already exists');
    return;
  }
  
  if (universes.length >= 10) {
    showError('Maximum 10 universes allowed');
    return;
  }
  
  universes.push(universeName);
  saveUniversesToStorage(); // <-- Save universes when added
  updateUniverseTags();
  cancelAddUniverse();
  hideError();
  
  // Update placeholder if this was the first universe
  updateResultsPlaceholder();
}

function removeUniverse(universeName) {
  universes = universes.filter(u => u !== universeName);
  saveUniversesToStorage(); // <-- Save universes when removed
  updateUniverseTags();
  updateResultsPlaceholder();
}

function updateUniverseTags() {
  const container = document.getElementById('universeTags');
  
  if (universes.length === 0) {
    container.innerHTML = '<div class="no-universes">No universes added yet</div>';
    return;
  }
  
  container.innerHTML = universes.map(universe => 
    `<span class="universe-tag">
      ${universe}
      <button class="remove-universe" onclick="removeUniverse('${universe}')" title="Remove universe">×</button>
    </span>`
  ).join('');
}

function updateResultsPlaceholder() {
  const results = document.getElementById('results');
  if (results.children.length === 1 && results.children[0].classList.contains('placeholder-text')) {
    if (universes.length === 0) {
      results.innerHTML = '<div class="placeholder-text">Add some universes and enter a word to generate examples!</div>';
    } else {
      results.innerHTML = '<div class="placeholder-text">Enter a word to generate examples!</div>';
    }
  }
}

// Function to get word meaning
async function getWordMeaning(word) {
  try {
    console.log("Getting meaning for word:", word); // Debug log
    
    const prompt = `Define the word "${word}". Give me:
1. A short definition with part of speech in parentheses
2. A longer explanation
Don't add any extra text.
Example format:
Brave(Adj): Showing courage 
Extended: 
Brave means having or showing courage when facing danger, difficulty, or pain. It can refer to physical bravery in dangerous situations or moral courage when standing up for what's right.`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" + GEMINI_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) {
      console.error("API response not ok:", response.status);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("API response:", data); // Debug log
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid API response format');
    }
    
    const text = data.candidates[0].content.parts[0].text.trim();
    console.log("Raw text:", text); // Debug log
    
    // Simple parsing - just split by lines and take first two meaningful lines
    const lines = text.split('\n').filter(line => line.trim());
    let shortMeaning = '';
    let extendedMeaning = '';
    
    // Find the short definition (usually first line)
    for (let line of lines) {
      line = line.trim();
      if (line && !line.toLowerCase().startsWith('extended') && !shortMeaning) {
        // Remove any numbering or bullets
        shortMeaning = line.replace(/^[\d\.\-\*\s]+/, '').trim();
        break;
      }
    }
    
    // Find extended meaning
    let foundExtended = false;
    for (let line of lines) {
      line = line.trim();
      if (line.toLowerCase().includes('extended') || foundExtended) {
        if (!foundExtended) {
          foundExtended = true;
          extendedMeaning = line.replace(/^.*extended[:\-\s]*/i, '').trim();
        } else {
          extendedMeaning += ' ' + line;
        }
      }
    }
    
    // If no extended meaning found, use remaining text
    if (!extendedMeaning && lines.length > 1) {
      extendedMeaning = lines.slice(1).join(' ').trim();
    }
    
    const result = {
      short: shortMeaning || `${word} (meaning not found)`,
      extended: extendedMeaning || `Extended meaning not available for "${word}".`
    };
    
    console.log("Parsed result:", result); // Debug log
    return result;
    
  } catch (error) {
    console.error("Error getting word meaning:", error);
    return {
      short: `${word} (meaning unavailable)`,
      extended: `Unable to fetch extended meaning for "${word}" at this time.`
    };
  }
}

// Function to toggle extended meaning
function toggleExtendedMeaning(meaningId) {
  const extendedDiv = document.getElementById(meaningId);
  const button = extendedDiv.previousElementSibling.querySelector('.meaning-toggle-btn');
  
  if (extendedDiv.style.display === 'none' || extendedDiv.style.display === '') {
    extendedDiv.style.display = 'block';
    button.innerHTML = '📖';
    button.title = 'Hide extended meaning';
  } else {
    extendedDiv.style.display = 'none';
    button.innerHTML = '📖';
    button.title = 'Show extended meaning';
  }
}

async function generateExamples() {
  const wordInput = document.getElementById("wordInput");
  const searchBtn = document.getElementById("searchBtn");
  const results = document.getElementById("results");
  
  const word = wordInput.value.trim();
  
  hideError();
  
  if (!word) {
    showError('Please enter a word');
    return;
  }
  
  if (universes.length === 0) {
    showError('Please add at least one universe');
    return;
  }
  
  if (word.length > 30) {
    showError('Please enter a shorter word (max 30 characters)');
    return;
  }
  
  searchBtn.disabled = true;
  searchBtn.textContent = "Generating...";
  results.innerHTML = '<div class="loading">🔍 Generating examples...</div>';
  
  try {
    // Generate examples first (main priority)
    const prompt = `Create exactly ${universes.length} simple example sentences using the word "${word}". Make them short (under 15 words each). Create one sentence for each of these universes: ${universes.join(', ')}. Each sentence should clearly relate to that specific universe's world, characters, or themes. Just return the sentences, one per line, no extra text or numbering.`;
    
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" + GEMINI_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid API response format');
    }
    
    const text = data.candidates[0].content.parts[0].text;
    
    if (!text) {
      throw new Error('No text generated');
    }
    
    let sentences = text.trim().split('\n').filter(s => s.trim());
    
    sentences = sentences.map(s => s.replace(/^\d+\.?\s*/, '').trim()).filter(s => s);
    
    if (sentences.length === 0) {
      throw new Error('No valid sentences generated');
    }
    
    while (sentences.length < universes.length) {
      sentences.push(`The hero showed great ${word} in this universe.`);
    }
    
    sentences = sentences.slice(0, universes.length);
    
    // Display results first
    displayResults(sentences, word);
    
    // Get word meaning quietly (secondary priority) and update
    try {
      console.log("Starting to get word meaning..."); // Debug log
      currentWordMeaning = await getWordMeaning(word);
      console.log("Got meaning:", currentWordMeaning); // Debug log
      
      // Update the results with meaning
      displayResults(sentences, word);
    } catch (error) {
      console.error("Failed to get word meaning:", error);
      // Still show results without meaning
    }
    
  } catch (error) {
    console.error("Generation error:", error);
    showError(`Error: ${error.message}`);
    results.innerHTML = '<div class="placeholder-text">Try again or check your connection</div>';
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "Generate Examples";
  }
}

function displayResults(sentences, word) {
  const results = document.getElementById("results");
  
  if (!sentences || sentences.length === 0) {
    showError('No sentences generated');
    return;
  }
  
  let html = '';
  
  // Add sentences first (main content)
  sentences.forEach((sentence, index) => {
    const universe = universes[index] || `Universe ${index + 1}`;
    html += `
      <div class="result-item">
        <div class="result-universe">${universe}</div>
        <div class="result-sentence">${sentence}</div>
      </div>
    `;
  });
  
  // Add minimal word meaning at the bottom
  if (currentWordMeaning) {
    const meaningId = 'extended-meaning-' + Date.now();
    html += `
      <div class="word-meaning-minimal">
        <div class="meaning-line">
          <span class="meaning-text">${currentWordMeaning.short}</span>
          <button class="meaning-toggle-btn" onclick="toggleExtendedMeaning('${meaningId}')" title="Show extended meaning">📖</button>
        </div>
        <div class="extended-meaning-content" id="${meaningId}" style="display: none;">
          ${currentWordMeaning.extended}
        </div>
      </div>
    `;
  }
  
  results.innerHTML = html;
}