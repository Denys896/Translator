// Content script - maximum compatibility and error handling
(function() {
  'use strict';
  
  // CRITICAL: Check if we're in a valid context
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  
  // Store chrome reference
  var chromeAPI = typeof chrome !== 'undefined' ? chrome : null;
  
  // Validate extension is available
  function isExtensionValid() {
    try {
      return !!(chromeAPI && 
                chromeAPI.runtime && 
                chromeAPI.runtime.id && 
                typeof chromeAPI.runtime.sendMessage === 'function');
    } catch (e) {
      return false;
    }
  }
  
  // Exit early if not valid
  if (!isExtensionValid()) {
    console.error('Text Translator: Extension API not available');
    return;
  }
  
  console.log('Text Translator: Starting...');
  
  // State
  var popup = null;
  var isLoading = false;
  var quickTimeout = null;
  var isDisabled = false;
  
  // Selection handler
  function handleSelection(e) {
    if (isDisabled) return;
    
    try {
      var sel = window.getSelection();
      if (!sel) return;
      
      var text = sel.toString().trim();
      
      if (text.length > 0 && text.length < 500) {
        showButton(e.pageX, e.pageY, text);
      } else if (popup && !popup.contains(e.target)) {
        hideAll();
      }
    } catch (err) {
      console.error('Text Translator: Selection error:', err);
    }
  }
  
  // Click outside handler
  function handleClick(e) {
    if (isDisabled || !popup) return;
    
    try {
      if (!popup.contains(e.target) && !isLoading) {
        hideAll();
      }
    } catch (err) {
      console.error('Text Translator: Click error:', err);
    }
  }
  
  // Show quick button
  function showButton(x, y, text) {
    try {
      hideAll();
      
      var btn = document.createElement('div');
      btn.className = 'translate-explain-quick-action';
      btn.innerHTML = '<button class="translate-explain-btn">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>' +
        '</button>';
      
      btn.style.left = x + 'px';
      btn.style.top = (y - 40) + 'px';
      
      document.body.appendChild(btn);
      
      btn.querySelector('.translate-explain-btn').onclick = function(evt) {
        evt.stopPropagation();
        btn.remove();
        showPopup(x, y, text);
      };
      
      if (quickTimeout) clearTimeout(quickTimeout);
      quickTimeout = setTimeout(function() {
        if (btn.parentNode) btn.remove();
      }, 3000);
    } catch (err) {
      console.error('Text Translator: Button error:', err);
    }
  }
  
  // Show popup
  function showPopup(x, y, text) {
    // Check extension is still valid
    if (!isExtensionValid()) {
      alert('Extension was reloaded. Please refresh this page.');
      isDisabled = true;
      return;
    }
    
    try {
      hideAll();
      
      popup = document.createElement('div');
      popup.className = 'translate-explain-popup';
      popup.innerHTML = 
        '<div class="translate-explain-header">' +
        '<h3>Translate & Explain</h3>' +
        '<button class="translate-explain-close">×</button>' +
        '</div>' +
        '<div class="translate-explain-content">' +
        '<div class="translate-explain-loading">' +
        '<div class="spinner"></div>' +
        '<p>Analyzing text...</p>' +
        '</div></div>';
      
      var w = window.innerWidth;
      var h = window.innerHeight;
      popup.style.left = Math.min(Math.max(10, x), w - 410) + 'px';
      popup.style.top = Math.min(Math.max(10, y + 10), h - 310) + 'px';
      
      document.body.appendChild(popup);
      popup.querySelector('.translate-explain-close').onclick = hideAll;
      
      sendRequest(text);
    } catch (err) {
      console.error('Text Translator: Popup error:', err);
    }
  }
  
  // Send request to background
  function sendRequest(text) {
    // Final validation
    if (!isExtensionValid()) {
      showError('Extension connection lost. Refresh the page.');
      isDisabled = true;
      return;
    }
    
    isLoading = true;
    
    var timeout = setTimeout(function() {
      isLoading = false;
      showError('Request timed out');
    }, 30000);
    
    try {
      chromeAPI.runtime.sendMessage(
        { action: 'translateAndExplain', data: { text: text } },
        function(resp) {
          clearTimeout(timeout);
          isLoading = false;
          
          // Check for context invalidation error
          var lastErr = chromeAPI.runtime.lastError;
          if (lastErr) {
            var msg = lastErr.message || '';
            if (msg.indexOf('context invalidated') !== -1 || 
                msg.indexOf('Extension context') !== -1) {
              showError('Extension was reloaded. Please refresh this page.');
              isDisabled = true;
            } else {
              showError('Error: ' + msg);
            }
            return;
          }
          
          if (!resp) {
            showError('No response received');
            return;
          }
          
          if (resp.error) {
            showError(resp.error);
          } else if (resp.result) {
            showResult(resp);
          } else {
            showError('Invalid response');
          }
        }
      );
    } catch (err) {
      clearTimeout(timeout);
      isLoading = false;
      console.error('Text Translator: Send error:', err);
      showError('Failed to send request');
    }
  }
  
  // Show result
  function showResult(resp) {
    if (!popup) return;
    
    var content = popup.querySelector('.translate-explain-content');
    if (!content) return;
    
    try {
      var html = formatText(resp.result);
      content.innerHTML = 
        '<div class="translate-explain-result">' + html +
        '<div class="translate-explain-meta">' +
        '<span>Response time: ' + resp.latency + 'ms</span>' +
        '<span>Daily usage: ' + resp.dailyUsage + '/' + resp.limit + '</span>' +
        '</div></div>';
    } catch (err) {
      console.error('Text Translator: Result error:', err);
    }
  }
  
  // Show error
  function showError(msg) {
    isLoading = false;
    if (!popup) return;
    
    var content = popup.querySelector('.translate-explain-content');
    if (!content) return;
    
    try {
      var safe = escapeHTML(msg);
      content.innerHTML = 
        '<div class="translate-explain-error">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="12" y1="8" x2="12" y2="12"/>' +
        '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
        '</svg><p>' + safe + '</p></div>';
    } catch (err) {
      console.error('Text Translator: Error display error:', err);
    }
  }
  
  // Escape HTML
  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  // Format text
  function formatText(str) {
    var safe = escapeHTML(str);
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\n\n/g, '</p><p>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
  }
  
  // Hide all UI
  function hideAll() {
    try {
      if (popup && popup.parentNode) {
        popup.remove();
      }
      popup = null;
      
      var btns = document.querySelectorAll('.translate-explain-quick-action');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].parentNode) btns[i].remove();
      }
      
      if (quickTimeout) {
        clearTimeout(quickTimeout);
        quickTimeout = null;
      }
    } catch (err) {
      console.error('Text Translator: Hide error:', err);
    }
  }
  
  // Initialize
  function init() {
    try {
      document.addEventListener('mouseup', handleSelection);
      document.addEventListener('mousedown', handleClick);
      window.addEventListener('beforeunload', hideAll);
      console.log('Text Translator: Ready');
    } catch (err) {
      console.error('Text Translator: Init error:', err);
    }
  }
  
  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 100);
    });
  } else {
    setTimeout(init, 100);
  }
  
})();