import type { StorageSchema } from '@shared/types';

// ─── i18n ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('[data-i18n]').forEach((el) => {
  const key = el.getAttribute('data-i18n');
  if (!key) return;
  const msg = chrome.i18n.getMessage(key);
  if (msg) el.textContent = msg;
});

// ─── Speed slider ─────────────────────────────────────────────────────────────

const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;

chrome.storage.local.get(['speedMultiplier'] as Array<keyof StorageSchema>, (items) => {
  const storage = items as Partial<StorageSchema>;
  if (storage.speedMultiplier != null) speedSlider.value = String(storage.speedMultiplier);
});

speedSlider.addEventListener('input', () => {
  const value = parseFloat(speedSlider.value);
  chrome.storage.local
    .set({ speedMultiplier: value } satisfies Partial<StorageSchema>)
    .catch((err: unknown) => console.error('[cattab]', err));
});

// ─── Sound toggle ─────────────────────────────────────────────────────────────

const soundToggle = document.getElementById('sound-toggle') as HTMLInputElement;

chrome.storage.local.get(['soundEnabled'] as Array<keyof StorageSchema>, (items) => {
  const storage = items as Partial<StorageSchema>;
  soundToggle.checked = storage.soundEnabled ?? false;
});

soundToggle.addEventListener('change', () => {
  chrome.storage.local
    .set({ soundEnabled: soundToggle.checked } satisfies Partial<StorageSchema>)
    .catch((err: unknown) => console.error('[cattab]', err));
});

// ─── Blocklist ────────────────────────────────────────────────────────────────

const listEl = document.getElementById('blocklist') as HTMLUListElement;
const siteInput = document.getElementById('site-input') as HTMLInputElement;
const addBtn = document.getElementById('add-btn') as HTMLButtonElement;

function renderBlocklist(blocklist: string[]): void {
  listEl.innerHTML = '';
  for (const hostname of blocklist) {
    const li = document.createElement('li');
    li.className = 'site-item';
    const hostLabel = document.createElement('span');
    hostLabel.textContent = hostname;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'site-item__remove';
    removeBtn.dataset['host'] = hostname;
    removeBtn.setAttribute('data-i18n-label', 'optionsRemove');
    removeBtn.textContent = chrome.i18n.getMessage('optionsRemove');

    li.append(hostLabel, removeBtn);
    listEl.appendChild(li);
  }
}

function getBlocklist(cb: (list: string[]) => void): void {
  chrome.storage.local.get(['blocklist'] as Array<keyof StorageSchema>, (items) => {
    cb((items as Partial<StorageSchema>).blocklist ?? []);
  });
}

function saveBlocklist(list: string[]): void {
  chrome.storage.local
    .set({ blocklist: list } satisfies Partial<StorageSchema>)
    .catch((err: unknown) => console.error('[cattab]', err));
}

getBlocklist(renderBlocklist);

addBtn.addEventListener('click', () => {
  const raw = siteInput.value.trim().toLowerCase();
  if (!raw) return;
  // Strip protocol/path if user pastes a full URL
  const hostname = raw.replace(/^https?:\/\//, '').split('/')[0] ?? raw;

  getBlocklist((list) => {
    if (list.includes(hostname)) return;
    const next = [...list, hostname];
    saveBlocklist(next);
    renderBlocklist(next);
  });

  siteInput.value = '';
});

listEl.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.site-item__remove');
  if (!btn) return;
  const host = btn.dataset['host'];
  if (!host) return;

  getBlocklist((list) => {
    const next = list.filter((h) => h !== host);
    saveBlocklist(next);
    renderBlocklist(next);
  });
});
