// Immediately check if Chrome API is available
(function() {
  'use strict';
  
  // Safety check
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.error('Text Translator: Chrome extension API not available');
    return;
  }
  
  console.log('Text Translator: Content script loaded successfully');
  
  // Global state
  let popup = null;
  let isLoading = false;
  
  // Listen for text selection
  document.addEventListener('mouseup', handleTextSelection);
  
  // Listen for clicks outside popup
  document.addEventListener('mousedown', handleOutsideClick);
  
  function handleTextSelection(e) {
    const selectedText = window.getSelection().toString().trim();
    
    if (selectedText.length > 0 && selectedText.length < 500) {
      showQuickAction(e.pageX, e.pageY, selectedText);
    } else if (popup && !popup.contains(e.target)) {
      hidePopup();
    }
  }
  
  function handleOutsideClick(e) {
    if (popup && !popup.contains(e.target) && !isLoading) {
      hidePopup();
    }
  }
  
  function showQuickAction(x, y, text) {
    hidePopup();
    
    const quickAction = document.createElement('div');
    quickAction.className = 'translate-explain-quick-action';
    quickAction.innerHTML = `
      <button class="translate-explain-btn" title="Translate & Explain">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
        </svg>
      </button>
    `;
    
    quickAction.style.left = `${x}px`;
    quickAction.style.top = `${y - 40}px`;
    
    document.body.appendChild(quickAction);
    
    const btn = quickAction.querySelector('.translate-explain-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      quickAction.remove();
      showPopup(x, y, text);
    });
    
    setTimeout(() => {
      if (quickAction.parentNode) {
        quickAction.remove();
      }
    }, 3000);
  }
  
  function showPopup(x, y, text) {
    hidePopup();
    
    popup = document.createElement('div');
    popup.className = 'translate-explain-popup';
    popup.innerHTML = `
      <div class="translate-explain-header">
        <h3>Translate & Explain</h3>
        <button class="translate-explain-close">×</button>
      </div>
      <div class="translate-explain-content">
        <div class="translate-explain-loading">
          <div class="spinner"></div>
          <p>Analyzing text...</p>
        </div>
      </div>
    `;
    
    // Position popup
    popup.style.left = `${Math.min(x, window.innerWidth - 420)}px`;
    popup.style.top = `${Math.min(y + 10, window.innerHeight - 300)}px`;
    
    document.body.appendChild(popup);
    
    // Close button
    popup.querySelector('.translate-explain-close').addEventListener('click', hidePopup);
    
    // Send request to background script
    sendTranslationRequest(text);
  }
  
  function sendTranslationRequest(text) {
    isLoading = true;
    console.log('Text Translator: Sending translation request for:', text);
    
    // Double-check chrome API is still available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.error('Text Translator: Chrome API unavailable when trying to send message');
      showError('Extension communication error. Please reload the page and try again.');
      return;
    }
    
    try {
      chrome.runtime.sendMessage(
        { action: 'translateAndExplain', data: { text: text } },
        function(response) {
          console.log('Text Translator: Received response:', response);
          
          // Check for chrome.runtime.lastError
          if (chrome.runtime.lastError) {
            console.error('Text Translator: Chrome runtime error:', chrome.runtime.lastError);
            showError('Extension error: ' + chrome.runtime.lastError.message + '\n\nTry reloading the extension.');
            return;
          }
          
          handleResponse(response);
        }
      );
    } catch (error) {
      console.error('Text Translator: Error sending message:', error);
      showError('Failed to send message: ' + error.message + '\n\nTry refreshing the page.');
    }
  }
  
  function handleResponse(response) {
    isLoading = false;
    
    if (!popup) {
      console.error('Text Translator: Popup element not found');
      return;
    }
    
    const content = popup.querySelector('.translate-explain-content');
    
    if (!response) {
      console.error('Text Translator: No response received from background script');
      content.innerHTML = `
        <div class="translate-explain-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>No response received. Please check if the extension is configured correctly.</p>
        </div>
      `;
      return;
    }
    
    if (response.error) {
      console.error('Text Translator: API Error:', response.error);
      content.innerHTML = `
        <div class="translate-explain-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>${response.error}</p>
        </div>
      `;
    } else {
      console.log('Text Translator: Translation successful');
      content.innerHTML = `
        <div class="translate-explain-result">
          ${formatResult(response.result)}
          <div class="translate-explain-meta">
            <span>Response time: ${response.latency}ms</span>
            <span>Daily usage: ${response.dailyUsage}/${response.limit}</span>
          </div>
        </div>
      `;
    }
  }
  
  function showError(message) {
    isLoading = false;
    
    if (popup) {
      const content = popup.querySelector('.translate-explain-content');
      content.innerHTML = `
        <div class="translate-explain-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>${message}</p>
        </div>
      `;
    }
  }
  
  function formatResult(text) {
    // Convert markdown-style formatting to HTML
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }
  
  function hidePopup() {
    if (popup) {
      popup.remove();
      popup = null;
    }
    
    // Remove any quick action buttons
    const quickActions = document.querySelectorAll('.translate-explain-quick-action');
    quickActions.forEach(qa => qa.remove());
  }
  
})();