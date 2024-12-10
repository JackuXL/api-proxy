export default async function handler(req, res) {
  const baseUrl = process.env.BASE_URL || 'https://api.openai.com';
  
  // 从环境变量获取多个 API Key，用逗号分隔
  const apiKeys = (process.env.API_KEYS || '').split(',').filter(key => key.trim());
  
  // 使用静态变量记录当前使用的 key 的索引
  if (typeof handler.currentKeyIndex === 'undefined') {
    handler.currentKeyIndex = 0;
  }

  // 获取当前要使用的 API Key
  const currentKey = apiKeys[handler.currentKeyIndex];
  
  // 更新索引，实现轮询
  handler.currentKeyIndex = (handler.currentKeyIndex + 1) % apiKeys.length;

  const path = req.url.replace('/v1/', '');
  const targetUrl = `${baseUrl}/v1/${path}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${currentKey}`,
        'Content-Type': 'application/json',
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
