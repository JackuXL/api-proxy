export const config = {
  runtime: 'edge',
};

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
  const path = req.url.replace(new URL(req.url).origin, '').replace('/v1/', '');
  const targetUrl = `${BASE_URL}/v1/${path}`;

  // 读取请求体, 并根据情况传递给 fetch
  let body = null;
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    body = req.body;
  }

  // 构造转发请求的 headers
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
  };
  for (const [key, value] of req.headers.entries()) {
    if (!['host', 'authorization'].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
      duplex: 'half', // 支持流式请求
    });

    // 转发响应头
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }

    // 检查是否是流式响应
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/event-stream')) {
      // 处理流式响应
      return handleStream(response, res);
    } else {
      // 处理非流式响应
      return handleNonStream(response, res);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    throw error; // 继续抛出错误，以便上层处理
  }
}

export default async function handler(req, res) {
  if (!API_KEYS.length) {
    return new Response(JSON.stringify({
      error: {
        message: "API_KEYS environment variable is not set or is empty. Please configure it in your Vercel project settings.",
        type: "config_error",
        param: "API_KEYS",
        code: "missing_api_keys"
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let retries = 0;
  const maxRetries = API_KEYS.length;

  while (retries < maxRetries) {
    const apiKey = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length; // 循环使用 key

    try {
      await proxyRequest(req, res, apiKey);
      return; // 请求成功，直接返回
    } catch (error) {
      retries++;
      console.warn(`Request failed with key ${apiKey}, retrying... (${retries}/${maxRetries})`);
      // 如果不是最后一个 key，则等待一段时间再重试
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 等待 500ms
      }
    }
  }

  // 所有 key 都尝试失败
  return new Response(JSON.stringify({
     error: {
        message: "All API keys failed",
        type: "api_error",
        param: null,
        code: "all_keys_failed"
      }
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
