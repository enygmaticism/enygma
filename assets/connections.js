let puzzle = null;
let words = [];
let selected = [];
let mistakes = 0;
let solvedColors = new Set();
let solvedWords = new Set();
let gameOver = false;
let accountUsername = null;
let startedAt = Date.now();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadAccount() {
  try {
    const response = await fetch('api/auth/me', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return null;
    const result = await response.json();
    return result.authenticated ? result.username : null;
  } catch {
    return null;
  }
}

function render() {
  const app = document.getElementById('connections-app');
  if (!puzzle) {
    app.innerHTML = '<div class="connections-empty">no entries currently.</div>';
    return;
  }

  const solvedGroups = Array.isArray(puzzle.solvedGroups) ? puzzle.solvedGroups : [];
  const remaining = words.filter(word => !solvedWords.has(word));

  app.innerHTML = `
    <div class="connections-game">
      <div class="connections-date">${escapeHtml(puzzle.date)}</div>
      <div class="connections-mistakes" aria-label="Mistakes remaining">
        <span>Mistakes remaining:</span>
        <span class="mistake-dots">${[0,1,2,3].map(i => `<i class="mistake-dot ${i < 4 - mistakes ? 'active' : ''}"></i>`).join('')}</span>
      </div>
      <div class="solved-groups">
        ${solvedGroups.map(group => `
          <div class="solved-group ${escapeHtml(group.color)}">
            <strong>${escapeHtml(group.name)}</strong>
            <span>${group.words.map(escapeHtml).join(', ')}</span>
          </div>`).join('')}
      </div>
      ${remaining.length && !gameOver ? `
        <div class="connections-grid" role="group" aria-label="Connection words">
          ${remaining.map(word => `<button class="connection-tile ${selected.includes(word) ? 'selected' : ''}" data-word="${escapeHtml(word)}">${escapeHtml(word)}</button>`).join('')}
        </div>
        <div class="connections-actions">
          <button id="shuffle-btn" class="connections-secondary">Shuffle</button>
          <button id="deselect-btn" class="connections-secondary">Deselect all</button>
          <button id="submit-btn" class="connections-primary" ${selected.length !== 4 ? 'disabled' : ''}>Submit</button>
        </div>` : ''}
      <div id="connections-message" class="connections-message">${gameOver ? (puzzle.completed ? `Great work! +${Number(puzzle.score || 0).toLocaleString()} points` : `Game over — ${Number(puzzle.score || 0).toLocaleString()} points`) : ''}</div>
      ${gameOver && accountUsername ? '<div class="save-result-note">Your result is saved to your profile.</div>' : ''}
      ${gameOver && !accountUsername ? '<a class="save-result-prompt" href="login.html">Log in to save your result and appear on the rankings.</a>' : ''}
      ${accountUsername && !gameOver ? '<div class="account-hint">Your result will be saved to your profile when the puzzle ends.</div>' : ''}
    </div>`;

  app.querySelectorAll('.connection-tile').forEach(button => {
    button.addEventListener('click', () => toggleSelection(button.dataset.word));
  });
  document.getElementById('shuffle-btn')?.addEventListener('click', () => { words = shuffle(words); render(); });
  document.getElementById('deselect-btn')?.addEventListener('click', () => { selected = []; render(); });
  document.getElementById('submit-btn')?.addEventListener('click', submitSelection);
}

function toggleSelection(word) {
  if (gameOver) return;
  if (selected.includes(word)) selected = selected.filter(value => value !== word);
  else if (selected.length < 4) selected = [...selected, word];
  render();
}

function applySolvedGroup(group) {
  if (!group) return;
  solvedWords = new Set([...solvedWords, ...group.words]);
  solvedColors.add(group.color);
  puzzle.solvedGroups = [...(puzzle.solvedGroups || []).filter(existing => existing.color !== group.color), group];
}

async function submitSelection() {
  if (selected.length !== 4 || gameOver) return;

  const sent = [...selected];
  selected = [];
  const message = document.getElementById('connections-message');
  if (message) message.textContent = 'Checking…';

  try {
    const response = await fetch('api/connections/guess', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puzzleId: puzzle.id, words: sent })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not submit guess.');

    mistakes = Number(result.mistakes || 0);
    solvedColors = new Set(result.solvedColors || []);
    if (result.exact && result.group) applySolvedGroup(result.group);
    if (result.gameOver && Array.isArray(result.answers)) {
      puzzle.solvedGroups = result.answers;
    }
    puzzle.completed = Boolean(result.completed);
    puzzle.score = Number(result.score || 0);
    gameOver = Boolean(result.gameOver);

    if (!result.exact && !gameOver) {
      render();
      document.getElementById('connections-message').textContent = result.oneAway ? 'One away...' : 'Not quite.';
      return;
    }

    render();
    if (gameOver) {
      document.getElementById('connections-message').textContent = accountUsername
        ? (result.completed ? `Great work! +${result.score.toLocaleString()} points saved.` : `${result.score.toLocaleString()} points saved.`)
        : (result.completed ? `Great work! +${result.score.toLocaleString()} points.` : `Game over — ${result.score.toLocaleString()} points.`);
    }
  } catch (error) {
    selected = sent;
    render();
    document.getElementById('connections-message').textContent = error.message;
  }
}

async function init() {
  try {
    accountUsername = await loadAccount();
    const requestedId = new URLSearchParams(location.search).get('id');
    const response = await fetch(`api/connections/puzzle${requestedId ? `?id=${encodeURIComponent(requestedId)}` : ''}`, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('Could not load Connections.');
    const data = await response.json();
    puzzle = data.puzzle;
    if (puzzle) {
      words = shuffle(puzzle.words);
      mistakes = Number(puzzle.mistakes || 0);
      solvedColors = new Set((puzzle.solvedGroups || []).map(group => group.color));
      solvedWords = new Set((puzzle.solvedGroups || []).flatMap(group => group.words));
      gameOver = Boolean(puzzle.gameOver);
      startedAt = Date.now();
    }
    render();

    const archive = document.getElementById('connections-archive-list');
    archive.innerHTML = data.archive?.length
      ? data.archive.map((entry, index) => `<a class="connections-archive-item" href="connections.html?id=${encodeURIComponent(entry.id)}">${escapeHtml(entry.title)}<span>${escapeHtml(entry.date)}${index === 0 ? ' · latest' : ''}</span></a>`).join('')
      : '<div class="connections-empty">no entries currently.</div>';
  } catch (error) {
    document.getElementById('connections-app').innerHTML = `<div class="connections-empty">${escapeHtml(error.message)}</div>`;
  }
}

init();
