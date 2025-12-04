// Wait for DOM and Chrome API to be fully ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}

function initExtension() {
  // Strict Chrome API validation with multiple checks
  const validateChromeAPI = () => {
    try {
      if (typeof chrome === 'undefined') {
        console.error('Text Translator: chrome object is undefined');
        return false;
      }
      
      if (!chrome.runtime) {
        console.error('Text Translator: chrome.runtime is undefined');
        return false;
      }
      
      if (!chrome.runtime.id) {
        console.error('Text Translator: chrome.runtime.id is undefined (context invalidated)');
        return false;
      }
      
      if (typeof chrome.runtime.sendMessage !== 'function') {
        console.error('Text Translator: chrome.runtime.sendMessage is not a function');
        return false;
      }
      
      return true;
    } catch (e) {
      console.error('Text Translator: Chrome API validation error:', e);
      return false;
    }
  };
  
  // Initial validation
  if (!validateChromeAPI()) {
    console.error('Text Translator: Extension cannot run on this page - Chrome API not available');
    return;
  }
  
  console.log('Text Translator: Content script initialized successfully');
  
  // Global state
  let popup = null;
  let isLoading = false;
  let quickActionTimeout = null;
  let isExtensionValid = true;
  
  // Monitor extension validity
  const checkExtensionValidity = () => {
    if (!validateChromeAPI()) {
      isExtensionValid = false;
      console.error('Text Translator: Extension context has been invalidated');
      cleanupExtension();
      return false;
    }
    return true;
  };
  
  // Listen for text selection
  document.addEventListener('mouseup', handleTextSelection);
  
  // Listen for clicks outside popup
  document.addEventListener('mousedown', handleOutsideClick);
  
  function handleTextSelection(e) {
    if (!isExtensionValid || !checkExtensionValidity()) return;
    
    try {
      const selectedText = window.getSelection().toString().trim();
      
      if (selectedText.length > 0 && selectedText.length < 500) {
        showQuickAction(e.pageX, e.pageY, selectedText);
      } else if (popup && !popup.contains(e.target)) {
        hidePopup();
      }
    } catch (error) {
      console.error('Text Translator: Error in handleTextSelection:', error);
    }
  }
  
  function handleOutsideClick(e) {
    if (!isExtensionValid) return;
    
    try {
      if (popup && !popup.contains(e.target) && !isLoading) {
        hidePopup();
      }
    } catch (error) {
      console.error('Text Translator: Error in handleOutsideClick:', error);
    }
  }
  
  function showQuickAction(x, y, text) {
    if (!isExtensionValid) return;
    
    try {
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
      
      if (quickActionTimeout) {
        clearTimeout(quickActionTimeout);
      }
      
      quickActionTimeout = setTimeout(() => {
        if (quickAction && quickAction.parentNode) {
          quickAction.remove();
        }
      }, 3000);
    } catch (error) {
      console.error('Text Translator: Error in showQuickAction:', error);
    }
  }
  
  function showPopup(x, y, text) {
    if (!isExtensionValid || !checkExtensionValidity()) {
      alert('Text Translator: Extension needs to be reloaded. Please refresh this page.');
      return;
    }
    
    try {
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
      
      const popupWidth = 400;
      const popupHeight = 300;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const left = Math.min(Math.max(10, x), viewportWidth - popupWidth - 10);
      const top = Math.min(Math.max(10, y + 10), viewportHeight - popupHeight - 10);
      
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
      
      document.body.appendChild(popup);
      
      popup.querySelector('.translate-explain-close').addEventListener('click', hidePopup);
      
      sendTranslationRequest(text);
    } catch (error) {
      console.error('Text Translator: Error in showPopup:', error);
      showError('Failed to create popup: ' + error.message);
    }
  }
  
  function sendTranslationRequest(text) {
    if (!checkExtensionValidity()) {
      showError('Extension context invalidated. Please refresh the page.');
      return;
    }
    
    isLoading = true;
    console.log('Text Translator: Sending translation request');
    
    // Wrap in try-catch and use async approach
    try {
      const messagePromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timed out after 30 seconds'));
        }, 30000);
        
        try {
          chrome.runtime.sendMessage(
            { action: 'translateAndExplain', data: { text: text } },
            (response) => {
              clearTimeout(timeoutId);
              
              // Check for errors
              const lastError = chrome.runtime.lastError;
              if (lastError) {
                reject(new Error(lastError.message || 'Unknown runtime error'));
                return;
              }
              
              if (!response) {
                reject(new Error('No response received'));
                return;
              }
              
              resolve(response);
            }
          );
        } catch (err) {
          clearTimeout(timeoutId);
          reject(err);
        }
      });
      
      messagePromise
        .then(handleResponse)
        .catch((error) => {
          console.error('Text Translator: Request failed:', error);
          
          let errorMessage = error.message || 'Unknown error occurred';
          
          if (errorMessage.includes('Extension context invalidated')) {
            errorMessage = 'Extension was updated. Please refresh this page.';
            isExtensionValid = false;
          } else if (errorMessage.includes('Could not establish connection')) {
            errorMessage = 'Cannot connect to extension. Please check if it\'s enabled.';
          } else if (errorMessage.includes('Receiving end does not exist')) {
            errorMessage = 'Extension background script not responding. Try reloading the extension.';
          }
          
          showError(errorMessage);
        });
    } catch (error) {
      console.error('Text Translator: Critical error:', error);
      showError('Critical error: ' + error.message);
    }
  }
  
  function handleResponse(response) {
    isLoading = false;
    
    if (!popup) {
      console.error('Text Translator: Popup was closed before response');
      return;
    }
    
    const content = popup.querySelector('.translate-explain-content');
    if (!content) {
      console.error('Text Translator: Content element not found');
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
          <p>${escapeHtml(response.error)}</p>
        </div>
      `;
    } else if (response.result) {
      console.log('Text Translator: Success');
      content.innerHTML = `
        <div class="translate-explain-result">
          ${formatResult(response.result)}
          <div class="translate-explain-meta">
            <span>Response time: ${response.latency}ms</span>
            <span>Daily usage: ${response.dailyUsage}/${response.limit}</span>
          </div>
        </div>
      `;
    } else {
      showError('Invalid response format');
    }
  }
  
  function showError(message) {
    isLoading = false;
    
    if (popup) {
      const content = popup.querySelector('.translate-explain-content');
      if (content) {
        content.innerHTML = `
          <div class="translate-explain-error">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>${escapeHtml(message)}</p>
          </div>
        `;
      }
    }
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function formatResult(text) {
    const escaped = escapeHtml(text);
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }
  
  function hidePopup() {
    try {
      if (popup) {
        popup.remove();
        popup = null;
      }
      
      const quickActions = document.querySelectorAll('.translate-explain-quick-action');
      quickActions.forEach(qa => qa.remove());
      
      if (quickActionTimeout) {
        clearTimeout(quickActionTimeout);
        quickActionTimeout = null;
      }
    } catch (error) {
      console.error('Text Translator: Error in hidePopup:', error);
    }
  }
  
  function cleanupExtension() {
    console.log('Text Translator: Cleaning up extension');
    hidePopup();
    document.removeEventListener('mouseup', handleTextSelection);
    document.removeEventListener('mousedown', handleOutsideClick);
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanupExtension);
}