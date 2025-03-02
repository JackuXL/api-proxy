export async function onRequest(context) {
  const { request, env } = context;
  const API_KEYS = env.API_KEYS ? env.API_KEYS.split(',').map(key => key.trim()).filter(Boolean) : [];
  const BASE_URL = env.BASE_URL || 'https://api.openai.com';

  let currentKeyIndex = 0;

  async function handleStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let stream = '';

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        stream += chunk;
      }
    }

    return new Response(stream, {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async function handleNonStream(response) {
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async function proxyRequest(apiKey) {
    const url = new URL(request.url);
    let targetUrl;
    if (url.pathname.startsWith('/api')) {
      targetUrl = `${BASE_URL}${url.pathname.replace('/api', '/v1')}`;
    } else {
      targetUrl = `${BASE_URL}${url.pathname}`;
    }

    console.log('targetUrl:', targetUrl);

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': request.headers.get('content-type') || 'application/json',
    };

    let body = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      body = await request.text();
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: body,
      });

      console.log('Response headers from target:', response.headers);

      if (response.ok) {
        return await handleStream(response);
      } else {
        return await handleNonStream(response);
      }
    } catch (error) {
      console.error('Proxy error:', error);
      throw error;
    }
  }

  if (!API_KEYS.length) {
    return new Response(JSON.stringify({
      error: {
        message: "API_KEYS environment variable is not set or is empty",
        type: "config_error",
        param: "API_KEYS",
        code: "missing_api_keys"
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let retries = 0;
  const maxRetries = API_KEYS.length;

  while (retries < maxRetries) {
    const apiKey = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;

    try {
      return await proxyRequest(apiKey);
    } catch (error) {
      retries++;
      console.warn(`Request failed with key ${apiKey}, retrying... (${retries}/${maxRetries})`);
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  return new Response(JSON.stringify({
    error: {
      message: "All API keys failed",
      type: "api_error",
      param: null,
      code: "all_keys_failed"
    }
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}
