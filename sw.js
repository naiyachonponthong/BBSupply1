/* =====================================================================
   BBSupply — service worker
   ใช้แค่ให้ติดตั้งเป็นแอปบนหน้าจอมือถือและเปิดได้เร็วขึ้น
   ห้ามแคชคำขอที่คุยกับ Apps Script เด็ดขาด (ข้อมูลสต๊อกต้องสดเสมอ)
   ===================================================================== */
var CACHE = 'bbsupply-v1';
var ASSETS = [
  './', './index.html', './assets/theme.css',
  './js/config.js', './js/api.js', './js/ui.js', './js/auth.js', './js/app.js',
  './js/pages/dashboard.js', './js/pages/master.js', './js/pages/stock.js',
  './js/pages/issue.js', './js/pages/scan.js', './js/pages/reports.js', './js/pages/settings.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ASSETS).catch(function () { });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                       // ไม่แตะคำขอ POST ที่คุยกับ API
  if (req.url.indexOf('script.google.com') > -1) return;  // ข้อมูลต้องสดเสมอ
  if (req.url.indexOf('googleusercontent.com') > -1) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(function () { return caches.match('./index.html'); }));
    return;
  }

  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});
