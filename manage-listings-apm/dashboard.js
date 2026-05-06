// dashboard.js — admin landing page logic
// Wires Netlify Identity widget for login/logout state.

(function () {
  'use strict';

  const loginEl = document.getElementById('dash-login');
  const contentEl = document.getElementById('dash-content');
  const userEl = document.getElementById('dash-user');
  const logoutBtn = document.getElementById('dash-logout');
  const loginBtn = document.getElementById('dash-login-btn');
  const greetingNameEl = document.getElementById('dash-greeting-name');

  function showLoggedOut() {
    loginEl.hidden = false;
    contentEl.hidden = true;
    userEl.textContent = '';
    logoutBtn.hidden = true;
  }

  function showLoggedIn(user) {
    loginEl.hidden = true;
    contentEl.hidden = false;
    const display = (user && (user.user_metadata?.full_name || user.email)) || '';
    userEl.textContent = display;
    logoutBtn.hidden = false;

    // Greeting personalization (default keeps "Jill")
    const firstName = (user?.user_metadata?.full_name || '').split(' ')[0];
    if (firstName && greetingNameEl) {
      greetingNameEl.innerHTML = `Hi <em>${firstName}</em> 👋`;
    }
  }

  if (!window.netlifyIdentity) {
    // Identity widget didn't load — show login state, let Decap handle auth.
    showLoggedOut();
    if (loginBtn) loginBtn.onclick = () => (window.location.href = '/manage-listings-apm/edit/');
    return;
  }

  window.netlifyIdentity.on('init', user => {
    if (user) showLoggedIn(user);
    else showLoggedOut();
  });

  window.netlifyIdentity.on('login', user => {
    showLoggedIn(user);
    window.netlifyIdentity.close();
  });

  window.netlifyIdentity.on('logout', () => {
    showLoggedOut();
  });

  if (loginBtn) {
    loginBtn.addEventListener('click', () => window.netlifyIdentity.open('login'));
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => window.netlifyIdentity.logout());
  }
})();
