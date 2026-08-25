const nav = document.querySelector('.home-nav');

async function updateAccountLink() {
  try {
    const response = await fetch('api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json();
    const accountLink = document.getElementById('account-link');
    if (!accountLink) return;
    if (response.ok && data.loggedIn) {
      accountLink.textContent = 'Profile';
      accountLink.href = 'profile.html';
    } else {
      accountLink.textContent = 'Log in';
      accountLink.href = 'login.html';
    }
  } catch {
    const accountLink = document.getElementById('account-link');
    if (accountLink) {
      accountLink.textContent = 'Log in';
      accountLink.href = 'login.html';
    }
  }
}

updateAccountLink();
