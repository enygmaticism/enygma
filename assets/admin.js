const loginPanel = document.getElementById('login-panel');
const editorPanel = document.getElementById('editor-panel');
const loginForm = document.getElementById('login-form');
const entryForm = document.getElementById('entry-form');
const loginMessage = document.getElementById('login-message');
const entryMessage = document.getElementById('entry-message');
const typeSelect = document.getElementById('entry-type');
const standardFields = document.getElementById('standard-content-fields');
const connectionsFields = document.getElementById('connections-fields');
const connectionsGroups = document.getElementById('connections-groups');

const DIFFICULTIES = [
  { color: 'yellow', label: 'Yellow — easiest' },
  { color: 'green', label: 'Green' },
  { color: 'blue', label: 'Blue' },
  { color: 'purple', label: 'Purple — hardest' }
];

function showEditor() {
  loginPanel.classList.add('hidden');
  editorPanel.classList.remove('hidden');
}

function showLogin(message = '') {
  loginPanel.classList.remove('hidden');
  editorPanel.classList.add('hidden');
  loginMessage.textContent = message;
}

function renderConnectionGroups() {
  connectionsGroups.innerHTML = DIFFICULTIES.map((difficulty, index) => `
    <fieldset class="connections-group-editor ${difficulty.color}">
      <legend>${difficulty.label}</legend>
      <label>Category name
        <input class="connection-category" data-group="${index}" type="text" placeholder="e.g. TYPES OF FISH" required />
      </label>
      <div class="connection-word-grid">
        ${[0,1,2,3].map(wordIndex => `<label>Word ${wordIndex + 1}<input class="connection-word" data-group="${index}" data-word="${wordIndex}" type="text" placeholder="WORD" required /></label>`).join('')}
      </div>
    </fieldset>`).join('');
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
    const password = document.getElementById('password').value;
    const response = await fetch('api/admin/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Incorrect password.');
    document.getElementById('password').value = '';
    showEditor();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
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

  if (payload.type === 'connections') {
    payload.groups = DIFFICULTIES.map((difficulty, index) => ({
      name: document.querySelector(`.connection-category[data-group="${index}"]`).value.trim(),
      color: difficulty.color,
      words: [...document.querySelectorAll(`.connection-word[data-group="${index}"]`)].map(input => input.value.trim())
    }));
    payload.content = '';
  }

  try {
    const response = await fetch('api/admin/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save entry.');
    entryMessage.textContent = 'Entry added to GitHub successfully.';
    entryForm.reset();
    document.getElementById('entry-date').value = new Date().toISOString().slice(0, 10);
    renderConnectionGroups();
    updateEditorMode();
  } catch (error) {
    entryMessage.textContent = error.message;
  }
});

typeSelect.addEventListener('change', updateEditorMode);

document.getElementById('logout-button').addEventListener('click', async () => {
  await fetch('api/admin/check', { method: 'DELETE', credentials: 'same-origin' });
  showLogin('You have been logged out.');
});

document.getElementById('entry-date').value = new Date().toISOString().slice(0, 10);
renderConnectionGroups();
updateEditorMode();
checkAdminAccess();
