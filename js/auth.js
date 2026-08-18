/* =====================================================================
   BBSupply — เข้าสู่ระบบและการจัดการ session
   ===================================================================== */
window.BBS = window.BBS || {};

BBS.auth = {

  boot: function () {
    document.getElementById('lgBtn').addEventListener('click', BBS.auth.login);
    ['lgUser', 'lgPass'].forEach(function (id) {
      document.getElementById(id).addEventListener('keydown', function (e) {
        if (e.key === 'Enter') BBS.auth.login();
      });
    });
    document.getElementById('btnLogout').addEventListener('click', function () {
      BBS.ui.confirm({ title: 'ออกจากระบบ', message: 'ต้องการออกจากระบบหรือไม่', okText: 'ออกจากระบบ' })
        .then(function (yes) { if (yes) BBS.auth.logout(); });
    });

    var t = BBS.store.get('bbs_token');
    if (!t) { BBS.auth.forceLogin(); return; }
    BBS.token = t;
    BBS.api('auth.me').then(function (d) {
      BBS.user = d.user;
      BBS.cfg = d.config;
      BBS.app.show();
    }).catch(function () { BBS.auth.forceLogin(); });
  },

  login: function () {
    var btn = document.getElementById('lgBtn');
    var errBox = document.getElementById('lgError');
    errBox.classList.add('d-none');
    btn.disabled = true;
    btn.textContent = 'กำลังเข้าสู่ระบบ...';

    BBS.call('auth.login', {
      username: document.getElementById('lgUser').value.trim(),
      password: document.getElementById('lgPass').value
    }).then(function (r) {
      BBS.token = r.data.token;
      BBS.user = r.data.user;
      BBS.cfg = r.data.config;
      BBS.store.set('bbs_token', BBS.token);
      document.getElementById('lgPass').value = '';
      BBS.app.show();
    }).catch(function (e) {
      errBox.textContent = e.message;
      errBox.classList.remove('d-none');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = 'เข้าสู่ระบบ';
    });
  },

  logout: function () {
    BBS.call('auth.logout').catch(function () { });
    BBS.store.del('bbs_token');
    BBS.token = null;
    BBS.user = null;
    BBS.auth.forceLogin();
  },

  forceLogin: function () {
    BBS.store.del('bbs_token');
    BBS.token = null;
    document.getElementById('appView').classList.add('d-none');
    document.getElementById('loginView').style.display = 'flex';
    document.body.classList.remove('side-open');
  }
};
