let filters = { positive: [], negative: [] };
let prioritizePositive = false;

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderTags(type) {
   console.log('renderTags for', type, 'words:', filters[type]);
   const container = document.getElementById(type + '-tags');
   if (!container) {
     console.log('container not found for', type);
     return;
   }
   const words = filters[type];
   if (words.length === 0) {
     container.innerHTML = '<span class="empty-hint">none</span>';
     return;
   }
   container.innerHTML = words.map((w, i) => `
     <span class="tag ${type}">
       ${escHtml(w)}
       <span class="remove" data-type="${type}" data-index="${i}">×</span>
     </span>
   `).join('');
   container.querySelectorAll('.remove').forEach(btn => {
     btn.addEventListener('click', () => {
       filters[btn.dataset.type].splice(parseInt(btn.dataset.index), 1);
       chrome.storage.local.set({ jobFilters: filters });
       sendToPage();
       renderTags(btn.dataset.type);
     });
   });
 }

function addWord(type) {
   console.log('addWord called for', type);
   const input = document.getElementById(type + '-input');
   if (!input) {
     console.log('input not found for', type);
     return;
   }
   const word = input.value.trim().toLowerCase();
   console.log('word:', word);
   if (!word) return;
   if (!filters[type].includes(word)) {
     filters[type].push(word);
     console.log('added word to filters:', filters);
     chrome.storage.local.set({ jobFilters: filters });
     sendToPage();
   }
   input.value = '';
   renderTags(type);
 }

function sendToPage() {
    console.log('Sending to page, filters:', filters, 'prioritizePositive:', prioritizePositive);
    chrome.storage.local.set({ jobFilters: filters }, () => {
      console.log('Storage set completed');
    });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        console.log('No active tab found');
        return;
      }
      console.log('Sending message to tab:', tabs[0].id);
      chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_FILTERS', filters, prioritizePositive }, () => {
       if (chrome.runtime.lastError) {
         console.log('Message failed, injecting content script:', chrome.runtime.lastError);
         // Content script not ready yet, inject it then retry
         chrome.scripting.executeScript(
           { target: { tabId: tabs[0].id }, files: ['content.js'] },
           () => {
             setTimeout(() => {
               chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_FILTERS', filters, prioritizePositive }, () => {
                 if (chrome.runtime.lastError) {
                   console.log('Retry message failed:', chrome.runtime.lastError);
                 } else {
                   console.log('Retry message sent successfully');
                 }
               });
             }, 400);
           }
         );
       } else {
         console.log('Message sent successfully');
       }
     });
   });
 }

function updateStats(shown, hidden) {
  const s = document.getElementById('stat-shown');
  const h = document.getElementById('stat-hidden');
  if (s) s.textContent = shown + ' shown';
  if (h) h.textContent = hidden + ' hidden';
}

function loadSettings() {
  chrome.storage.local.get(['jobFilters', 'prioritizePositive'], (result) => {
    console.log('Popup storage get result:', result);
    if (result.jobFilters) {
      filters = result.jobFilters;
    }
    if (result.prioritizePositive !== undefined) {
      prioritizePositive = result.prioritizePositive;
    }
    document.getElementById('prioritize-positive').checked = prioritizePositive;
    renderTags('positive');
    renderTags('negative');
  });
}

document.getElementById('prioritize-positive').addEventListener('change', (e) => {
  prioritizePositive = e.target.checked;
  chrome.storage.local.set({ prioritizePositive });
  sendToPage();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATS') updateStats(msg.shown, msg.hidden);
});

loadSettings();

document.addEventListener('DOMContentLoaded', () => {
   console.log('Popup loaded');
   chrome.storage.local.get(['jobFilters'], (result) => {
     console.log('Storage get result:', result);
     if (result.jobFilters) filters = result.jobFilters;
     console.log('Loaded filters:', filters);
     renderTags('negative');
     renderTags('positive');
     sendToPage();
   });

  document.getElementById('negative-add').addEventListener('click', () => addWord('negative'));
  document.getElementById('positive-add').addEventListener('click', () => addWord('positive'));

  document.getElementById('negative-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWord('negative');
  });
  document.getElementById('positive-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWord('positive');
  });

  document.getElementById('clear-all').addEventListener('click', () => {
    filters = { positive: [], negative: [] };
    renderTags('negative');
    renderTags('positive');
    sendToPage();
  });
});
