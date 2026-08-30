#!/usr/bin/env node
// Petit serveur statique sans dépendance, pour prévisualiser index.html
// en conditions réelles (fetch de offres.js, exécution du JS).
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 5500;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/rss+xml; charset=utf-8',
};

http
  .createServer((req, res) => {
    // Retirer la query string AVANT de tester la racine : sinon "/?contrat=..."
    // (une URL de recherche partagée) n'est pas reconnu comme la racine et
    // renvoie 404.
    const pathOnly = req.url.split('?')[0];
    const urlPath = pathOnly === '/' ? '/index.html' : pathOnly;
    const filePath = path.join(ROOT, decodeURIComponent(urlPath));

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Interdit');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('404 : ' + urlPath);
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`[dev-server] JJ dispo sur http://localhost:${PORT}/`);
  });
