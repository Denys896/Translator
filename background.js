// Service Worker initialization
console.log('Text Translator: Background service worker started');

const DASHBOARD_URL = 'https://translator-dashboard-three.vercel.app';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Text Translator Background: Received message', request.action);
  
  if (request.action === 'translateAndExplain') {
    handleTranslateAndExplain(request.data, sendResponse);
    return true; // Keep channel open for async response
  } else if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
    return false;
  } else if (request.action === 'logMetric') {
    logMetricToDashboard(request.data);
    sendResponse({ success: true });
    return false;
  }
  
  return false;
});

async function handleTranslateAndExplain(data, sendResponse) {
  console.log('Text Translator Background: Starting translation');
  const startTime = Date.now();
  
  try {
    // Get API key and settings from storage
    const result = await chrome.storage.local.get([
      'openaiApiKey', 
      'targetLanguage', 
      'subscriptionTier', 
      'extensionUserId'
    ]);
    
    const apiKey = result.openaiApiKey;
    const targetLanguage = result.targetLanguage || 'English';
    const tier = result.subscriptionTier || 'free';
    const userId = result.extensionUserId || 'anonymous';
    
    console.log('Text Translator Background: Settings loaded', {
      hasApiKey: !!apiKey,
      targetLanguage,
      tier,
      userId
    });
    
    if (!apiKey) {
      console.error('Text Translator Background: No API key found');
      sendResponse({ 
        error: 'Please set your OpenAI API key in the extension popup first.' 
      });
      logMetricToDashboard({ type: 'error', userId, latency: Date.now() - startTime });
      return;
    }

    // Check usage limits
    const dailyUsage = await getDailyUsage();
    const limits = { free: 5, premium: 100 };
    
    console.log('Text Translator Background: Daily usage check', {
      usage: dailyUsage,
      limit: limits[tier],
      tier
    });
    
    if (tier === 'free' && dailyUsage >= limits.free) {
      console.warn('Text Translator Background: Daily limit reached');
      sendResponse({ 
        error: `Daily limit reached (${limits.free} translations). Upgrade to Premium for unlimited access.` 
      });
      logMetricToDashboard({ type: 'error', userId, latency: Date.now() - startTime });
      return;
    }

    console.log('Text Translator Background: Calling OpenAI API');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a helpful translation and explanation assistant. When given text, you should:
1. Translate it to ${targetLanguage} if it's not already in ${targetLanguage}
2. Provide a clear explanation of what the text means, including context and nuance
3. If there are idioms or cultural references, explain them
4. Keep your response concise and well-formatted.

Format your response as:
**Translation:**
[translated text]

**Explanation:**
[explanation of meaning and context]`
          },
          {
            role: 'user',
            content: `Please translate and explain this text: "${data.text}"`
          }
        ],
        max_tokens: tier === 'premium' ? 3000 : 2000,
        temperature: 0.7
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    console.log('Text Translator Background: API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Text Translator Background: API error:', errorData);
      
      let errorMessage = 'API request failed';
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (response.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI API key in settings.';
      } else if (response.status === 429) {
        errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
      } else if (response.status === 500) {
        errorMessage = 'OpenAI API server error. Please try again later.';
      }
      
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    console.log('Text Translator Background: Translation successful');
    
    const translationResult = responseData.choices[0].message.content;
    const latency = Date.now() - startTime;
    
    // Increment daily usage
    await incrementDailyUsage();
    
    // Log success metric to dashboard
    await logMetricToDashboard({ type: 'success', userId, latency });
    
    sendResponse({ 
      success: true, 
      result: translationResult,
      latency,
      dailyUsage: dailyUsage + 1,
      limit: tier === 'free' ? limits.free : limits.premium
    });
    
  } catch (error) {
    console.error('Text Translator Background: Error during translation:', error);
    const latency = Date.now() - startTime;
    const result = await chrome.storage.local.get(['extensionUserId']);
    const userId = result.extensionUserId || 'anonymous';
    
    // Log error metric to dashboard
    await logMetricToDashboard({ type: 'error', userId, latency });
    
    let errorMessage = error.message || 'Unknown error occurred';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timed out. Please check your internet connection.';
    }
    
    sendResponse({ error: errorMessage });
  }
}

// Log metrics to dashboard with retry
async function logMetricToDashboard(data) {
  try {
    console.log('📊 Logging metric to dashboard:', data);
    
    const response = await fetch(`${DASHBOARD_URL}/api/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        timestamp: Date.now()
      })
    });

    if (response.ok) {
      console.log('✅ Metric logged successfully');
    } else {
      console.error('❌ Failed to log metric:', response.status);
    }
  } catch (error) {
    console.error('❌ Failed to log metric:', error);
  }
}

// Daily usage tracking
async function getDailyUsage() {
  const today = new Date().toDateString();
  const result = await chrome.storage.local.get(['dailyUsage', 'usageDate']);
  
  if (result.usageDate !== today) {
    return 0;
  }
  
  return result.dailyUsage || 0;
}

async function incrementDailyUsage() {
  const today = new Date().toDateString();
  const result = await chrome.storage.local.get(['dailyUsage', 'usageDate']);
  
  if (result.usageDate !== today) {
    await chrome.storage.local.set({ dailyUsage: 1, usageDate: today });
  } else {
    await chrome.storage.local.set({ dailyUsage: (result.dailyUsage || 0) + 1 });
  }
}

// Handle service worker lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Text Translator: Extension installed/updated', details.reason);
  if (details.reason === 'install') {
    const userId = 'ext_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    chrome.storage.local.set({
      targetLanguage: 'English',
      subscriptionTier: 'free',
      extensionUserId: userId
    });
    console.log('✅ Generated new user ID:', userId);
  }
});

// Keep service worker alive
let keepAliveInterval;
function startKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  keepAliveInterval = setInterval(() => {
    console.log('Text Translator: Service worker keepalive ping');
  }, 20000);
}

startKeepAlive();

console.log('Text Translator: Background service worker ready');