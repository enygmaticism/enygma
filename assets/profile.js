const LABELS = { connections: 'Connections', crosswords: 'Crosswords', pyramids: 'Pyramids' };

function formatTime(seconds) {
  if (seconds == null) return '—';
  const total = Number(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return minutes ? `${minutes}m ${secs}s` : `${secs}s`;
}

async function load() {
  try {
    const response = await fetch('api/stats?mode=profile', { credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) {
      location.href = 'login.html';
      return;
    }
    document.getElementById('profile-username').textContent = result.username;
    const totalPoints = Object.values(result.stats).reduce((sum, stat) => sum + stat.points, 0);
    document.getElementById('total-points').textContent = totalPoints.toLocaleString();
    document.getElementById('record-grid').innerHTML = Object.entries(LABELS).map(([key, label]) => {
      const stat = result.stats[key];
      return `<article class="record-card"><div class="section-label">${label}</div><div class="record-main"><strong>${stat.solved}</strong><span>solved</span></div><dl><div><dt>Average time</dt><dd>${formatTime(stat.averageTimeSeconds)}</dd></div><div><dt>Points</dt><dd>${Number(stat.points).toLocaleString()}</dd></div>${key === 'connections' ? `<div><dt>Categories solved</dt><dd>${stat.categoriesSolved}</dd></div>` : ''}</dl></article>`;
    }).join('');
    const history = document.getElementById('result-history');
    history.innerHTML = result.results.length ? result.results.slice(0, 30).map(item => `<div class="result-row"><span>${LABELS[item.type] || item.type}</span><span>${item.puzzleDate}</span><span>${item.completed ? 'Solved' : `${item.groupsSolved} groups`}</span><strong>+${Number(item.score).toLocaleString()}</strong></div>`).join('') : '<div class="empty">No puzzle results yet.</div>';
  } catch {
    location.href = 'login.html';
  }
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  location.href = 'index.html';
});
load();
