let filters = { positive: [], negative: [] };
let ready = false;

function getCardTitle(card) {
  // Get all spans inside .card-title, find the one with actual text (not stars)
  const spans = card.querySelectorAll('.card-title span');
  for (let i = spans.length - 1; i >= 0; i--) {
    const el = spans[i];
    // Skip spans that only contain other spans or icons
    if (el.querySelector('i') || el.querySelector('span')) continue;
    const text = el.textContent.trim();
    if (text.length > 0) return text;
  }
  // Fallback: just grab all text from card-title
  const titleEl = card.querySelector('.card-title');
  return titleEl ? titleEl.textContent.trim() : '';
}

function applyFilters() {
  console.log('Applying filters:', filters);
  // Select all job listing cards - they are <li> elements containing .card-title
  const cards = document.querySelectorAll('li');
  console.log('Found cards:', cards.length);
  let shown = 0;
  let hidden = 0;

  cards.forEach((card, index) => {
    if (!card.querySelector('.card-title')) return;

    const title = getCardTitle(card).toLowerCase();
    if (!title) return;

    if (index < 5) console.log('Card title:', title);

    let visible = true;

    // Negative: hide if matches any
    if (filters.negative.length > 0) {
      for (const word of filters.negative) {
        if (word && title.includes(word)) {
          visible = false;
          break;
        }
      }
    }

    // Positive: only show if matches at least one
    if (visible && filters.positive.length > 0) {
      visible = filters.positive.some(word => word && title.includes(word));
    }

    if (!visible) console.log('Hiding card with title:', title, 'because filters:', filters);
    card.style.display = visible ? '' : 'none';
    if (visible) shown++; else hidden++;
  });

  console.log('Filtered: shown', shown, 'hidden', hidden);

  try {
    chrome.runtime.sendMessage({ type: 'STATS', shown, hidden });
  } catch(e) {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Content received message:', msg);
  if (msg.type === 'UPDATE_FILTERS') {
    filters = msg.filters;
    applyFilters();
    sendResponse({ ok: true });
  }
});

// Load saved filters immediately on page load
console.log('Content script loaded');
chrome.storage.local.get(['jobFilters'], (result) => {
  console.log('Content storage get result:', result);
  if (result.jobFilters) {
    filters = result.jobFilters;
  }
  console.log('Content loaded filters:', filters);
  applyFilters();
  ready = true;
});

// Re-apply when page content changes (AJAX / infinite scroll)
let debounce = null;
const observer = new MutationObserver(() => {
  if (!ready) return;
  clearTimeout(debounce);
  debounce = setTimeout(applyFilters, 200);
});
observer.observe(document.body, { childList: true, subtree: true });
