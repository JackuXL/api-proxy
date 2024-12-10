const API_KEYS = (process.env.API_KEYS || '').split(',').filter(key => key.trim());
const BASE_URL = process.env.BASE_URL || 'https://api.openai.com';

let currentKeyIndex = 0;

async function handleStream(response, res) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk); // 将数据块写入响应流
      }
    }

    res.end(); // 结束响应流
  }

  async function handleNonStream(response, res) {
    const data = await response.json();
    res.status(response.status).json(data);
  }

async function proxyRequest(req, res, apiKey) {
  // Use `req.url` directly for Serverless Functions
  const path = req.url.replace('/v1/', ''); // Remove /v1/ prefix
  const targetUrl = `${BASE_URL}/v1/${path}`;

  // Access headers directly
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': req.headers['content-type'] || 'application/json', // Forward content-type or default to JSON
    // Add other headers as needed, excluding 'host'
  };

  // Access the body directly as a string or buffer
  let body = null;
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    body = req.body; // in nodejs env, req.body is String or Buffer
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });

    // 转发响应头
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }

    // Check for content type before parsing
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/event-stream')) {
        return handleStream(response, res);
    } else {
        return handleNonStream(response, res);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    throw error; // Re-throw to be handled by the outer function
  }
}

module.exports = async (req, res) => {
  if (!API_KEYS.length) {
    return res.status(500).json({
      error: {
        message: "API_KEYS environment variable is not set or is empty. Please configure it in your Vercel project settings.",
        type: "config_error",
        param: "API_KEYS",
        code: "missing_api_keys"
      }
    });
  }

  let retries = 0;
  const maxRetries = API_KEYS.length;

  while (retries < maxRetries) {
    const apiKey = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;

    try {
      await proxyRequest(req, res, apiKey);
      return;
    } catch (error) {
      retries++;
      console.warn(`Request failed with key ${apiKey}, retrying... (${retries}/${maxRetries})`);
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  return res.status(500).json({
    error: {
        message: "All API keys failed",
        type: "api_error",
        param: null,
        code: "all_keys_failed"
      }
  });
};
