const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

const envRoot = path.resolve(__dirname, '..');
loadEnvFile(path.join(envRoot, '.env.local'));
loadEnvFile(path.join(envRoot, '.env'));

const PORT = process.env.PORT || 4001;
const SERVICE_NAME = process.env.SERVICE_NAME || 'central-api';

function jsonResponse(res, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
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
  const { pathname } = parsedUrl;

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

  if (pathname && pathname.startsWith('/sync/')) {
    try {
      const rawBody = await readBody(req);
      void rawBody;

      return jsonResponse(res, 410, {
        error: 'Central sync disabled by security policy',
        message:
          'La plataforma central no sincroniza datos comerciales de bancos. Solo administra alta/provisionamiento de bancos.',
        receivedAt: new Date().toISOString(),
      });
    } catch {
      return jsonResponse(res, 410, {
        error: 'Central sync disabled by security policy',
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
