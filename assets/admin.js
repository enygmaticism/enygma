const loginPanel = document.getElementById('login-panel');
const editorPanel = document.getElementById('editor-panel');
const loginForm = document.getElementById('login-form');
const entryForm = document.getElementById('entry-form');
const loginMessage = document.getElementById('login-message');
const entryMessage = document.getElementById('entry-message');
const manageMessage = document.getElementById('manage-message');
const editMessage = document.getElementById('edit-message');
const typeSelect = document.getElementById('entry-type');
const standardFields = document.getElementById('standard-content-fields');
const connectionsFields = document.getElementById('connections-fields');
const connectionsGroups = document.getElementById('connections-groups');
const pyramidsFields = document.getElementById('pyramids-fields');
const pyramidRowCount = document.getElementById('pyramid-row-count');
const pyramidRows = document.getElementById('pyramid-rows');
const manageType = document.getElementById('manage-type');
const puzzleList = document.getElementById('puzzle-list');
const editPanel = document.getElementById('edit-panel');
const editForm = document.getElementById('edit-form');
const editConnectionsFields = document.getElementById('edit-connections-fields');
const editPyramidsFields = document.getElementById('edit-pyramids-fields');
const editConnectionsGroups = document.getElementById('edit-connections-groups');
const editPyramidRows = document.getElementById('edit-pyramid-rows');

const DIFFICULTIES = [
  { color: 'yellow', label: 'Yellow — easiest' },
  { color: 'green', label: 'Green' },
  { color: 'blue', label: 'Blue' },
  { color: 'purple', label: 'Purple — hardest' }
];

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function showEditor() { loginPanel.classList.add('hidden'); editorPanel.classList.remove('hidden'); loadPuzzleList(); }
function showLogin(message = '') { loginPanel.classList.remove('hidden'); editorPanel.classList.add('hidden'); editPanel.classList.add('hidden'); loginMessage.textContent = message; }

function renderConnectionGroups(container = connectionsGroups, prefix = 'new') {
  container.innerHTML = DIFFICULTIES.map((difficulty, index) => `
    <fieldset class="connections-group-editor ${difficulty.color}">
      <legend>${difficulty.label}</legend>
      <label>Category name<input class="connection-category" data-prefix="${prefix}" data-group="${index}" type="text" required /></label>
      <div class="connection-word-grid">${[0,1,2,3].map(wordIndex => `<label>Word ${wordIndex + 1}<input class="connection-word" data-prefix="${prefix}" data-group="${index}" data-word="${wordIndex}" type="text" required /></label>`).join('')}</div>
    </fieldset>`).join('');
}
function setConnectionGroups(container, groups, prefix) {
  renderConnectionGroups(container, prefix);
  (groups || []).forEach((group, index) => {
    const name = container.querySelector(`.connection-category[data-prefix="${prefix}"][data-group="${index}"]`); if (name) name.value = group.name || '';
    (group.words || []).forEach((word, wordIndex) => { const input = container.querySelector(`.connection-word[data-prefix="${prefix}"][data-group="${index}"][data-word="${wordIndex}"]`); if (input) input.value = word || ''; });
  });
}
function readConnectionGroups(container, prefix) {
  return DIFFICULTIES.map((difficulty, index) => ({
    name: container.querySelector(`.connection-category[data-prefix="${prefix}"][data-group="${index}"]`).value.trim(),
    color: difficulty.color,
    words: [...container.querySelectorAll(`.connection-word[data-prefix="${prefix}"][data-group="${index}"]`)].map(input => input.value.trim())
  }));
}

function renderPyramidRows(container, rows = [], count = rows.length || Number(pyramidRowCount?.value || 1)) {
  const safeCount = Math.max(1, Math.min(30, Number(count) || 1));
  container.innerHTML = Array.from({ length: safeCount }, (_, index) => {
    const row = rows[index] || {};
    return `<div class="pyramid-row-editor">
      <h3>Row ${index + 1} — ${index + 1} letter${index === 0 ? '' : 's'}</h3>
      <div class="pyramid-row-editor-grid">
        <label>Clue<input class="pyramid-clue-input" data-row="${index}" type="text" required value="${esc(row.clue || '')}" /></label>
        <label>Answer<input class="pyramid-answer-input" data-row="${index}" type="text" maxlength="${index + 1}" required value="${esc(row.answer || '')}" /></label>
      </div>
    </div>`;
  }).join('');
}
function readPyramidRows(container) {
  return [...container.querySelectorAll('.pyramid-row-editor')].map((_, index) => ({
    clue: container.querySelector(`.pyramid-clue-input[data-row="${index}"]`).value.trim(),
    answer: container.querySelector(`.pyramid-answer-input[data-row="${index}"]`).value.trim().toUpperCase().replace(/[^A-Z]/g, '')
  }));
}

function updateEditorMode() {
  const type = typeSelect.value;
  standardFields.classList.toggle('hidden', type !== 'crosswords');
  connectionsFields.classList.toggle('hidden', type !== 'connections');
  pyramidsFields.classList.toggle('hidden', type !== 'pyramids');
}

async function checkAdminAccess() {
  try {
    const response = await fetch('api/admin/check', { cache: 'no-store' });
    if (response.ok) showEditor(); else showLogin('Enter your admin password.');
  } catch { showLogin('Could not reach the admin service.'); }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault(); loginMessage.textContent = 'Checking…';
  try {
    const response = await fetch('api/admin/check', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'same-origin', body: JSON.stringify({ password: document.getElementById('password').value }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Incorrect password.');
    document.getElementById('password').value = ''; showEditor();
  } catch (error) { loginMessage.textContent = error.message; }
});

entryForm.addEventListener('submit', async event => {
  event.preventDefault(); entryMessage.textContent = 'Saving…';
  const type = typeSelect.value;
  const payload = { type, title: document.getElementById('entry-title').value.trim(), date: document.getElementById('entry-date').value, content: document.getElementById('entry-content').value };
  let endpoint = 'api/admin/entries';
  if (type === 'connections') { payload.groups = readConnectionGroups(connectionsGroups, 'new'); payload.content = ''; }
  if (type === 'pyramids') { payload.rows = readPyramidRows(pyramidRows); endpoint = 'api/admin/pyramids'; delete payload.content; }
  try {
    const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify(payload) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save entry.');
    entryMessage.textContent = 'Entry added to GitHub successfully.';
    entryForm.reset(); document.getElementById('entry-date').value = new Date().toISOString().slice(0,10);
    renderConnectionGroups(); renderPyramidRows(pyramidRows, [], 10); updateEditorMode(); loadPuzzleList();
  } catch (error) { entryMessage.textContent = error.message; }
});

typeSelect.addEventListener('change', updateEditorMode);
pyramidRowCount.addEventListener('input', () => renderPyramidRows(pyramidRows, [], Number(pyramidRowCount.value || 1)));
manageType.addEventListener('change', loadPuzzleList);
document.getElementById('refresh-puzzles').addEventListener('click', loadPuzzleList);
document.getElementById('cancel-edit').addEventListener('click', () => editPanel.classList.add('hidden'));
document.getElementById('logout-button').addEventListener('click', async () => { await fetch('api/admin/check', {method:'DELETE', credentials:'same-origin'}); showLogin('You have been logged out.'); });

async function loadPuzzleList() {
  manageMessage.textContent = 'Loading…';
  try {
    const type = manageType.value;
    const endpoint = type === 'pyramids' ? 'api/admin/pyramids' : `api/admin/puzzles?type=${encodeURIComponent(type)}`;
    const response = await fetch(endpoint, {cache:'no-store'}); const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load puzzles.');
    const entries = [...(result.entries || [])].sort((a,b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(a.id)));
    puzzleList.innerHTML = entries.length ? entries.map(entry => `<div class="puzzle-manager-item"><div><strong>${esc(entry.title || entry.date)}</strong><span>${esc(entry.date)}</span></div><div class="puzzle-manager-actions"><button type="button" class="secondary edit-puzzle" data-id="${esc(entry.id)}">Edit</button><button type="button" class="danger delete-puzzle" data-id="${esc(entry.id)}">Delete</button></div></div>`).join('') : '<div class="empty">No puzzles in this category.</div>';
    puzzleList.querySelectorAll('.edit-puzzle').forEach(button => button.addEventListener('click', () => editPuzzle(entries.find(e => String(e.id) === button.dataset.id), type)));
    puzzleList.querySelectorAll('.delete-puzzle').forEach(button => button.addEventListener('click', () => deletePuzzle(button.dataset.id, type)));
    manageMessage.textContent = entries.length ? `${entries.length} puzzle${entries.length === 1 ? '' : 's'}.` : '';
  } catch (error) { puzzleList.innerHTML = ''; manageMessage.textContent = error.message; }
}

function editPuzzle(entry, type) {
  editPanel.classList.remove('hidden');
  document.getElementById('edit-heading').textContent = `Edit ${entry.title || entry.date}`;
  document.getElementById('edit-id').value = entry.id;
  document.getElementById('edit-title').value = entry.title || '';
  document.getElementById('edit-date').value = entry.date || '';
  document.getElementById('edit-content').value = entry.content || '';
  editForm.dataset.type = type;
  editConnectionsFields.classList.toggle('hidden', type !== 'connections');
  editPyramidsFields.classList.toggle('hidden', type !== 'pyramids');
  document.getElementById('edit-standard-fields').classList.toggle('hidden', type !== 'crosswords');
  if (type === 'connections') setConnectionGroups(editConnectionsGroups, entry.groups, 'edit');
  if (type === 'pyramids') renderPyramidRows(editPyramidRows, entry.rows || [], (entry.rows || []).length || 1);
  editPanel.scrollIntoView({behavior:'smooth', block:'start'});
}

editForm.addEventListener('submit', async event => {
  event.preventDefault(); editMessage.textContent = 'Saving changes…';
  const type = editForm.dataset.type;
  const id = document.getElementById('edit-id').value;
  const entry = { title: document.getElementById('edit-title').value.trim(), date: document.getElementById('edit-date').value, content: document.getElementById('edit-content').value };
  let endpoint = 'api/admin/puzzles';
  if (type === 'connections') { entry.groups = readConnectionGroups(editConnectionsGroups, 'edit'); entry.content = ''; }
  if (type === 'pyramids') { entry.rows = readPyramidRows(editPyramidRows); endpoint = 'api/admin/pyramids'; delete entry.content; }
  try {
    const body = type === 'pyramids' ? { type, id, title: entry.title, date: entry.date, rows: entry.rows } : { type, id, entry };
    const response = await fetch(endpoint, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify(body) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save changes.');
    editMessage.textContent = 'Changes saved to GitHub.'; await loadPuzzleList();
  } catch (error) { editMessage.textContent = error.message; }
});

async function deletePuzzle(id, type) {
  if (!confirm('Delete this puzzle? This cannot be undone.')) return;
  manageMessage.textContent = 'Deleting…';
  try {
    const endpoint = type === 'pyramids' ? 'api/admin/pyramids' : 'api/admin/puzzles';
    const response = await fetch(endpoint, { method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({type,id}) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not delete puzzle.');
    editPanel.classList.add('hidden'); await loadPuzzleList();
  } catch (error) { manageMessage.textContent = error.message; }
}

document.getElementById('entry-date').value = new Date().toISOString().slice(0,10);
renderConnectionGroups(); renderPyramidRows(pyramidRows, [], 10); updateEditorMode(); checkAdminAccess();
