let puzzle = null;
let answers = [];
let locked = false;
let startedAt = Date.now();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function renderPuzzle() {
  const app = document.getElementById('pyramid-app');
  if (!puzzle) {
    app.innerHTML = '<div class="connections-empty">no entries currently.</div>';
    return;
  }
  if (puzzle.alreadyPlayed) {
    app.innerHTML = `<div class="pyramid-result"><h2>Already played</h2><p>You have already played this Pyramid. No redos.</p></div>`;
    return;
  }

  const rows = puzzle.rows || [];
  app.innerHTML = `
    <div class="pyramid-game">
      <div class="connections-date">${escapeHtml(puzzle.date)}</div>
      <div class="pyramid-board-wrap">
        <div class="pyramid-board">
          ${rows.map((row, index) => `
            <div class="pyramid-row-block">
              <div class="pyramid-row" aria-label="Row ${index + 1}">
                ${Array.from({ length: row.length }, (_, letterIndex) => `<div class="pyramid-cell"><input maxlength="1" inputmode="text" autocomplete="off" aria-label="Row ${index + 1}, letter ${letterIndex + 1}" data-row="${index}" data-col="${letterIndex}" /></div>`).join('')}
              </div>
              <div class="pyramid-clue"><span class="pyramid-row-number">${index + 1}</span><span class="pyramid-clue-text">${escapeHtml(row.clue)}</span></div>
            </div>`).join('')}
        </div>
      </div>
      <div class="pyramid-actions">
        <button id="submit-pyramid" class="pyramid-primary">Finish puzzle</button>
        <div id="pyramid-message" class="pyramid-message"></div>
        <div class="pyramid-login-note">You can play this puzzle only once when logged in.</div>
      </div>
    </div>`;

  app.querySelectorAll('.pyramid-cell input').forEach(input => {
    input.addEventListener('input', event => {
      event.target.value = event.target.value.replace(/[^a-z]/gi, '').slice(-1).toUpperCase();
      if (event.target.value) {
        const row = Number(event.target.dataset.row);
        const col = Number(event.target.dataset.col);
        const next = app.querySelector(`input[data-row="${row}"][data-col="${col + 1}"]`) || app.querySelector(`input[data-row="${row + 1}"][data-col="0"]`);
        next?.focus();
      }
    });
  });
  document.getElementById('submit-pyramid').addEventListener('click', submitPuzzle);
}

async function submitPuzzle() {
  if (locked) return;
  const message = document.getElementById('pyramid-message');
  const values = (puzzle.rows || []).map((row, rowIndex) => Array.from({ length: row.length }, (_, col) => document.querySelector(`input[data-row="${rowIndex}"][data-col="${col}"]`)?.value || '').join(''));
  if (values.some(value => !value)) {
    message.textContent = 'Fill every square before finishing.';
    return;
  }

  locked = true;
  message.textContent = 'Checking…';
  try {
    const response = await fetch('api/pyramids/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ puzzleId: puzzle.id, answers: values })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not submit the puzzle.');

    if (result.correct) {
      message.textContent = `Solved! ${formatTime(result.solveTimeSeconds)}.`;
      document.querySelectorAll('.pyramid-cell input').forEach(input => input.disabled = true);
      document.getElementById('submit-pyramid').disabled = true;
    } else {
      message.textContent = 'The pyramid is not correct. This attempt is now recorded and cannot be replayed.';
      document.querySelectorAll('.pyramid-cell input').forEach(input => input.disabled = true);
      document.getElementById('submit-pyramid').disabled = true;
    }
  } catch (error) {
    locked = false;
    message.textContent = error.message;
  }
}

function formatTime(seconds) {
  const value = Number(seconds || 0);
  const min = Math.floor(value / 60);
  const sec = value % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

async function init() {
  try {
    const requestedId = new URLSearchParams(location.search).get('id');
    const url = requestedId ? `api/pyramids/puzzle?id=${encodeURIComponent(requestedId)}` : 'api/pyramids/puzzle';
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load puzzle.');
    puzzle = data.puzzle;
    startedAt = Date.now();
    renderPuzzle();

    const archive = document.getElementById('pyramid-archive-list');
    const entries = data.archive || [];
    archive.innerHTML = entries.length ? entries.map((entry, index) => `<a class="pyramid-archive-item" href="pyramids.html?id=${encodeURIComponent(entry.id)}"><span>${escapeHtml(entry.title)}</span><span>${escapeHtml(entry.date)}${index === 0 ? ' · latest' : ''}</span></a>`).join('') : '<div class="connections-empty">no entries currently.</div>';
  } catch (error) {
    document.getElementById('pyramid-app').innerHTML = `<div class="connections-empty">${escapeHtml(error.message)}</div>`;
  }
}

init();
