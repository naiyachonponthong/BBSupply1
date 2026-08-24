/* =====================================================================
   BBSupply — service worker
   ใช้แค่ให้ติดตั้งเป็นแอปบนหน้าจอมือถือและเปิดได้เร็วขึ้น
   ห้ามแคชคำขอที่คุยกับ Apps Script เด็ดขาด (ข้อมูลสต๊อกต้องสดเสมอ)
   ===================================================================== */
var CACHE = 'bbsupply-v4';
var ASSETS = [
  './', './index.html', './assets/theme.css?v=20260824-2',
  './js/config.js?v=20260824-2', './js/api.js?v=20260824-2',
  './js/ui.js?v=20260824-2', './js/auth.js?v=20260824-2', './js/app.js?v=20260824-2',
  './js/pages/dashboard.js?v=20260824-2', './js/pages/master.js?v=20260824-2',
  './js/pages/stock.js?v=20260824-2', './js/pages/issue.js?v=20260824-2',
  './js/pages/scan.js?v=20260824-2', './js/pages/reports.js?v=20260824-2',
  './js/pages/settings.js?v=20260824-2'
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

  /* network-first เพื่อไม่ให้ไฟล์ JS/CSS เวอร์ชันเก่าค้างหลัง Deploy
     หากออฟไลน์จึงค่อยใช้ไฟล์จาก cache */
  e.respondWith(fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () { return caches.match(req); }));
});
