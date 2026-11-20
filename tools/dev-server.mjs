#!/usr/bin/env node
/**
 * Minimal local dev server for the static WebApp.
 * It serves ./ and proxies /api/* to https://opt.mk38.de because the public
 * API only allows the GitHub Pages origin. No dependencies.
 */
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT_DIR
  ? resolve(process.env.ROOT_DIR)
  : resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const API_HOST = 'opt.mk38.de';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function proxy(req, res) {
  const targetPath = req.url.replace(/^\/api/, '') || '/';
  const options = {
    host: API_HOST,
    path: targetPath,
    method: req.method,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'prayer-times-webapp-dev/1.0',
    },
  };
  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      ...(proxyRes.headers['retry-after'] ? { 'Retry-After': proxyRes.headers['retry-after'] } : {}),
    });
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (error) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  });
  req.pipe(proxyReq);
}

function serve(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  if (stats.isDirectory()) {
    res.writeHead(302, { Location: `${pathname.replace(/\/?$/, '/')}index.html` }).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
    'Content-Length': stats.size,
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) proxy(req, res);
  else serve(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Prayer Times WebApp (bound to ${HOST}:${PORT})`);
  console.log(`  local: http://127.0.0.1:${PORT}/`);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        console.log(`  LAN:   http://${entry.address}:${PORT}/`);
      }
    }
  }
  console.log(`  API proxy: /api/  ->  https://${API_HOST}/`);
});
