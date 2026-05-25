const https = require('https');

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'API Key nicht konfiguriert.' }) };

  try {
    const body = JSON.parse(event.body);

    const postData = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: body.system,
      tools: [{
        name: 'instagram_post',
        description: 'Gibt einen fertigen Instagram-Post zurück',
        input_schema: {
          type: 'object',
          properties: {
            saeule:  { type: 'string' },
            format:  { type: 'string' },
            hook:    { type: 'string' },
            caption: { type: 'string' },
            canva:   { type: 'string' }
          },
          required: ['saeule','format','hook','caption','canva']
        }
      }],
      tool_choice: { type: 'tool', name: 'instagram_post' },
      messages: body.messages
    });

    const data = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch(e) { reject(new Error('API Fehler: ' + raw.substring(0, 300))); }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    // Tool Use gibt garantiert valides JSON zurück
    const toolBlock = (data.content || []).find(b => b.type === 'tool_use');
    const post = toolBlock ? toolBlock.input : null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ post })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
