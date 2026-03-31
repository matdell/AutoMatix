const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 4001;
const SERVICE_NAME = process.env.SERVICE_NAME || 'central-api';
const SYNC_HMAC_SECRET = process.env.SYNC_HMAC_SECRET || 'dev-hmac-secret';

function jsonResponse(res, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function signPayload(payload) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SYNC_HMAC_SECRET).update(body).digest('hex');
  return { body, signature };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname, query } = parsedUrl;

  if (req.method === 'GET' && pathname === '/') {
    return jsonResponse(res, 200, {
      service: SERVICE_NAME,
      status: 'ok',
      time: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && pathname === '/health') {
    return jsonResponse(res, 200, {
      service: SERVICE_NAME,
      status: 'ok',
      time: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && pathname === '/sync/batch') {
    const bankId = query.bankId;
    const entity = query.entity;
    const cursor = query.cursor || '0';

    if (!bankId || !entity) {
      return jsonResponse(res, 400, {
        error: 'Missing bankId or entity',
      });
    }

    const batchId = crypto.randomUUID();
    const payload = {
      bankId,
      entity,
      cursor,
      nextCursor: cursor,
      items: [],
      batchId,
      generatedAt: new Date().toISOString(),
    };

    const { body, signature } = signPayload(payload);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-Signature': signature,
      'X-Signature-Alg': 'HMAC-SHA256',
      'X-Batch-Id': batchId,
    });
    return res.end(body);
  }

  if (req.method === 'POST' && pathname === '/sync/ack') {
    try {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};

      if (!payload.bankId || !payload.batchId || !payload.entity) {
        return jsonResponse(res, 400, {
          error: 'Missing bankId, batchId or entity',
        });
      }

      console.log('[sync/ack]', {
        bankId: payload.bankId,
        batchId: payload.batchId,
        entity: payload.entity,
        status: payload.status,
        cursor: payload.cursor,
      });

      return jsonResponse(res, 200, {
        ok: true,
        receivedAt: new Date().toISOString(),
      });
    } catch (error) {
      return jsonResponse(res, 400, {
        error: 'Invalid JSON payload',
      });
    }
  }

  return jsonResponse(res, 404, {
    error: 'Not found',
  });
});

server.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] listening on port ${PORT}`);
});
