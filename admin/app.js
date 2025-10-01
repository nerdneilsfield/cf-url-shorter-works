/**
 * Admin UI JavaScript - Simplified token-based auth
 */

// State
let apiToken = '';
let currentLinks = [];
let filteredLinks = [];
let currentPage = 1;
let pageSize = 10;
let searchQuery = '';
let tokenVisible = false;

// API Base URL
const API_BASE = '/api/admin';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Load token from storage
  const stored = localStorage.getItem('api_token');
  if (stored) {
    apiToken = stored;
    updateTokenDisplay();
  }

  // Event listeners
  document.getElementById('api-token').addEventListener('input', handleTokenChange);
  document.getElementById('toggle-token-visibility').addEventListener('click', toggleTokenVisibility);
  document.getElementById('validate-token-btn').addEventListener('click', validateToken);
  document.getElementById('refresh-btn').addEventListener('click', loadLinks);
  document.getElementById('create-form').addEventListener('submit', handleCreateLink);
  document.getElementById('edit-form').addEventListener('submit', handleEditLink);
  document.getElementById('close-modal').addEventListener('click', closeEditModal);
  document.getElementById('cancel-edit').addEventListener('click', closeEditModal);
  document.getElementById('check-slug-btn').addEventListener('click', checkSlugAvailability);
  document.getElementById('search-btn').addEventListener('click', handleSearch);
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  document.getElementById('prev-page').addEventListener('click', () => changePage(-1));
  document.getElementById('next-page').addEventListener('click', () => changePage(1));
  document.getElementById('jump-btn').addEventListener('click', jumpToPage);

  // Show "no links" initially
  document.getElementById('no-links').classList.remove('hidden');
});

// Token handling
function handleTokenChange(e) {
  const input = e.target;
  // If user is typing, always show as password
  if (input.type === 'text') {
    input.type = 'password';
    tokenVisible = false;
    document.getElementById('visibility-icon').className = 'fas fa-eye';
  }
  apiToken = input.value.trim();
  localStorage.setItem('api_token', apiToken);
}

function maskToken(token) {
  if (!token || token.length <= 6) {
    return token;
  }
  const first3 = token.substring(0, 3);
  const last3 = token.substring(token.length - 3);
  const maskLength = token.length - 6;
  return first3 + '*'.repeat(maskLength) + last3;
}

function updateTokenDisplay() {
  const input = document.getElementById('api-token');
  if (tokenVisible) {
    input.type = 'text';
    input.value = apiToken;
    document.getElementById('visibility-icon').className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    input.value = apiToken;
    document.getElementById('visibility-icon').className = 'fas fa-eye';
  }
}

function toggleTokenVisibility() {
  tokenVisible = !tokenVisible;
  updateTokenDisplay();
}

async function validateToken() {
  if (!apiToken) {
    showToast('Please enter a token first', 'warning');
    return;
  }

  showToast('Validating token...', 'info');

  try {
    // Test token by making a simple API request
    const response = await apiRequest(`${API_BASE}/links?limit=1`);

    if (response.ok) {
      showToast('Token is valid! ✓', 'success');
    } else if (response.status === 401 || response.status === 403) {
      showToast('Invalid token', 'error');
    } else {
      showToast('Unable to validate token (server error)', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Toast Notification System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  toast.className = `${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 min-w-[300px] max-w-md transform transition-all duration-300 ease-in-out translate-x-full`;
  toast.innerHTML = `
    <i class="fas ${icons[type]} text-xl"></i>
    <span class="flex-1">${escapeHtml(message)}</span>
    <button class="text-white hover:text-gray-200 transition" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;

  container.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-x-full');
    toast.classList.add('translate-x-0');
  }, 10);

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// API Helpers
function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

async function apiRequest(url, options = {}) {
  if (!apiToken) {
    throw new Error('Please enter API token first');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Invalid token or unauthorized');
  }

  return response;
}

// Load links
async function loadLinks() {
  const loading = document.getElementById('links-loading');
  const table = document.getElementById('links-table');
  const noLinks = document.getElementById('no-links');

  loading.classList.remove('hidden');
  table.classList.add('hidden');
  noLinks.classList.add('hidden');

  try {
    const response = await apiRequest(`${API_BASE}/links?limit=100`);

    if (!response.ok) {
      throw new Error('Failed to load links');
    }

    const data = await response.json();
    currentLinks = data.links || [];
    filteredLinks = currentLinks;
    currentPage = 1;
    searchQuery = '';
    document.getElementById('search-input').value = '';

    loading.classList.add('hidden');

    if (currentLinks.length === 0) {
      noLinks.classList.remove('hidden');
    } else {
      renderLinksWithPagination();
      table.classList.remove('hidden');
    }
  } catch (err) {
    loading.classList.add('hidden');
    showToast(err.message, 'error');
  }
}

// Render links table with pagination
function renderLinksWithPagination() {
  const tbody = document.getElementById('links-tbody');
  const statsPagination = document.getElementById('stats-pagination');
  const paginationControls = document.getElementById('pagination-controls');
  tbody.innerHTML = '';

  const totalPages = Math.ceil(filteredLinks.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const linksToShow = filteredLinks.slice(startIdx, endIdx);

  linksToShow.forEach(link => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition';

    const createdDate = new Date(link.createdAt * 1000).toLocaleString();
    const shortUrl = `${window.location.origin}/${link.slug}`;

    row.innerHTML = `
      <td class="px-4 py-3">
        <div class="flex items-center space-x-2">
          <span class="font-mono font-semibold text-blue-600">${escapeHtml(link.slug)}</span>
          <button
            class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded transition"
            onclick="copyToClipboard('${shortUrl}')"
            title="Copy short URL"
          >
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </td>
      <td class="px-4 py-3 max-w-xs">
        <div class="flex items-center space-x-2">
          <a href="${escapeHtml(link.target)}" target="_blank" class="text-blue-600 hover:underline truncate flex-1" title="${escapeHtml(link.target)}">
            ${escapeHtml(link.target)}
          </a>
          <button
            class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded transition flex-shrink-0"
            onclick="copyToClipboard('${escapeHtml(link.target).replace(/'/g, "\\'")}')"
            title="Copy target URL"
          >
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
          ${link.visitCount}
        </span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-600">${createdDate}</td>
      <td class="px-4 py-3">
        <div class="flex space-x-2">
          <button
            class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm rounded transition"
            onclick="editLink('${escapeHtml(link.slug)}')"
          >
            <i class="fas fa-edit mr-1"></i> Edit
          </button>
          <button
            class="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded transition"
            onclick="deleteLink('${escapeHtml(link.slug)}')"
          >
            <i class="fas fa-trash mr-1"></i> Delete
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(row);
  });

  // Always show stats if there are links
  if (filteredLinks.length > 0) {
    statsPagination.classList.remove('hidden');

    // Update range info (always visible)
    const rangeStart = startIdx + 1;
    const rangeEnd = Math.min(endIdx, filteredLinks.length);
    document.getElementById('range-start').textContent = rangeStart;
    document.getElementById('range-end').textContent = rangeEnd;
    document.getElementById('total-count').textContent = filteredLinks.length;

    // Show pagination controls only when multiple pages
    if (filteredLinks.length > pageSize) {
      paginationControls.classList.remove('hidden');

      // Update page info
      document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;

      // Update button states
      document.getElementById('prev-page').disabled = currentPage === 1;
      document.getElementById('next-page').disabled = currentPage === totalPages;
      document.getElementById('jump-to-page').max = totalPages;
    } else {
      paginationControls.classList.add('hidden');
    }
  } else {
    statsPagination.classList.add('hidden');
  }
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

    showToast(`Link created: ${shortUrl}`, 'success');

    // Reset form
    e.target.reset();

    // Clear slug check result
    document.getElementById('slug-check-result').textContent = '';
    document.getElementById('slug-check-result').className = '';

    // Reload links
    await loadLinks();
  } catch (err) {
    showToast(err.message, 'error');
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
    showToast(`Link "${slug}" updated successfully!`, 'success');

    // Preserve current search and pagination
    const tempSearch = searchQuery;
    await loadLinks();
    if (tempSearch) {
      document.getElementById('search-input').value = tempSearch;
      handleSearch();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
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

    showToast(`Link "${slug}" deleted successfully!`, 'success');

    // Preserve current search and pagination
    const tempSearch = searchQuery;
    await loadLinks();
    if (tempSearch) {
      document.getElementById('search-input').value = tempSearch;
      handleSearch();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(
    () => {
      showToast('Copied to clipboard!', 'success');
    },
    (err) => {
      showToast('Failed to copy: ' + err, 'error');
    }
  );
}

// Check slug availability
async function checkSlugAvailability() {
  const slug = document.getElementById('custom-slug').value.trim();
  const resultEl = document.getElementById('slug-check-result');

  if (!slug) {
    resultEl.textContent = 'Please enter a slug first';
    resultEl.className = 'text-yellow-600';
    return;
  }

  resultEl.textContent = 'Checking...';
  resultEl.className = 'text-gray-600';

  try {
    const response = await apiRequest(`${API_BASE}/check-slug/${slug}`);

    if (!response.ok) {
      throw new Error('Failed to check slug');
    }

    const data = await response.json();

    if (data.available) {
      resultEl.textContent = '✓ Available';
      resultEl.className = 'text-green-600';
      showToast(`Slug "${slug}" is available!`, 'success');
    } else {
      resultEl.textContent = `✗ ${data.reason || 'Not available'}`;
      resultEl.className = 'text-red-600';
      showToast(data.reason || 'Slug not available', 'error');
    }
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
    resultEl.className = 'text-red-600';
    showToast(err.message, 'error');
  }
}

// Search functionality
function handleSearch() {
  searchQuery = document.getElementById('search-input').value.trim().toLowerCase();
  currentPage = 1;

  if (!searchQuery) {
    filteredLinks = currentLinks;
  } else {
    filteredLinks = currentLinks.filter(link =>
      link.slug.toLowerCase().includes(searchQuery) ||
      link.target.toLowerCase().includes(searchQuery)
    );
  }

  const table = document.getElementById('links-table');
  const noLinks = document.getElementById('no-links');

  if (filteredLinks.length === 0) {
    table.classList.add('hidden');
    noLinks.classList.remove('hidden');
    noLinks.querySelector('p').textContent = searchQuery
      ? 'No links match your search'
      : 'No links found';
  } else {
    noLinks.classList.add('hidden');
    table.classList.remove('hidden');
    renderLinksWithPagination();
  }
}

// Pagination controls
function changePage(delta) {
  const totalPages = Math.ceil(filteredLinks.length / pageSize);
  const newPage = currentPage + delta;

  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    renderLinksWithPagination();
  }
}

function jumpToPage() {
  const input = document.getElementById('jump-to-page');
  const pageNum = parseInt(input.value);
  const totalPages = Math.ceil(filteredLinks.length / pageSize);

  if (pageNum >= 1 && pageNum <= totalPages) {
    currentPage = pageNum;
    renderLinksWithPagination();
  } else {
    alert(`Please enter a page number between 1 and ${totalPages}`);
  }
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
