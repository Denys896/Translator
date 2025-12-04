// Analytics tracking
const analytics = {
  usageCount: 0,
  totalLatency: 0,
  requestCount: 0,
  errors: 0,
  successes: 0
};

// Load analytics from storage
chrome.storage.local.get(['analytics'], (result) => {
  if (result.analytics) {
    Object.assign(analytics, result.analytics);
  }
});

// Save analytics periodically
function saveAnalytics() {
  chrome.storage.local.set({ analytics });
}

// Track usage
function trackUsage(type, latency, success) {
  analytics.usageCount++;
  analytics.requestCount++;
  if (latency) {
    analytics.totalLatency += latency;
  }
  if (success) {
    analytics.successes++;
  } else {
    analytics.errors++;
  }
  saveAnalytics();
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background: Received message', request);
  
  if (request.action === 'translateAndExplain') {
    handleTranslateAndExplain(request.data, sendResponse);
    return true; // Keep channel open for async response
  } else if (request.action === 'getAnalytics') {
    sendResponse({ analytics });
    return false;
  }
  
  return false;
});

async function handleTranslateAndExplain(data, sendResponse) {
  console.log('Background: Starting translation for:', data.text);
  const startTime = Date.now();
  
  try {
    // Get API key and settings from storage
    console.log('Background: Fetching settings from storage');
    const result = await chrome.storage.local.get(['openaiApiKey', 'targetLanguage', 'subscriptionTier']);
    
    const apiKey = result.openaiApiKey;
    const targetLanguage = result.targetLanguage || 'English';
    const tier = result.subscriptionTier || 'free';
    
    console.log('Background: API key exists:', !!apiKey);
    console.log('Background: Target language:', targetLanguage);
    console.log('Background: Tier:', tier);
    
    if (!apiKey) {
      console.error('Background: No API key found');
      sendResponse({ 
        error: 'Please set your OpenAI API key in the extension popup first.' 
      });
      trackUsage('translate', Date.now() - startTime, false);
      return;
    }

    // Check usage limits
    const dailyUsage = await getDailyUsage();
    const limits = { free: 5, premium: 100 };
    
    console.log('Background: Daily usage:', dailyUsage, '/', limits[tier]);
    
    if (tier === 'free' && dailyUsage >= limits.free) {
      console.warn('Background: Daily limit reached');
      sendResponse({ 
        error: `Daily limit reached (${limits.free} translations). Upgrade to Premium for unlimited access.` 
      });
      trackUsage('translate', Date.now() - startTime, false);
      return;
    }

    console.log('Background: Making API request to OpenAI');
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
        max_tokens: 500,
        temperature: 0.7
      })
    });

    console.log('Background: API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Background: API error:', errorData);
      throw new Error(errorData.error?.message || 'API request failed');
    }

    const responseData = await response.json();
    console.log('Background: API response received successfully');
    const translationResult = responseData.choices[0].message.content;
    
    const latency = Date.now() - startTime;
    console.log('Background: Translation completed in', latency, 'ms');
    
    // Increment daily usage
    await incrementDailyUsage();
    
    trackUsage('translate', latency, true);
    
    sendResponse({ 
      success: true, 
      result: translationResult,
      latency,
      dailyUsage: dailyUsage + 1,
      limit: tier === 'free' ? limits.free : limits.premium
    });
  } catch (error) {
    console.error('Background: Error during translation:', error);
    const latency = Date.now() - startTime;
    trackUsage('translate', latency, false);
    sendResponse({ error: error.message });
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