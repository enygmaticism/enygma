const loginPanel = document.getElementById('login-panel');
const editorPanel = document.getElementById('editor-panel');
const loginForm = document.getElementById('login-form');
const entryForm = document.getElementById('entry-form');
const loginMessage = document.getElementById('login-message');
const entryMessage = document.getElementById('entry-message');

function showEditor() {
  loginPanel.classList.add('hidden');
  editorPanel.classList.remove('hidden');
}

function showLogin(message = '') {
  loginPanel.classList.remove('hidden');
  editorPanel.classList.add('hidden');
  loginMessage.textContent = message;
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
    type: document.getElementById('entry-type').value,
    title: document.getElementById('entry-title').value,
    date: document.getElementById('entry-date').value,
    content: document.getElementById('entry-content').value
  };

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
  } catch (error) {
    entryMessage.textContent = error.message;
  }
});

document.getElementById('logout-button').addEventListener('click', async () => {
  await fetch('api/admin/check', { method: 'DELETE', credentials: 'same-origin' });
  showLogin('You have been logged out.');
});

document.getElementById('entry-date').value = new Date().toISOString().slice(0, 10);
checkAdminAccess();
