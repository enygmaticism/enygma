const tabs = document.querySelectorAll('.ranking-tab');
const list = document.getElementById('ranking-list');

function formatTime(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const total = Math.max(0, Math.round(Number(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

async function load(category) {
  list.innerHTML = '<div class="empty">Loading rankings…</div>';
  try {
    const response = await fetch(`api/rankings?category=${encodeURIComponent(category)}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load rankings.');
    list.innerHTML = result.rankings.length ? result.rankings.map(row => `
      <div class="ranking-row">
        <span class="rank-number">${row.rank}</span>
        <span class="rank-user">${row.username}</span>
        <span>${row.played}</span>
        <span>${row.solved}</span>
        <span>${formatTime(row.totalTimeSeconds)}</span>
        <span>${row.played ? formatTime(row.averageTimeSeconds) : '—'}</span>
        <strong>${Number(row.points).toLocaleString()}</strong>
      </div>`).join('') : '<div class="empty">No results yet.</div>';
  } catch (error) {
    list.innerHTML = `<div class="empty">${error.message}</div>`;
  }
}

tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(item => item.classList.toggle('active', item === tab));
  load(tab.dataset.category);
}));

load('all');
