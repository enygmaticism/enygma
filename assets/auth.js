const tabs = document.querySelectorAll('.auth-tab');
const loginPanel = document.getElementById('login-panel');
const registerPanel = document.getElementById('register-panel');

tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(item => item.classList.toggle('active', item === tab));
  loginPanel.classList.toggle('hidden', tab.dataset.panel !== 'login-panel');
  registerPanel.classList.toggle('hidden', tab.dataset.panel !== 'register-panel');
}));

loginPanel.addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.getElementById('login-message');
  message.textContent = 'Logging in…';
  try {
    const response = await fetch('api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not log in.');
    location.href = 'profile.html';
  } catch (error) {
    message.textContent = error.message;
  }
});

registerPanel.addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.getElementById('register-message');
  const password = document.getElementById('register-password').value;
  if (password !== document.getElementById('register-confirm').value) {
    message.textContent = 'Passwords do not match.';
    return;
  }
  message.textContent = 'Creating account…';
  try {
    const response = await fetch('api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ username: document.getElementById('register-username').value, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not create account.');
    message.textContent = 'Account created. You can now log in.';
    tabs[0].click();
    document.getElementById('login-username').value = result.username;
  } catch (error) {
    message.textContent = error.message;
  }
});
