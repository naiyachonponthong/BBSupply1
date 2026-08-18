/* =====================================================================
   BBSupply — โครงแอปและตัวจัดเส้นทาง
   หน้านี้ไม่ได้อยู่ใน iframe แล้ว จึงใช้ hash router ได้ตามปกติ
   แต่ยัง render ทันทีเมื่อสั่ง go() ไม่รอ event อย่างเดียว
   (มือถือบางรุ่นยิง hashchange ไม่สม่ำเสมอ)
   ===================================================================== */
window.BBS = window.BBS || {};

BBS.pages = BBS.pages || {};
BBS.pageKey = 'dashboard';
BBS.param = null;

BBS.app = {
  _lastHash: '',

  navItems: [
    { key: 'dashboard', label: 'แดชบอร์ด', icon: 'bi-speedometer2' },
    { group: 'งานพัสดุ' },
    { key: 'po', label: 'ใบสั่งซื้อ', icon: 'bi-file-earmark-text', perm: 'stock' },
    { key: 'receipts', label: 'รับเข้าพัสดุ', icon: 'bi-box-arrow-in-down', perm: 'stock' },
    { key: 'issues', label: 'เบิกจ่ายพัสดุ', icon: 'bi-box-arrow-up', perm: 'stock' },
    { key: 'scan', label: 'เบิกด้วยการสแกน', icon: 'bi-qr-code-scan', perm: ['stock', 'issue'] },
    { key: 'lots', label: 'ล็อต และวันหมดอายุ', icon: 'bi-calendar-x', perm: 'stock' },
    { key: 'counts', label: 'ตรวจนับ และปรับปรุงยอด', icon: 'bi-clipboard-check', perm: 'stock' },
    { group: 'ข้อมูลหลัก' },
    { key: 'items', label: 'รายการพัสดุ', icon: 'bi-box-seam', perm: 'master' },
    { key: 'suppliers', label: 'บริษัทผู้ขาย', icon: 'bi-building', perm: 'master' },
    { key: 'requesters', label: 'ผู้เบิก', icon: 'bi-person-badge', perm: 'master' },
    { group: 'รายงาน' },
    { key: 'reports', label: 'รายงานทั้งหมด', icon: 'bi-file-earmark-bar-graph', perm: 'report' },
    { group: 'ระบบ' },
    { key: 'settings', label: 'ตั้งค่า', icon: 'bi-gear', perm: 'master' }
  ],

  allowed: function (perm) {
    if (!perm) return true;
    if (Array.isArray(perm)) {
      return perm.some(function (p) { return BBS.can(p); });
    }
    return BBS.can(perm);
  },

  boot: function () {
    window.onerror = function (msg) { BBS.toast('ข้อผิดพลาด: ' + msg, 'err'); };

    document.getElementById('btnBurger').addEventListener('click', function () {
      document.body.classList.toggle('side-open');
    });
    document.getElementById('sideBackdrop').addEventListener('click', function () {
      document.body.classList.remove('side-open');
    });
    document.getElementById('bbsModalSave').addEventListener('click', function () {
      if (BBS.ui._onSave) BBS.ui._onSave();
    });
    window.addEventListener('hashchange', function () {
      var h = location.hash || '#/dashboard';
      if (h === BBS.app._lastHash) return;
      BBS.app.go(h);
    });

    document.getElementById('loginAppName').textContent = CONFIG.APP_NAME;
    document.getElementById('loginOrgName').textContent = CONFIG.ORG_NAME;
    BBS.ui.watch(document.getElementById('pageBody'));

    if (String(CONFIG.API_URL).indexOf('xxxxxxxx') > -1) {
      document.getElementById('loginView').innerHTML =
        '<div class="login-card"><div class="login-brand"><div class="login-mark">'
        + '<i class="bi bi-exclamation-triangle"></i></div><div><div class="login-title">ยังไม่ได้ตั้งค่า</div>'
        + '<div class="login-sub">ต้องใส่ URL ของ API ก่อนใช้งาน</div></div></div>'
        + '<div class="login-body">เปิดไฟล์ <code>web/js/config.js</code> แล้วใส่ URL ของเว็บแอป Apps Script '
        + 'ที่ลงท้ายด้วย <code>/exec</code> ในช่อง <code>API_URL</code></div></div>';
      return;
    }

    BBS.auth.boot();

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    }
  },

  show: function () {
    try {
      document.getElementById('loginView').style.display = 'none';
      document.getElementById('appView').classList.remove('d-none');

      var c = BBS.cfg || {};
      if (c.app_name) {
        document.getElementById('sideAppName').textContent = c.app_name;
        document.title = c.app_name;
      }
      document.getElementById('topOrgName').textContent = c.org_name || '';
      document.getElementById('sideVersion').textContent = 'เวอร์ชัน ' + (c.app_version || '1.0');
      document.getElementById('tuName').textContent = BBS.user.name || BBS.user.username;
      document.getElementById('tuRole').textContent = BBS.user.roleLabel || '';
      document.getElementById('tuAvatar').textContent = (BBS.user.name || 'ผ').trim().charAt(0);
      document.getElementById('btnLogout').classList.remove('d-none');

      BBS.app.buildNav();
      BBS.app.go(location.hash || '#/dashboard');
    } catch (e) { BBS.err(e); }
  },

  buildNav: function () {
    var h = '';
    var pending = null;
    BBS.app.navItems.forEach(function (it) {
      if (it.group) { pending = it.group; return; }
      if (it.perm && !BBS.app.allowed(it.perm)) return;
      if (!BBS.pages[it.key]) return;
      if (pending) { h += '<div class="nav-group">' + BBS.esc(pending) + '</div>'; pending = null; }
      h += '<a class="nav-link-bb" data-key="' + it.key + '" href="#/' + it.key + '">'
        + '<i class="bi ' + it.icon + '"></i>' + BBS.esc(it.label) + '</a>';
    });
    document.getElementById('sideNav').innerHTML = h;
  },

  go: function (path) {
    var clean = String(path || '').replace(/^#\//, '').replace(/^#/, '');
    var parts = clean.split('/');
    var key = parts[0] || 'dashboard';

    if (!BBS.pages[key]) { key = 'dashboard'; parts = ['dashboard']; }
    var item = BBS.app.navItems.filter(function (n) { return n.key === key; })[0];
    if (item && item.perm && !BBS.app.allowed(item.perm)) {
      BBS.toast('บัญชีของคุณไม่มีสิทธิ์ใช้งานส่วนนี้', 'warn');
      key = 'dashboard';
      parts = ['dashboard'];
    }

    if (BBS.cam && BBS.cam.running) BBS.cam.stop();
    BBS.pageKey = key;
    BBS.param = parts[1] || null;
    BBS.app._lastHash = '#/' + parts.join('/');
    if (location.hash !== BBS.app._lastHash) location.hash = BBS.app._lastHash;
    document.body.classList.remove('side-open');
    BBS.app.render();
  },

  route: function () { BBS.app.render(); },

  render: function () {
    var host = document.getElementById('pageBody');
    document.querySelectorAll('.nav-link-bb').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-key') === BBS.pageKey);
    });
    try {
      BBS.spinner(host);
      var res = BBS.pages[BBS.pageKey].render(host, BBS.param);
      if (res && res.catch) res.catch(function (e) { BBS.app.pageError(host, e); });
      window.scrollTo(0, 0);
    } catch (e) {
      BBS.app.pageError(host, e);
    }
  },

  pageError: function (host, e) {
    host.innerHTML = '<div class="card-bb"><div class="card-bb-body">'
      + '<div class="empty"><i class="bi bi-exclamation-triangle"></i>'
      + '<div>เปิดหน้านี้ไม่สำเร็จ</div>'
      + '<div class="hint">' + BBS.esc(e && e.message ? e.message : e) + '</div>'
      + '</div></div></div>';
    BBS.err(e);
  }
};

/* ให้หน้าเดิมเรียก BBS.route()/BBS.go() ได้เหมือนตอนอยู่บน Apps Script */
BBS.route = function () { BBS.app.route(); };
BBS.go = function (p) { BBS.app.go(p); };

document.addEventListener('DOMContentLoaded', function () { BBS.app.boot(); });
