// Load saved settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  setupEventListeners();
  checkPremiumStatus();
});

// API Configuration
const API_URL = 'https://translator-dashboard-three.vercel.app'; // Replace with your actual Vercel URL

// Periodically check for premium status updates
function checkPremiumStatus() {
  syncPremiumStatus();
  setInterval(syncPremiumStatus, 10000); // Check every 10 seconds
}

// Sync premium status from server
async function syncPremiumStatus() {
  try {
    const result = await chrome.storage.local.get(['extensionUserId', 'subscriptionTier']);
    const userId = result.extensionUserId;
    
    if (!userId) return;

    // Check premium status from API
    const response = await fetch(`${API_URL}/api/premium-status?userId=${userId}`);
    
    if (response.ok) {
      const data = await response.json();
      
      // Update local storage if status changed
      if (data.tier !== result.subscriptionTier) {
        await chrome.storage.local.set({ subscriptionTier: data.tier });
        updateSubscriptionDisplay(data.tier);
        
        if (data.tier === 'premium') {
          showStatus('✅ Premium activated!', 'success');
        }
      }
    }
  } catch (error) {
    console.error('Failed to sync premium status:', error);
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

// Handle upgrade to premium with Stripe
async function handleUpgrade() {
  const result = await chrome.storage.local.get(['extensionUserId']);
  let userId = result.extensionUserId;
  
  if (!userId) {
    userId = 'ext_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    await chrome.storage.local.set({ extensionUserId: userId });
  }
  
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
        Continue to Secure Checkout
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
      
      <div style="margin-top: 12px; font-size: 11px; color: #999;">
        Your User ID: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">${userId}</code>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('proceedToPayment').onclick = async () => {
    const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/test_3cI28k6kV6sbbXw4SL1B600';
    const paymentUrl = `${STRIPE_PAYMENT_LINK}?client_reference_id=${userId}`;
    
    // Mark that payment was initiated
    await chrome.storage.local.set({ 
      pendingPayment: true,
      paymentInitiatedAt: Date.now()
    });
    
    // Open Stripe checkout
    chrome.tabs.create({ url: paymentUrl });
    modal.remove();
    
    showStatus('Opening secure checkout... Check your new tab!', 'success');
    startPaymentPolling();
  };
  
  document.getElementById('useDemoMode').onclick = () => {
    modal.remove();
    activateDemoMode();
  };
  
  document.getElementById('cancelPayment').onclick = () => {
    modal.remove();
  };
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
}

// Poll for payment confirmation
function startPaymentPolling() {
  let pollCount = 0;
  const maxPolls = 120; // Poll for 10 minutes (120 * 5 seconds)
  
  const pollInterval = setInterval(async () => {
    pollCount++;
    
    try {
      const result = await chrome.storage.local.get(['extensionUserId']);
      const userId = result.extensionUserId;
      
      if (!userId) {
        clearInterval(pollInterval);
        return;
      }
      
      // Check premium status from API
      const response = await fetch(`${API_URL}/api/premium-status?userId=${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.isPremium) {
          clearInterval(pollInterval);
          await chrome.storage.local.set({ 
            subscriptionTier: 'premium',
            pendingPayment: false
          });
          updateSubscriptionDisplay('premium');
          showStatus('✅ Payment confirmed! Premium activated!', 'success');
          
          // Show success notification
          alert('🎉 Welcome to Premium!\n\nYour payment was successful and premium features are now active!');
          return;
        }
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
    
    if (pollCount >= maxPolls) {
      clearInterval(pollInterval);
      await chrome.storage.local.set({ pendingPayment: false });
      showStatus('Payment check timed out. Please refresh if you completed payment.', 'error');
    }
  }, 5000); // Check every 5 seconds
}

// Activate demo mode
async function activateDemoMode() {
  try {
    const result = await chrome.storage.local.get(['extensionUserId']);
    const userId = result.extensionUserId;
    
    // Activate premium on server
    await fetch(`${API_URL}/api/premium-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        tier: 'premium',
        demo: true
      })
    });
    
    // Update local storage
    await chrome.storage.local.set({ 
      subscriptionTier: 'premium',
      paymentMethod: 'demo',
      premiumActivatedAt: Date.now()
    });
    
    updateSubscriptionDisplay('premium');
    showStatus('✅ Demo Mode: Premium Activated!', 'success');
    
    alert(
      '🎉 Welcome to Premium Demo!\n\n' +
      '✓ Unlimited translations activated\n' +
      '✓ All features unlocked\n\n' +
      'Note: This is demo mode for testing.'
    );
  } catch (error) {
    console.error('Failed to activate demo mode:', error);
    showStatus('Failed to activate demo mode', 'error');
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
    
    const freeBtn = document.querySelector('[data-tier="free"] .btn');
    const premiumBtn = document.querySelector('[data-tier="premium"] .btn');
    
    if (freeBtn && premiumBtn) {
      freeBtn.textContent = 'Downgrade';
      freeBtn.disabled = false;
      freeBtn.onclick = handleDowngrade;
      
      premiumBtn.textContent = '✓ Current Plan';
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
    try {
      const result = await chrome.storage.local.get(['extensionUserId']);
      const userId = result.extensionUserId;
      
      // Update on server
      await fetch(`${API_URL}/api/premium-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          tier: 'free'
        })
      });
      
      // Update local storage
      await chrome.storage.local.set({ subscriptionTier: 'free' });
      updateSubscriptionDisplay('free');
      showStatus('Downgraded to Free plan', 'success');
    } catch (error) {
      console.error('Failed to downgrade:', error);
      showStatus('Failed to downgrade', 'error');
    }
  }
}