const SESSION_KEY = 'enygma-admin-session';

const loginPanel = document.getElementById('login-panel');
const editorPanel = document.getElementById('editor-panel');
const loginForm = document.getElementById('login-form');
const entryForm = document.getElementById('entry-form');

function setLoggedIn(value) {
  sessionStorage.setItem(SESSION_KEY, value ? '1' : '0');
  loginPanel.classList.toggle('hidden', value);
  editorPanel.classList.toggle('hidden', !value);
}

if (sessionStorage.getItem(SESSION_KEY) === '1') setLoggedIn(true);

document.getElementById('entry-date').value = new Date().toISOString().slice(0, 10);

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  const password = document.getElementById('password').value;
  const message = document.getElementById('login-message');
  // Placeholder only. A password embedded in frontend JavaScript is NOT secure.
  message.textContent = 'Authentication endpoint not connected yet. The secure GitHub-backed login will be added before deployment.';
});

entryForm.addEventListener('submit', event => {
  event.preventDefault();
  document.getElementById('entry-message').textContent = 'The editor UI is ready. GitHub write access will be connected through a secure server-side endpoint next.';
});

document.getElementById('logout-button').addEventListener('click', () => setLoggedIn(false));
