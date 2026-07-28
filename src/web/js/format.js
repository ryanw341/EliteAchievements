// Display formatting helpers.

export function credits(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

// Abbreviated credits for tight spaces: 1.23 B, 45.6 M, etc.
export function creditsShort(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const units = [
    [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'],
  ];
  for (const [div, suffix] of units) {
    if (abs >= div) return `${(n / div).toFixed(2)} ${suffix}`;
  }
  return `${Math.round(n)}`;
}

// Resolve a rank track's tier name from the numeric journal value.
export function rankTier(tracks, journalKey, value) {
  if (value == null) return '—';
  const track = tracks?.find((t) => t.journalKey === journalKey);
  if (!track) return String(value);
  if (value < track.tiers.length) return track.tiers[value];
  return `Elite +${value - 8}`;
}

export function pct(n) {
  if (n == null) return '';
  return `${Math.round(n)}%`;
}

export function shipName(s) {
  if (!s) return '—';
  return s.typeLocalised || s.type || '—';
}

// Small helper to create DOM elements.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v != null) node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
