const DEFAULT_TAGS = [
  'connected',
  'collaborated',
  'potential',
  'replied',
  'no_response',
  'follow_up',
  'partner',
  'creator',
  'investor',
  'media',
  'competitor'
];

const DEFAULT_STATUSES = [
  'new',
  'connected',
  'collaborated',
  'potential',
  'replied',
  'no_response',
  'follow_up'
];

const state = {
  currentAccount: null,
  activeTargetEl: null,
  fab: null,
  modal: null,
  hideTimer: null
};

const FAB_OFFSET = 8;
const VIEWPORT_PADDING = 12;
const HIDE_DELAY_MS = 380;

function logDebug(message, payload) {
  console.debug(`[KOL Collector] ${message}`, payload || '');
}

function normalizeHandle(value = '') {
  const handle = value.trim().replace(/^@+/, '');
  return handle ? `@${handle.toLowerCase()}` : '';
}

function isProfilePath(pathname = '') {
  const match = pathname.match(/^\/([A-Za-z0-9_]{1,15})$/);
  return match ? match[1] : null;
}

function extractFromLink(link) {
  if (!link?.href) return null;

  let url;
  try {
    url = new URL(link.href, location.origin);
  } catch {
    return null;
  }

  const username = isProfilePath(url.pathname);
  if (!username) return null;

  const container = link.closest('article, [data-testid="UserCell"], [data-testid="HoverCard"], div[role="link"], section') || link.parentElement;
  const textNodes = Array.from(container?.querySelectorAll('span') || [])
    .map((node) => node.textContent?.trim())
    .filter(Boolean);

  const explicitHandle = textNodes.find((text) => /^@[A-Za-z0-9_]{1,15}$/.test(text));
  const displayName = textNodes.find((text) => text !== explicitHandle && !text.startsWith('@') && !text.startsWith('·')) || username;
  const bioCandidate = Array.from(container?.querySelectorAll('[data-testid="UserDescription"], div[dir="auto"]') || [])
    .map((node) => node.textContent?.trim())
    .find((text) => text && text !== displayName && text !== explicitHandle);
  const avatar = container?.querySelector('img[src*="profile_images"], img[src*="pbs.twimg.com"]');

  return {
    display_name: displayName,
    handle: normalizeHandle(explicitHandle || username),
    profile_url: `https://x.com/${username}`,
    bio: bioCandidate || '',
    avatar_url: avatar?.src || ''
  };
}

function getAccountTargetElement(target) {
  if (!(target instanceof Element)) return null;

  const hoverCard = target.closest('[data-testid="HoverCard"]');
  if (hoverCard) {
    logDebug('hover card detected', hoverCard);
    return hoverCard;
  }

  return (
    target.closest(
      '[data-testid="UserCell"], [data-testid="User-Name"], article, a[href^="/"], div[role="link"], section'
    ) || target.closest('a') || target
  );
}

function isHoverCardElement(element) {
  return element instanceof Element && element.matches('[data-testid="HoverCard"]');
}

function findFollowButton(hoverCardEl) {
  if (!isHoverCardElement(hoverCardEl)) return null;

  return hoverCardEl.querySelector(
    '[data-testid$="follow" i], [data-testid$="unfollow" i], [aria-label*="Follow" i], [aria-label*="Following" i], div[role="button"], button'
  );
}

function getAccountContext(target) {
  const targetEl = getAccountTargetElement(target);
  if (!targetEl) return null;
  const account = extractAccountData(targetEl) || extractAccountData(target);
  if (!account?.handle) return null;
  logDebug('active target detected', {
    handle: account.handle,
    targetTag: targetEl.tagName,
    testId: targetEl.getAttribute('data-testid')
  });
  return { account, targetEl };
}

function extractAccountData(target) {
  const link = target.closest('a[href*="/" i]');
  if (link) {
    const fromLink = extractFromLink(link);
    if (fromLink?.handle) return fromLink;
  }

  const text = target.textContent?.trim() || '';
  const handleMatch = text.match(/@([A-Za-z0-9_]{1,15})/);
  if (!handleMatch) return null;

  const handle = normalizeHandle(handleMatch[0]);
  return {
    display_name: handle.slice(1),
    handle,
    profile_url: `https://x.com/${handle.slice(1)}`,
    bio: '',
    avatar_url: ''
  };
}

function ensureFab() {
  if (state.fab) return state.fab;
  const button = document.createElement('button');
  button.className = 'kol-collector-fab';
  button.type = 'button';
  button.textContent = '+ Collect';
  button.style.display = 'none';
  button.addEventListener('mouseenter', () => clearTimeout(state.hideTimer));
  button.addEventListener('mouseleave', scheduleHideFab);
  button.addEventListener('click', () => {
    if (state.currentAccount) {
      openModal(state.currentAccount);
    }
  });
  document.body.appendChild(button);
  state.fab = button;
  return button;
}

function hideFab() {
  clearTimeout(state.hideTimer);
  if (state.fab) state.fab.style.display = 'none';
}

function scheduleHideFab() {
  clearTimeout(state.hideTimer);
  state.hideTimer = window.setTimeout(() => {
    hideFab();
  }, HIDE_DELAY_MS);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function positionFloatingElement(element, targetEl, preferredWidth = null) {
  if (!element || !targetEl?.isConnected) return;
  const rect = targetEl.getBoundingClientRect();
  const elementWidth = preferredWidth || element.offsetWidth || 40;
  const elementHeight = element.offsetHeight || 40;

  let left = rect.right + FAB_OFFSET;
  let top = rect.top + rect.height / 2 - elementHeight / 2;

  if (left + elementWidth > window.innerWidth - VIEWPORT_PADDING) {
    left = rect.right - elementWidth;
  }

  if (left + elementWidth > window.innerWidth - VIEWPORT_PADDING) {
    left = rect.left - elementWidth - FAB_OFFSET;
  }

  if (left < VIEWPORT_PADDING) {
    left = clamp(rect.left, VIEWPORT_PADDING, window.innerWidth - elementWidth - VIEWPORT_PADDING);
  }

  top = clamp(top, VIEWPORT_PADDING, window.innerHeight - elementHeight - VIEWPORT_PADDING);

  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(top)}px`;

  logDebug('button positioned', {
    top: Math.round(top),
    left: Math.round(left),
    targetRect: {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom)
    }
  });
}

function positionElementBelowAnchor(element, anchorRect, boundsRect, preferredWidth = null) {
  const elementWidth = preferredWidth || element.offsetWidth || 40;
  const elementHeight = element.offsetHeight || 40;

  let left = anchorRect.left;
  let top = anchorRect.bottom + FAB_OFFSET;

  if (left + elementWidth > window.innerWidth - VIEWPORT_PADDING) {
    left = window.innerWidth - elementWidth - VIEWPORT_PADDING;
  }

  if (left < VIEWPORT_PADDING) {
    left = VIEWPORT_PADDING;
  }

  if (top + elementHeight > window.innerHeight - VIEWPORT_PADDING) {
    top = Math.max(VIEWPORT_PADDING, boundsRect.top - elementHeight - FAB_OFFSET);
  }

  top = clamp(top, VIEWPORT_PADDING, window.innerHeight - elementHeight - VIEWPORT_PADDING);

  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(top)}px`;

  logDebug('button positioned', {
    mode: 'below-follow',
    top: Math.round(top),
    left: Math.round(left),
    anchorRect: {
      top: Math.round(anchorRect.top),
      left: Math.round(anchorRect.left),
      right: Math.round(anchorRect.right),
      bottom: Math.round(anchorRect.bottom)
    }
  });
}

function positionHoverCardCorner(element, hoverCardEl, preferredWidth = null) {
  const rect = hoverCardEl.getBoundingClientRect();
  const elementWidth = preferredWidth || element.offsetWidth || 40;
  const elementHeight = element.offsetHeight || 40;

  let left = rect.right - elementWidth - VIEWPORT_PADDING;
  let top = rect.bottom - elementHeight - VIEWPORT_PADDING;

  left = clamp(left, VIEWPORT_PADDING, window.innerWidth - elementWidth - VIEWPORT_PADDING);
  top = clamp(top, VIEWPORT_PADDING, window.innerHeight - elementHeight - VIEWPORT_PADDING);

  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(top)}px`;

  logDebug('button positioned', {
    mode: 'hover-card-bottom-right',
    top: Math.round(top),
    left: Math.round(left),
    targetRect: {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom)
    }
  });
}

function positionForHoverCard(element, hoverCardEl, preferredWidth = null) {
  const followButton = findFollowButton(hoverCardEl);
  if (followButton) {
    positionElementBelowAnchor(element, followButton.getBoundingClientRect(), hoverCardEl.getBoundingClientRect(), preferredWidth);
    return;
  }

  positionHoverCardCorner(element, hoverCardEl, preferredWidth);
}

function updateButtonPosition(targetEl = state.activeTargetEl) {
  if (!state.fab || !targetEl?.isConnected) return;
  if (isHoverCardElement(targetEl)) {
    positionForHoverCard(state.fab, targetEl);
    return;
  }
  positionFloatingElement(state.fab, targetEl);
}

function updateModalPosition(targetEl = state.activeTargetEl) {
  if (!state.modal || !targetEl?.isConnected) return;
  if (isHoverCardElement(targetEl)) {
    positionHoverCardCorner(state.modal, targetEl, state.modal.offsetWidth || 340);
    return;
  }
  positionFloatingElement(state.modal, targetEl, state.modal.offsetWidth || 340);
}

function setActiveTarget(account, targetEl) {
  const changed = state.activeTargetEl !== targetEl;
  state.currentAccount = account;
  state.activeTargetEl = targetEl;
  if (changed) {
    logDebug('target changed', {
      handle: account.handle,
      targetTag: targetEl?.tagName,
      testId: targetEl?.getAttribute?.('data-testid') || null
    });
  }
}

function showFab(account, targetEl) {
  const fab = ensureFab();
  setActiveTarget(account, targetEl);
  clearTimeout(state.hideTimer);
  fab.style.display = 'block';
  updateButtonPosition(targetEl);
}

async function fetchFilterOptions() {
  try {
    const response = await fetch('http://127.0.0.1:43112/contacts/filters');
    if (!response.ok) throw new Error('Failed to load filter options');
    return await response.json();
  } catch {
    return { tags: DEFAULT_TAGS, statuses: DEFAULT_STATUSES };
  }
}

function closeModal() {
  state.modal?.remove();
  state.modal = null;
}

function renderTagButtons(selected, suggestions) {
  return suggestions
    .map(
      (tag) =>
        `<button type="button" class="kol-collector-tag ${selected.includes(tag) ? 'active' : ''}" data-tag="${tag}">${tag}</button>`
    )
    .join('');
}

async function saveContact(payload, mode = 'upsert') {
  const url = mode === 'update' && payload.id
    ? `http://127.0.0.1:43112/contacts/${payload.id}`
    : 'http://127.0.0.1:43112/contacts/upsert';
  const method = mode === 'update' && payload.id ? 'PUT' : 'POST';
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok && !data.record) {
    throw new Error(data.error || 'Failed to save contact');
  }
  return data;
}

async function openModal(account) {
  closeModal();
  const options = await fetchFilterOptions();
  const modal = document.createElement('div');
  modal.className = 'kol-collector-modal';

  const formState = {
    ...account,
    notes: '',
    tags: [],
    relationship_status: 'new'
  };

  modal.innerHTML = `
    <form>
      <strong>Collect X account</strong>
      <label>
        <span>Display Name</span>
        <input name="display_name" value="${escapeHtml(formState.display_name || '')}" />
      </label>
      <label>
        <span>Handle</span>
        <input name="handle" value="${escapeHtml(formState.handle || '')}" />
      </label>
      <label>
        <span>Profile URL</span>
        <input name="profile_url" value="${escapeHtml(formState.profile_url || '')}" />
      </label>
      <label>
        <span>Notes</span>
        <textarea name="notes" rows="4"></textarea>
      </label>
      <div>
        <div style="margin-bottom: 6px;">Tags</div>
        <div class="kol-collector-tags">${renderTagButtons(formState.tags, options.tags || DEFAULT_TAGS)}</div>
      </div>
      <label>
        <span>Relationship Status</span>
        <select name="relationship_status">
          ${(options.statuses || DEFAULT_STATUSES)
            .map((status) => `<option value="${status}">${status}</option>`)
            .join('')}
        </select>
      </label>
      <div class="kol-collector-banner" style="display:none"></div>
      <div class="kol-collector-actions">
        <button type="submit" class="kol-collector-save">Save</button>
        <button type="button" class="kol-collector-cancel">Cancel</button>
      </div>
    </form>
  `;

  modal.querySelector('.kol-collector-cancel').addEventListener('click', closeModal);
  modal.querySelectorAll('[data-tag]').forEach((button) => {
    button.addEventListener('click', () => {
      const tag = button.getAttribute('data-tag');
      if (formState.tags.includes(tag)) {
        formState.tags = formState.tags.filter((item) => item !== tag);
        button.classList.remove('active');
      } else {
        formState.tags = [...formState.tags, tag];
        button.classList.add('active');
      }
    });
  });

  modal.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      ...account,
      display_name: String(formData.get('display_name') || '').trim(),
      handle: String(formData.get('handle') || '').trim(),
      profile_url: String(formData.get('profile_url') || '').trim(),
      notes: String(formData.get('notes') || '').trim(),
      tags: formState.tags,
      relationship_status: String(formData.get('relationship_status') || 'new')
    };

    const banner = modal.querySelector('.kol-collector-banner');
    const saveButton = modal.querySelector('.kol-collector-save');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
      const result = await saveContact(payload);
      if (result.duplicate) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <span>Already exists. Updated the existing record for ${escapeHtml(result.record.handle)}.</span>
          <button type="button">Open saved state</button>
        `;
        banner.querySelector('button').addEventListener('click', () => {
          payload.id = result.record.id;
          payload.notes = result.record.notes;
          payload.tags = result.record.tags;
          payload.relationship_status = result.record.relationship_status;
        });
      } else {
        banner.style.display = 'flex';
        banner.textContent = `Saved ${result.record.handle}`;
      }
      window.setTimeout(closeModal, 900);
    } catch (error) {
      banner.style.display = 'flex';
      banner.textContent = error.message || 'Desktop app bridge unavailable';
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save';
    }
  });

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  modal.addEventListener('mouseenter', () => clearTimeout(state.hideTimer));
  modal.addEventListener('mouseleave', scheduleHideFab);

  document.body.appendChild(modal);
  state.modal = modal;
  updateModalPosition();
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

document.addEventListener(
  'mouseover',
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.kol-collector-fab') || target.closest('.kol-collector-modal')) return;
    const context = getAccountContext(target);
    if (!context) return;
    showFab(context.account, context.targetEl);
  },
  true
);

function refreshActivePositions() {
  if (!state.activeTargetEl?.isConnected) {
    hideFab();
    closeModal();
    state.activeTargetEl = null;
    return;
  }

  if (state.fab?.style.display !== 'none') {
    updateButtonPosition();
  }
  if (state.modal) {
    updateModalPosition();
  }
}

document.addEventListener('scroll', refreshActivePositions, true);
window.addEventListener('resize', refreshActivePositions);

document.addEventListener('mouseout', (event) => {
  const target = event.target;
  const relatedTarget = event.relatedTarget;
  if (target instanceof Element && state.activeTargetEl?.contains(target) && relatedTarget instanceof Element && state.activeTargetEl.contains(relatedTarget)) {
    return;
  }
  if (relatedTarget instanceof Element) {
    if (relatedTarget.closest('.kol-collector-fab') || relatedTarget.closest('.kol-collector-modal')) return;
    if (state.activeTargetEl?.contains(relatedTarget)) return;
  }
  scheduleHideFab();
});

const observer = new MutationObserver(() => {
  if (state.activeTargetEl?.isConnected) {
    refreshActivePositions();
  }

  const hoverCard = document.querySelector('[data-testid="HoverCard"]');
  if (hoverCard && hoverCard !== state.activeTargetEl) {
    const context = getAccountContext(hoverCard);
    if (context) {
      showFab(context.account, context.targetEl);
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
