const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

function createStaticServer(rootDir, port = 8088) {
  const server = http.createServer((req, res) => {
    let filePath = path.join(rootDir, req.url.split('?')[0].split('#')[0]);
    if (filePath.endsWith('/') || filePath === rootDir) {
      filePath = path.join(rootDir, 'index.html');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        server,
        url: `http://localhost:${port}`
      });
    });
  });
}

module.exports = { createStaticServer };
