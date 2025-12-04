// Load saved settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  loadAnalytics();
  setupEventListeners();
});

// Load settings from storage
async function loadSettings() {
  const result = await chrome.storage.local.get([
    'openaiApiKey',
    'targetLanguage',
    'subscriptionTier'
  ]);
  
  if (result.openaiApiKey) {
    document.getElementById('apiKey').value = result.openaiApiKey;
  }
  
  if (result.targetLanguage) {
    document.getElementById('targetLanguage').value = result.targetLanguage;
  }
  
  updateSubscriptionDisplay(result.subscriptionTier || 'free');
}

// Setup event listeners
function setupEventListeners() {
  // Save settings button
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  
  // Toggle API key visibility
  document.getElementById('toggleApiKey').addEventListener('click', toggleApiKeyVisibility);
  
  // Upgrade to premium button
  document.getElementById('upgradeToPremium').addEventListener('click', handleUpgrade);
  
  // Enter key to save
  document.getElementById('apiKey').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveSettings();
  });
}

// Save settings
async function saveSettings() {
  const saveBtn = document.getElementById('saveSettings');
  const btnText = saveBtn.querySelector('.btn-text');
  const btnLoading = saveBtn.querySelector('.btn-loading');
  const statusMsg = document.getElementById('saveStatus');
  
  const apiKey = document.getElementById('apiKey').value.trim();
  const targetLanguage = document.getElementById('targetLanguage').value;
  
  if (!apiKey) {
    showStatus('Please enter your OpenAI API key', 'error');
    return;
  }
  
  if (!apiKey.startsWith('sk-')) {
    showStatus('Invalid API key format. It should start with "sk-"', 'error');
    return;
  }
  
  // Show loading state
  btnText.style.display = 'none';
  btnLoading.style.display = 'flex';
  saveBtn.disabled = true;
  
  try {
    await chrome.storage.local.set({
      openaiApiKey: apiKey,
      targetLanguage: targetLanguage
    });
    
    showStatus('Settings saved successfully! ✓', 'success');
  } catch (error) {
    showStatus('Failed to save settings: ' + error.message, 'error');
  } finally {
    btnText.style.display = 'block';
    btnLoading.style.display = 'none';
    saveBtn.disabled = false;
  }
}

// Toggle API key visibility
function toggleApiKeyVisibility() {
  const input = document.getElementById('apiKey');
  const btn = document.getElementById('toggleApiKey');
  
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

// Show status message
function showStatus(message, type) {
  const statusMsg = document.getElementById('saveStatus');
  statusMsg.textContent = message;
  statusMsg.className = `status-message ${type}`;
  
  if (type === 'success') {
    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3000);
  }
}

// Handle upgrade to premium
async function handleUpgrade() {
  // In a real implementation, this would integrate with Stripe
  // For this demo, we'll simulate a payment flow
  
  const confirmUpgrade = confirm(
    'Upgrade to Premium for $4.99/month?\n\n' +
    '✓ Unlimited translations\n' +
    '✓ Detailed explanations\n' +
    '✓ Priority support\n\n' +
    'Click OK to proceed to payment (Demo mode - will not charge)'
  );
  
  if (confirmUpgrade) {
    // Simulate payment processing
    const btn = document.getElementById('upgradeToPremium');
    const originalText = btn.textContent;
    btn.textContent = 'Processing...';
    btn.disabled = true;
    
    setTimeout(async () => {
      await chrome.storage.local.set({ subscriptionTier: 'premium' });
      updateSubscriptionDisplay('premium');
      btn.textContent = 'Current Plan';
      
      alert('Welcome to Premium! 🎉\n\nYou now have unlimited translations.');
    }, 1500);
  }
}

// Update subscription display
function updateSubscriptionDisplay(tier) {
  const currentTierEl = document.getElementById('currentTier');
  const badge = currentTierEl.querySelector('.tier-badge');
  const limit = currentTierEl.querySelector('.tier-limit');
  
  if (tier === 'premium') {
    badge.textContent = 'PREMIUM';
    badge.classList.add('premium');
    limit.textContent = 'Unlimited translations';
    
    // Update buttons
    const freeBtn = document.querySelector('[data-tier="free"] .btn');
    const premiumBtn = document.querySelector('[data-tier="premium"] .btn');
    
    freeBtn.textContent = 'Downgrade';
    freeBtn.disabled = false;
    freeBtn.classList.remove('btn-outline');
    freeBtn.classList.add('btn-outline');
    
    premiumBtn.textContent = 'Current Plan';
    premiumBtn.disabled = true;
  } else {
    badge.textContent = 'FREE';
    badge.classList.remove('premium');
    limit.textContent = '5 translations/day';
  }
}

// Load analytics
async function loadAnalytics() {
  chrome.runtime.sendMessage({ action: 'getAnalytics' }, (response) => {
    if (response && response.analytics) {
      const analytics = response.analytics;
      
      document.getElementById('totalUsage').textContent = analytics.usageCount;
      
      const avgLatency = analytics.requestCount > 0 
        ? Math.round(analytics.totalLatency / analytics.requestCount)
        : 0;
      document.getElementById('avgLatency').textContent = avgLatency + 'ms';
      
      const successRate = analytics.requestCount > 0
        ? Math.round((analytics.successes / analytics.requestCount) * 100)
        : 100;
      document.getElementById('successRate').textContent = successRate + '%';
      
      document.getElementById('errorCount').textContent = analytics.errors;
      
      renderChart(analytics);
    }
  });
}

// Render analytics chart (simple bar representation)
function renderChart(analytics) {
  const chartContainer = document.querySelector('.chart-container');
  
  const chartHTML = `
    <div style="margin-bottom: 12px; font-weight: 600; font-size: 14px; color: #333;">
      Usage Overview
    </div>
    <div style="display: flex; align-items: flex-end; gap: 8px; height: 120px;">
      <div style="flex: 1; background: linear-gradient(to top, #667eea, #764ba2); 
        height: ${Math.min((analytics.successes / Math.max(analytics.requestCount, 1)) * 100, 100)}%; 
        border-radius: 8px 8px 0 0; position: relative;">
        <div style="position: absolute; bottom: -20px; width: 100%; text-align: center; font-size: 11px; color: #666;">
          Success<br>${analytics.successes}
        </div>
      </div>
      <div style="flex: 1; background: linear-gradient(to top, #e74c3c, #c0392b); 
        height: ${Math.min((analytics.errors / Math.max(analytics.requestCount, 1)) * 100, 100)}%; 
        border-radius: 8px 8px 0 0; position: relative;">
        <div style="position: absolute; bottom: -20px; width: 100%; text-align: center; font-size: 11px; color: #666;">
          Errors<br>${analytics.errors}
        </div>
      </div>
    </div>
  `;
  
  chartContainer.innerHTML = chartHTML;
}