const loginPanel = document.getElementById('login-panel');
const editorPanel = document.getElementById('editor-panel');
const entryForm = document.getElementById('entry-form');
const loginMessage = document.getElementById('login-message');
const entryMessage = document.getElementById('entry-message');

async function checkAdminAccess() {
  try {
    const response = await fetch('api/admin/check', { cache: 'no-store' });
    if (!response.ok) throw new Error('not allowed');
    const result = await response.json();
    if (!result.allowed) throw new Error('not allowed');
    loginPanel.classList.add('hidden');
    editorPanel.classList.remove('hidden');
  } catch {
    loginPanel.classList.remove('hidden');
    editorPanel.classList.add('hidden');
    loginMessage.textContent = 'Admin access is available only from the configured IP address.';
  }
}

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

document.getElementById('entry-date').value = new Date().toISOString().slice(0, 10);
checkAdminAccess();
