// Load saved settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  loadAnalytics();
  setupEventListeners();
  checkUrlForPaymentSuccess();
});

// Check if user returned from successful payment
function checkUrlForPaymentSuccess() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    // User returned from successful Stripe payment
    chrome.storage.local.set({ subscriptionTier: 'premium' });
    updateSubscriptionDisplay('premium');
    showStatus('Payment successful! Welcome to Premium! 🎉', 'success');
  }
}

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
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('toggleApiKey').addEventListener('click', toggleApiKeyVisibility);
  document.getElementById('upgradeToPremium').addEventListener('click', handleUpgrade);
  document.getElementById('apiKey').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveSettings();
  });
}

// Save settings
async function saveSettings() {
  const saveBtn = document.getElementById('saveSettings');
  const btnText = saveBtn.querySelector('.btn-text');
  const btnLoading = saveBtn.querySelector('.btn-loading');
  
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

// Handle upgrade to premium with Stripe Payment Link
async function handleUpgrade() {
  const btn = document.getElementById('upgradeToPremium');
  const originalText = btn.textContent;
  
  // Show modal with payment options
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px; text-align: center;">
      <h2 style="margin: 0 0 16px 0; color: #333;">Upgrade to Premium</h2>
      <div style="margin-bottom: 20px;">
        <div style="font-size: 36px; font-weight: bold; color: #667eea; margin-bottom: 8px;">$4.99<span style="font-size: 16px; color: #999;">/month</span></div>
        <p style="color: #666; margin: 0 0 16px 0;">Unlimited translations & advanced features</p>
      </div>
      
      <div style="text-align: left; margin-bottom: 20px; padding: 16px; background: #f5f7fa; border-radius: 8px;">
        <div style="margin-bottom: 8px; color: #333; font-weight: 600;">✓ Unlimited translations</div>
        <div style="margin-bottom: 8px; color: #333; font-weight: 600;">✓ Up to 1000 words per translation</div>
        <div style="margin-bottom: 8px; color: #333; font-weight: 600;">✓ Detailed explanations</div>
        <div style="margin-bottom: 8px; color: #333; font-weight: 600;">✓ Priority support</div>
        <div style="color: #333; font-weight: 600;">✓ Cancel anytime</div>
      </div>
      
      <button id="proceedToPayment" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin-bottom: 12px;">
        Continue to Stripe Checkout
      </button>
      
      <button id="useDemoMode" style="width: 100%; padding: 12px; background: white; color: #666; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; cursor: pointer; margin-bottom: 12px;">
        Use Demo Mode (For Testing)
      </button>
      
      <button id="cancelPayment" style="width: 100%; padding: 12px; background: transparent; color: #999; border: none; font-size: 14px; cursor: pointer;">
        Cancel
      </button>
      
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
        <img src="https://stripe.com/img/v3/home/twitter.png" alt="Stripe" style="height: 20px; opacity: 0.5;">
        <p style="font-size: 11px; color: #999; margin: 8px 0 0 0;">Secure payment by Stripe</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Handle proceed to Stripe
  document.getElementById('proceedToPayment').onclick = () => {
    // Replace with your actual Stripe Payment Link
    // You'll create this in the Stripe Dashboard (see instructions below)
    const stripePaymentLink = 'https://buy.stripe.com/test_XXXXXXXXXXXXXX';
    
    // For demo purposes, show instructions
    const useRealStripe = confirm(
      '🔗 Stripe Payment Link Setup\n\n' +
      'To use real Stripe payments:\n\n' +
      '1. Go to stripe.com and create a free account\n' +
      '2. Stay in TEST MODE\n' +
      '3. Create a Product ($4.99/month)\n' +
      '4. Create a Payment Link\n' +
      '5. Replace the URL in popup.js\n\n' +
      'Click OK to see setup instructions\n' +
      'Click Cancel to use demo mode'
    );
    
    if (useRealStripe) {
      // Open setup instructions
      chrome.tabs.create({ 
        url: 'https://stripe.com/docs/payment-links' 
      });
      modal.remove();
    } else {
      // Use demo mode
      modal.remove();
      activateDemoMode(btn);
    }
  };
  
  // Handle demo mode
  document.getElementById('useDemoMode').onclick = () => {
    modal.remove();
    activateDemoMode(btn);
  };
  
  // Handle cancel
  document.getElementById('cancelPayment').onclick = () => {
    modal.remove();
  };
  
  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
}

// Activate demo mode (for testing/demonstration)
async function activateDemoMode(btn) {
  const originalText = btn.textContent;
  btn.textContent = 'Processing...';
  btn.disabled = true;
  
  // Simulate payment processing
  setTimeout(async () => {
    await chrome.storage.local.set({ 
      subscriptionTier: 'premium',
      paymentMethod: 'demo'
    });
    updateSubscriptionDisplay('premium');
    btn.textContent = 'Current Plan';
    
    showStatus('✅ Demo Mode: Premium Activated!', 'success');
    
    alert(
      '🎉 Welcome to Premium!\n\n' +
      '✓ Unlimited translations activated\n' +
      '✓ All features unlocked\n\n' +
      'Note: This is demo mode for testing.\n' +
      'In production, you would integrate real Stripe payments.'
    );
  }, 1500);
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
    
    const freeBtn = document.querySelector('[data-tier="free"] .btn');
    const premiumBtn = document.querySelector('[data-tier="premium"] .btn');
    
    if (freeBtn && premiumBtn) {
      freeBtn.textContent = 'Downgrade';
      freeBtn.disabled = false;
      freeBtn.onclick = handleDowngrade;
      
      premiumBtn.textContent = 'Current Plan';
      premiumBtn.disabled = true;
    }
  } else {
    badge.textContent = 'FREE';
    badge.classList.remove('premium');
    limit.textContent = '5 translations/day';
    
    const freeBtn = document.querySelector('[data-tier="free"] .btn');
    const premiumBtn = document.querySelector('[data-tier="premium"] .btn');
    
    if (freeBtn && premiumBtn) {
      freeBtn.textContent = 'Current Plan';
      freeBtn.disabled = true;
      
      premiumBtn.textContent = 'Upgrade Now';
      premiumBtn.disabled = false;
    }
  }
}

// Handle downgrade
async function handleDowngrade() {
  const confirm = window.confirm(
    'Downgrade to Free Plan?\n\n' +
    '• Limited to 5 translations per day\n' +
    '• Basic explanations only\n\n' +
    'You can upgrade again anytime.'
  );
  
  if (confirm) {
    await chrome.storage.local.set({ subscriptionTier: 'free' });
    updateSubscriptionDisplay('free');
    showStatus('Downgraded to Free plan', 'success');
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

// Render analytics chart
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