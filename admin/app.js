/**
 * Admin UI JavaScript
 * Handles authentication, link management, and UI interactions
 */

// State
let authCredentials = null;
let currentLinks = [];

// API Base URL (adjust for your domain)
const API_BASE = '/api/admin';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  const stored = localStorage.getItem('auth');
  if (stored) {
    authCredentials = stored;
    showAdminScreen();
    loadLinks();
  } else {
    showLoginScreen();
  }

  // Event listeners
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('create-form').addEventListener('submit', handleCreateLink);
  document.getElementById('edit-form').addEventListener('submit', handleEditLink);
  document.getElementById('close-modal').addEventListener('click', closeEditModal);
  document.getElementById('cancel-edit').addEventListener('click', closeEditModal);
});

// Authentication
function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  // Store credentials (Base64 encoded)
  authCredentials = btoa(`${username}:${password}`);
  localStorage.setItem('auth', authCredentials);

  // Test credentials by loading links
  showAdminScreen();
  loadLinks();
}

function handleLogout() {
  authCredentials = null;
  localStorage.removeItem('auth');
  showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('admin-screen').classList.add('hidden');
}

function showAdminScreen() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-screen').classList.remove('hidden');
}

// API Helpers
function getAuthHeaders() {
  return {
    'Authorization': `Basic ${authCredentials}`,
    'Content-Type': 'application/json',
  };
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (response.status === 401 || response.status === 403) {
    // Auth failed - logout
    handleLogout();
    showError('login-error', 'Invalid credentials');
    throw new Error('Authentication failed');
  }

  return response;
}

// Load links
async function loadLinks() {
  const loading = document.getElementById('links-loading');
  const error = document.getElementById('links-error');
  const table = document.getElementById('links-table');
  const noLinks = document.getElementById('no-links');

  loading.style.display = 'block';
  error.style.display = 'none';
  table.classList.add('hidden');
  noLinks.classList.add('hidden');

  try {
    const response = await apiRequest(`${API_BASE}/links?limit=100`);

    if (!response.ok) {
      throw new Error('Failed to load links');
    }

    const data = await response.json();
    currentLinks = data.links || [];

    loading.style.display = 'none';

    if (currentLinks.length === 0) {
      noLinks.classList.remove('hidden');
    } else {
      renderLinks();
      table.classList.remove('hidden');
    }
  } catch (err) {
    loading.style.display = 'none';
    error.textContent = err.message;
    error.style.display = 'block';
  }
}

// Render links table
function renderLinks() {
  const tbody = document.getElementById('links-tbody');
  tbody.innerHTML = '';

  currentLinks.forEach(link => {
    const row = document.createElement('tr');

    const createdDate = new Date(link.createdAt * 1000).toLocaleString();
    const shortUrl = `${window.location.origin}/${link.slug}`;

    row.innerHTML = `
      <td>
        <span class="link-slug">${escapeHtml(link.slug)}</span>
        <button class="btn btn-small btn-secondary" onclick="copyToClipboard('${shortUrl}')">Copy</button>
      </td>
      <td class="link-target" title="${escapeHtml(link.target)}">
        ${escapeHtml(link.target)}
      </td>
      <td>${link.visitCount}</td>
      <td>${createdDate}</td>
      <td class="actions">
        <button class="btn btn-small btn-secondary" onclick="editLink('${escapeHtml(link.slug)}')">Edit</button>
        <button class="btn btn-small btn-danger" onclick="deleteLink('${escapeHtml(link.slug)}')">Delete</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// Create link
async function handleCreateLink(e) {
  e.preventDefault();

  const target = document.getElementById('target-url').value;
  const slug = document.getElementById('custom-slug').value || undefined;
  const status = parseInt(document.getElementById('status-code').value);
  const expiresAtInput = document.getElementById('expires-at').value;

  let expiresAt = null;
  if (expiresAtInput) {
    expiresAt = Math.floor(new Date(expiresAtInput).getTime() / 1000);
  }

  const errorEl = document.getElementById('create-error');
  const successEl = document.getElementById('create-success');
  errorEl.classList.remove('show');
  successEl.classList.remove('show');

  try {
    const response = await apiRequest(`${API_BASE}/links`, {
      method: 'POST',
      body: JSON.stringify({ target, slug, status, expiresAt }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create link');
    }

    const link = await response.json();
    const shortUrl = `${window.location.origin}/${link.slug}`;

    successEl.textContent = `Link created: ${shortUrl}`;
    successEl.classList.add('show');

    // Reset form
    e.target.reset();

    // Reload links
    await loadLinks();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.add('show');
  }
}

// Edit link
function editLink(slug) {
  const link = currentLinks.find(l => l.slug === slug);
  if (!link) return;

  document.getElementById('edit-slug').value = link.slug;
  document.getElementById('edit-target').value = link.target;
  document.getElementById('edit-status').value = link.status;

  if (link.expiresAt) {
    const date = new Date(link.expiresAt * 1000);
    const localDatetime = date.toISOString().slice(0, 16);
    document.getElementById('edit-expires').value = localDatetime;
  } else {
    document.getElementById('edit-expires').value = '';
  }

  document.getElementById('edit-modal').classList.remove('hidden');
}

async function handleEditLink(e) {
  e.preventDefault();

  const slug = document.getElementById('edit-slug').value;
  const target = document.getElementById('edit-target').value;
  const status = parseInt(document.getElementById('edit-status').value);
  const expiresAtInput = document.getElementById('edit-expires').value;

  let expiresAt = null;
  if (expiresAtInput) {
    expiresAt = Math.floor(new Date(expiresAtInput).getTime() / 1000);
  }

  const errorEl = document.getElementById('edit-error');
  errorEl.classList.remove('show');

  try {
    const response = await apiRequest(`${API_BASE}/links/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify({ target, status, expiresAt }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update link');
    }

    closeEditModal();
    await loadLinks();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.add('show');
  }
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  document.getElementById('edit-error').classList.remove('show');
}

// Delete link
async function deleteLink(slug) {
  if (!confirm(`Are you sure you want to delete the link "${slug}"?`)) {
    return;
  }

  try {
    const response = await apiRequest(`${API_BASE}/links/${slug}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete link');
    }

    await loadLinks();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(
    () => {
      alert('Copied to clipboard!');
    },
    (err) => {
      alert('Failed to copy: ' + err);
    }
  );
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.classList.add('show');
}
