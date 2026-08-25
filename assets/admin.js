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
const manageType = document.getElementById('manage-type');
const puzzleList = document.getElementById('puzzle-list');
const editPanel = document.getElementById('edit-panel');
const editForm = document.getElementById('edit-form');

const DIFFICULTIES = [
  { color: 'yellow', label: 'Yellow — easiest' },
  { color: 'green', label: 'Green' },
  { color: 'blue', label: 'Blue' },
  { color: 'purple', label: 'Purple — hardest' }
];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showEditor() {
  loginPanel.classList.add('hidden');
  editorPanel.classList.remove('hidden');
  loadPuzzleList();
}

function showLogin(message = '') {
  loginPanel.classList.remove('hidden');
  editorPanel.classList.add('hidden');
  editPanel.classList.add('hidden');
  loginMessage.textContent = message;
}

function renderConnectionGroups(container = connectionsGroups, prefix = 'new') {
  container.innerHTML = DIFFICULTIES.map((difficulty, index) => `
    <fieldset class="connections-group-editor ${difficulty.color}">
      <legend>${difficulty.label}</legend>
      <label>Category name
        <input class="connection-category" data-prefix="${prefix}" data-group="${index}" type="text" placeholder="e.g. TYPES OF FISH" required />
      </label>
      <div class="connection-word-grid">
        ${[0,1,2,3].map(wordIndex => `<label>Word ${wordIndex + 1}<input class="connection-word" data-prefix="${prefix}" data-group="${index}" data-word="${wordIndex}" type="text" placeholder="WORD" required /></label>`).join('')}
      </div>
    </fieldset>`).join('');
}

function setConnectionGroups(container, groups, prefix) {
  renderConnectionGroups(container, prefix);
  (groups || []).forEach((group, index) => {
    const name = container.querySelector(`.connection-category[data-prefix="${prefix}"][data-group="${index}"]`);
    if (name) name.value = group.name || '';
    (group.words || []).forEach((word, wordIndex) => {
      const input = container.querySelector(`.connection-word[data-prefix="${prefix}"][data-group="${index}"][data-word="${wordIndex}"]`);
      if (input) input.value = word || '';
    });
  });
}

function readConnectionGroups(container, prefix) {
  return DIFFICULTIES.map((difficulty, index) => ({
    name: container.querySelector(`.connection-category[data-prefix="${prefix}"][data-group="${index}"]`).value.trim(),
    color: difficulty.color,
    words: [...container.querySelectorAll(`.connection-word[data-prefix="${prefix}"][data-group="${index}"]`)].map(input => input.value.trim())
  }));
}

function updateEditorMode() {
  const connections = typeSelect.value === 'connections';
  standardFields.classList.toggle('hidden', connections);
  connectionsFields.classList.toggle('hidden', !connections);
}

async function checkAdminAccess() {
  try {
    const response = await fetch('api/admin/check', { cache: 'no-store' });
    if (response.ok) showEditor();
    else showLogin('Enter your admin password.');
  } catch {
    showLogin('Could not reach the admin service.');
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginMessage.textContent = 'Checking…';
  try {
    const response = await fetch('api/admin/check', {
      method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'same-origin',
      body: JSON.stringify({ password: document.getElementById('password').value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Incorrect password.');
    document.getElementById('password').value = '';
    showEditor();
  } catch (error) { loginMessage.textContent = error.message; }
});

entryForm.addEventListener('submit', async event => {
  event.preventDefault();
  entryMessage.textContent = 'Saving…';
  const payload = {
    type: typeSelect.value,
    title: document.getElementById('entry-title').value,
    date: document.getElementById('entry-date').value,
    content: document.getElementById('entry-content').value
  };
  if (payload.type === 'connections') { payload.groups = readConnectionGroups(connectionsGroups, 'new'); payload.content = ''; }
  try {
    const response = await fetch('api/admin/entries', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save entry.');
    entryMessage.textContent = 'Entry added to GitHub successfully.';
    entryForm.reset();
    document.getElementById('entry-date').value = new Date().toISOString().slice(0,10);
    renderConnectionGroups();
    updateEditorMode();
    loadPuzzleList();
  } catch (error) { entryMessage.textContent = error.message; }
});

typeSelect.addEventListener('change', updateEditorMode);
manageType.addEventListener('change', loadPuzzleList);
document.getElementById('refresh-puzzles').addEventListener('click', loadPuzzleList);
document.getElementById('cancel-edit').addEventListener('click', () => editPanel.classList.add('hidden'));

document.getElementById('logout-button').addEventListener('click', async () => {
  await fetch('api/admin/check', {method:'DELETE', credentials:'same-origin'});
  showLogin('You have been logged out.');
});

async function loadPuzzleList() {
  manageMessage.textContent = 'Loading…';
  try {
    const type = manageType.value;
    const response = await fetch(`api/admin/puzzles?type=${encodeURIComponent(type)}`, {cache:'no-store'});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load puzzles.');
    const entries = [...(result.entries || [])].sort((a,b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(a.id)));
    if (!entries.length) puzzleList.innerHTML = '<div class="empty">No puzzles in this category.</div>';
    else puzzleList.innerHTML = entries.map(entry => `
      <div class="puzzle-manager-item">
        <div><strong>${esc(entry.title || entry.date)}</strong><span>${esc(entry.date)}</span></div>
        <div class="puzzle-manager-actions"><button type="button" class="secondary edit-puzzle" data-id="${esc(entry.id)}">Edit</button><button type="button" class="danger delete-puzzle" data-id="${esc(entry.id)}">Delete</button></div>
      </div>`).join('');
    puzzleList.querySelectorAll('.edit-puzzle').forEach(button => button.addEventListener('click', () => editPuzzle(entries.find(e => String(e.id) === button.dataset.id), type)));
    puzzleList.querySelectorAll('.delete-puzzle').forEach(button => button.addEventListener('click', () => deletePuzzle(button.dataset.id, type)));
    manageMessage.textContent = entries.length ? `${entries.length} puzzle${entries.length === 1 ? '' : 's'}.` : '';
  } catch (error) { puzzleList.innerHTML = ''; manageMessage.textContent = error.message; }
}

function editPuzzle(entry, type) {
  if (!entry) return;
  editPanel.classList.remove('hidden');
  document.getElementById('edit-heading').textContent = `Edit ${entry.title || entry.date}`;
  document.getElementById('edit-id').value = entry.id;
  document.getElementById('edit-title').value = entry.title || '';
  document.getElementById('edit-date').value = entry.date || '';
  document.getElementById('edit-content').value = entry.content || '';
  editForm.dataset.type = type;
  const connections = type === 'connections';
  document.getElementById('edit-standard-fields').classList.toggle('hidden', connections);
  document.getElementById('edit-connections-fields').classList.toggle('hidden', !connections);
  if (connections) setConnectionGroups(document.getElementById('edit-connections-groups'), entry.groups, 'edit');
  editPanel.scrollIntoView({behavior:'smooth', block:'start'});
}

editForm.addEventListener('submit', async event => {
  event.preventDefault();
  editMessage.textContent = 'Saving changes…';
  const type = editForm.dataset.type;
  const entry = {
    title: document.getElementById('edit-title').value,
    date: document.getElementById('edit-date').value,
    content: document.getElementById('edit-content').value
  };
  if (type === 'connections') { entry.groups = readConnectionGroups(document.getElementById('edit-connections-groups'), 'edit'); entry.content = ''; }
  try {
    const response = await fetch('api/admin/puzzles', { method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({type, id:document.getElementById('edit-id').value, entry}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save changes.');
    editMessage.textContent = 'Changes saved to GitHub.';
    await loadPuzzleList();
  } catch (error) { editMessage.textContent = error.message; }
});

async function deletePuzzle(id, type) {
  if (!confirm('Delete this puzzle? This cannot be undone.')) return;
  manageMessage.textContent = 'Deleting…';
  try {
    const response = await fetch('api/admin/puzzles', { method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({type,id}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not delete puzzle.');
    editPanel.classList.add('hidden');
    manageMessage.textContent = 'Puzzle deleted.';
    loadPuzzleList();
  } catch (error) { manageMessage.textContent = error.message; }
}

document.getElementById('entry-date').value = new Date().toISOString().slice(0,10);
renderConnectionGroups();
updateEditorMode();
checkAdminAccess();
