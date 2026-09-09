const path = require('path');
const express = require('express');

const app = express();
const PORT = Number(process.env.WEB_PORT || 3000);
const publicDir = path.join(__dirname, 'public');

app.use(express.static(publicDir));

const pages = [
  'book',
  'menu',
  'shop',
  'account',
  'login',
  'register',
];

for (const page of pages) {
  app.get(`/${page}`, (_req, res) => {
    res.sendFile(path.join(publicDir, `${page}.html`));
  });
}

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});

app.get('/admin/login', (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'login.html'));
});

app.get('/admin/products', (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'products.html'));
});

app.get('/admin/bookings', (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'bookings.html'));
});

app.get('/admin/menu', (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'menu.html'));
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cups & Pups web (Express) at http://localhost:${PORT}`);
});
