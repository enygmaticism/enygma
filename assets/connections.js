const COLORS = ['yellow', 'green', 'blue', 'purple'];

let puzzle = null;
let words = [];
let selected = [];
let mistakes = 0;
let solvedColors = new Set();
let solvedWords = new Set();
let gameOver = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizedEntry(entry) {
  const groups = Array.isArray(entry.groups) ? entry.groups : [];
  return {
    ...entry,
    groups: groups.map((group, i) => ({
      name: String(group.name || ''),
      color: COLORS[i],
      words: Array.isArray(group.words) ? group.words.map(String).slice(0, 4) : []
    })).filter(group => group.words.length === 4)
  };
}

async function loadEntries() {
  const response = await fetch(`data/entries.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load entries');
  return response.json();
}

function render() {
  const app = document.getElementById('connections-app');
  if (!puzzle) {
    app.innerHTML = '<div class="connections-empty">no entries currently.</div>';
    return;
  }

  const remaining = words.filter(word => !solvedWords.has(word.id));
  const solvedGroups = puzzle.groups.filter(group => solvedColors.has(group.color));

  app.innerHTML = `
    <div class="connections-game">
      <div class="connections-date">${escapeHtml(puzzle.date)}</div>
      <div class="connections-mistakes" aria-label="Mistakes remaining">
        <span>Mistakes remaining:</span>
        <span class="mistake-dots">${[0,1,2,3].map(i => `<i class="mistake-dot ${i < 4 - mistakes ? 'active' : ''}"></i>`).join('')}</span>
      </div>
      <div class="solved-groups">
        ${solvedGroups.map(group => `
          <div class="solved-group ${group.color}">
            <strong>${escapeHtml(group.name)}</strong>
            <span>${group.words.map(escapeHtml).join(', ')}</span>
          </div>`).join('')}
      </div>
      ${remaining.length && !gameOver ? `
        <div class="connections-grid" role="group" aria-label="Connection words">
          ${remaining.map(word => `<button class="connection-tile ${selected.includes(word.id) ? 'selected' : ''}" data-id="${escapeHtml(word.id)}">${escapeHtml(word.text)}</button>`).join('')}
        </div>
        <div class="connections-actions">
          <button id="shuffle-btn" class="connections-secondary">Shuffle</button>
          <button id="deselect-btn" class="connections-secondary">Deselect all</button>
          <button id="submit-btn" class="connections-primary" ${selected.length !== 4 ? 'disabled' : ''}>Submit</button>
        </div>` : ''}
      <div id="connections-message" class="connections-message">${gameOver ? (solvedColors.size === 4 && mistakes < 4 ? 'Great work!' : 'Game over — the answers are above.') : ''}</div>
    </div>`;

  app.querySelectorAll('.connection-tile').forEach(button => {
    button.addEventListener('click', () => toggleSelection(button.dataset.id));
  });
  document.getElementById('shuffle-btn')?.addEventListener('click', () => { words = shuffle(words); render(); });
  document.getElementById('deselect-btn')?.addEventListener('click', () => { selected = []; render(); });
  document.getElementById('submit-btn')?.addEventListener('click', submitSelection);
}

function toggleSelection(id) {
  if (gameOver || solvedWords.has(id)) return;
  if (selected.includes(id)) selected = selected.filter(value => value !== id);
  else if (selected.length < 4) selected = [...selected, id];
  render();
}

function selectedMatchesGroup(group) {
  const selectedTexts = selected.map(id => words.find(word => word.id === id)?.text);
  return selectedTexts.length === 4 && group.words.every(word => selectedTexts.includes(word));
}

function selectedMatchesThree(group) {
  const selectedTexts = selected.map(id => words.find(word => word.id === id)?.text);
  return group.words.filter(word => selectedTexts.includes(word)).length === 3;
}

function submitSelection() {
  if (selected.length !== 4 || gameOver) return;

  const exactMatch = puzzle.groups.find(group => !solvedColors.has(group.color) && selectedMatchesGroup(group));
  if (exactMatch) {
    solvedColors.add(exactMatch.color);
    selected.forEach(id => solvedWords.add(id));
    selected = [];
    if (solvedColors.size === 4) gameOver = true;
    render();
    return;
  }

  mistakes += 1;
  const oneAway = puzzle.groups.some(group => !solvedColors.has(group.color) && selectedMatchesThree(group));
  selected = [];
  render();
  const message = document.getElementById('connections-message');
  if (message) message.textContent = oneAway ? 'One away...' : 'Not quite.';

  if (mistakes >= 4) {
    gameOver = true;
    puzzle.groups.forEach(group => {
      solvedColors.add(group.color);
      group.words.forEach(text => {
        const tile = words.find(word => word.text === text);
        if (tile) solvedWords.add(tile.id);
      });
    });
    setTimeout(render, 500);
  }
}

async function init() {
  try {
    const data = await loadEntries();
    const entries = (data.connections || []).map(normalizedEntry).sort((a, b) => new Date(b.date) - new Date(a.date));
    const requestedDate = new URLSearchParams(location.search).get('date');
    puzzle = requestedDate ? entries.find(entry => entry.date === requestedDate) || entries[0] : entries[0];

    if (puzzle) {
      words = shuffle(puzzle.groups.flatMap((group, groupIndex) => group.words.map((text, wordIndex) => ({ id: `${groupIndex}-${wordIndex}`, text }))));
    }
    render();

    const archive = document.getElementById('connections-archive-list');
    if (!entries.length) {
      archive.innerHTML = '<div class="connections-empty">no entries currently.</div>';
    } else {
      archive.innerHTML = entries.map((entry, index) => `<a class="connections-archive-item" href="connections.html?date=${encodeURIComponent(entry.date)}">${escapeHtml(entry.title || entry.date)}<span>${escapeHtml(entry.date)}${index === 0 ? ' · latest' : ''}</span></a>`).join('');
    }
  } catch {
    document.getElementById('connections-app').innerHTML = '<div class="connections-empty">Unable to load entries.</div>';
  }
}

init();
