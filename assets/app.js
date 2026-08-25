const CONFIG = {
  connections: { title: 'Connections', description: 'Find the four groups.' },
  crosswords: { title: 'Crosswords', description: 'Clues, crossings and deductions.' },
  pyramids: { title: 'Pyramids', description: 'Build your way to the top.' }
};

async function loadEntries() {
  const response = await fetch('data/entries.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load entries');
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

async function renderCategory() {
  const type = new URLSearchParams(location.search).get('type');
  const config = CONFIG[type];
  if (!config) { location.href = 'index.html'; return; }
  document.title = `Enygma — ${config.title}`;
  document.getElementById('category-label').textContent = 'Category';
  document.getElementById('category-title').textContent = config.title;
  document.getElementById('category-description').textContent = config.description;
  const latest = document.getElementById('latest-entry');
  const archive = document.getElementById('archive-list');
  try {
    const data = await loadEntries();
    const entries = [...(data[type] || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
    if (!entries.length) {
      latest.innerHTML = '<div class="empty">no entries currently.</div>';
      archive.innerHTML = '<div class="empty">no entries currently.</div>';
      return;
    }
    const newest = entries[0];
    latest.innerHTML = `<article class="latest-entry"><div class="section-label">${escapeHtml(newest.date)}</div><h2>${escapeHtml(newest.title)}</h2>${newest.content ? `<p>${escapeHtml(newest.content)}</p>` : ''}</article>`;
    archive.innerHTML = entries.map((entry, index) => `<div class="archive-item"><span>${escapeHtml(entry.title)}${index === 0 ? ' — latest' : ''}</span><span>${escapeHtml(entry.date)}</span></div>`).join('');
  } catch (error) {
    latest.innerHTML = '<div class="empty">Unable to load entries.</div>';
    archive.innerHTML = '';
  }
}

if (location.pathname.endsWith('/category.html') || location.pathname.endsWith('category.html')) renderCategory();
