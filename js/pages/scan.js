/* =====================================================================
   BBSupply — เบิกด้วยการสแกน QR (รวมอยู่ในระบบเดียวแล้ว)
   กล้องเป็นชั้น overlay เต็มจอแยกต่างหาก ไม่ใช้ popup ร่วมกับฟอร์ม
   (บทเรียนจากระบบแจ้งซ่อม: ถ้าใช้ modal ร่วมกัน ปิดกล้องแล้วฟอร์มหายทั้งใบ)
   ===================================================================== */

BBS.cam = {
  reader: null,
  running: false,
  onCode: null,
  lastCode: '',
  lastAt: 0,

  ensure: function () {
    if (document.getElementById('camOverlay')) return;
    var el = document.createElement('div');
    el.id = 'camOverlay';
    el.className = 'cam-overlay d-none';
    el.innerHTML = '<div class="cam-bar">'
      + '<div id="camTitle">สแกน QR</div>'
      + '<button class="cam-close" id="camClose"><i class="bi bi-x-lg"></i></button>'
      + '</div>'
      + '<div class="cam-stage"><div id="camReader"></div></div>'
      + '<div class="cam-hint" id="camHint">เล็งกล้องไปที่ QR บนกล่องพัสดุหรือบัตรผู้เบิก</div>';
    document.body.appendChild(el);
    document.getElementById('camClose').addEventListener('click', function () { BBS.cam.stop(); });
  },

  start: function (title, onCode) {
    BBS.cam.ensure();
    if (!window.Html5Qrcode) { BBS.toast('โหลดตัวอ่าน QR ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต', 'err'); return; }
    BBS.cam.onCode = onCode;
    document.getElementById('camTitle').textContent = title || 'สแกน QR';
    document.getElementById('camOverlay').classList.remove('d-none');
    document.body.classList.add('cam-open');

    BBS.cam.reader = new Html5Qrcode('camReader', { verbose: false });
    BBS.cam.running = true;
    BBS.cam.reader.start(
      { facingMode: CONFIG.CAMERA || 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      function (text) {
        var now = Date.now();
        if (text === BBS.cam.lastCode && now - BBS.cam.lastAt < 2500) return;
        BBS.cam.lastCode = text;
        BBS.cam.lastAt = now;
        BBS.cam.beep();
        if (BBS.cam.onCode) BBS.cam.onCode(text);
      },
      function () { }
    ).catch(function (e) {
      BBS.cam.stop();
      BBS.toast('เปิดกล้องไม่ได้: ' + (e && e.message ? e.message : e)
        + ' — ต้องเปิดหน้านี้ผ่าน https และกดอนุญาตให้ใช้กล้อง', 'err');
    });
  },

  stop: function () {
    BBS.cam.running = false;
    document.body.classList.remove('cam-open');
    var o = document.getElementById('camOverlay');
    if (o) o.classList.add('d-none');
    if (BBS.cam.reader) {
      try {
        BBS.cam.reader.stop().then(function () { BBS.cam.reader.clear(); }).catch(function () { });
      } catch (e) { }
      BBS.cam.reader = null;
    }
  },

  beep: function () {
    if (!CONFIG.BEEP) return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 1180; g.gain.value = 0.08;
      o.start();
      setTimeout(function () { o.stop(); ctx.close(); }, 110);
    } catch (e) { }
  }
};

BBS.pages.scan = {
  ctx: null,
  requester: null,
  cart: [],

  render: function (host) {
    var self = this;
    return BBS.api('issue.ctx').then(function (ctx) {
      self.ctx = ctx;
      self.draw(host);
    });
  },

  draw: function (host) {
    var self = this;
    host = host || document.getElementById('pageBody');

    var who = self.requester
      ? '<div class="card-bb"><div class="card-bb-body d-flex align-items-center gap-3">'
      + '<i class="bi bi-person-badge" style="font-size:1.7rem;color:var(--brand-700)"></i>'
      + '<div><div class="fw-bold">' + BBS.esc(self.requester.name) + '</div>'
      + '<div class="t-mute">' + BBS.esc(self.requester.dept || '') + ' · บัตร ' + BBS.esc(self.requester.code) + '</div></div>'
      + '<button class="btn btn-light btn-sm ms-auto" id="btnChangeReq">เปลี่ยนผู้เบิก</button>'
      + '</div></div>'
      : '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-1-circle"></i> ระบุผู้เบิก</div>'
      + '<div class="card-bb-body">'
      + '<button class="btn btn-brand w-100 mb-3 py-2" id="btnScanReq"><i class="bi bi-qr-code-scan"></i> สแกนบัตรผู้เบิก</button>'
      + '<div class="t-mute text-center mb-2">หรือเลือกจากรายชื่อ</div>'
      + '<select class="form-select" id="selReq"><option value="">— เลือกผู้เบิก —</option>'
      + self.ctx.requesters.map(function (r) {
        return '<option value="' + r.id + '">' + BBS.esc(r.code + ' · ' + r.name + ' (' + r.dept + ')') + '</option>';
      }).join('')
      + '</select></div></div>';

    var scanCard = self.requester
      ? '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-2-circle"></i> สแกนพัสดุ</div>'
      + '<div class="card-bb-body">'
      + '<button class="btn btn-brand w-100 py-2 mb-3" id="btnScanItem"><i class="bi bi-qr-code-scan"></i> เปิดกล้องสแกน QR บนกล่อง</button>'
      + '<label class="form-label">ไม่มี QR ที่กล่อง — ค้นหาด้วยชื่อ</label>'
      + '<div class="input-group"><input class="form-control" id="q" placeholder="พิมพ์ชื่อหรือรหัสพัสดุ">'
      + '<button class="btn btn-outline-brand" id="btnSearch"><i class="bi bi-search"></i></button></div>'
      + '<div id="searchRes" class="mt-2"></div>'
      + '</div></div>'
      : '';

    var cartCard = '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-basket"></i> รายการที่จะเบิก'
      + '<span class="sub">' + self.cart.length + ' รายการ</span></div>'
      + '<div class="card-bb-body" id="cartBox">' + self.cartHtml() + '</div>'
      + (self.cart.length
        ? '<div class="card-bb-body" style="border-top:1px solid var(--line)">'
        + '<div class="d-flex align-items-center gap-3">'
        + '<div><div class="t-mute">รวมทั้งหมด</div><div class="fw-bold" style="font-size:1.2rem">'
        + BBS.num(self.cart.reduce(function (s, c) { return s + Number(c.qty || 0); }, 0), 2) + ' หน่วย</div></div>'
        + '<button class="btn btn-brand ms-auto px-4" id="btnCommit">ยืนยันการเบิก</button>'
        + '</div></div>'
        : '')
      + '</div>';

    host.innerHTML = BBS.head('เบิกด้วยการสแกน', 'สแกนบัตรผู้เบิกแล้วสแกน QR บนกล่องพัสดุ')
      + '<div class="grid-2"><div>' + who + scanCard + cartCard + '</div>'
      + '<div><div class="card-bb"><div class="card-bb-head"><i class="bi bi-lightbulb"></i> วิธีใช้</div>'
      + '<div class="card-bb-body">'
      + BBS.kv('ขั้นที่ 1', 'สแกนบัตรผู้เบิก')
      + BBS.kv('ขั้นที่ 2', 'สแกน QR บนกล่อง')
      + BBS.kv('ขั้นที่ 3', 'ใส่จำนวนแล้วเพิ่มในใบเบิก')
      + BBS.kv('ขั้นที่ 4', 'กดยืนยันการเบิก')
      + '<div class="t-mute mt-2">ล็อตที่หมดอายุแล้วระบบจะไม่ให้เบิก และจะเตือนเมื่อสแกนล็อตที่ข้ามคิวล็อตที่ควรใช้ก่อน</div>'
      + '</div></div></div></div>';

    var el;
    if ((el = document.getElementById('btnScanReq'))) el.addEventListener('click', function () {
      BBS.cam.start('สแกนบัตรผู้เบิก', function (code) { self.resolve(code); });
    });
    if ((el = document.getElementById('selReq'))) el.addEventListener('change', function () {
      var v = this.value;
      var r = self.ctx.requesters.filter(function (x) { return x.id === v; })[0];
      if (r) { self.requester = r; self.draw(); }
    });
    if ((el = document.getElementById('btnChangeReq'))) el.addEventListener('click', function () {
      self.requester = null; self.draw();
    });
    if ((el = document.getElementById('btnScanItem'))) el.addEventListener('click', function () {
      BBS.cam.start('สแกน QR บนกล่องพัสดุ', function (code) { self.resolve(code); });
    });
    if ((el = document.getElementById('btnSearch'))) el.addEventListener('click', function () { self.search(); });
    if ((el = document.getElementById('q'))) el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') self.search();
    });
    if ((el = document.getElementById('btnCommit'))) el.addEventListener('click', function () { self.commit(); });

    var box = document.getElementById('cartBox');
    if (box) box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]');
      if (!b) return;
      self.cart.splice(Number(b.getAttribute('data-del')), 1);
      self.draw();
    });
  },

  cartHtml: function () {
    var self = this;
    if (!self.cart.length) {
      return BBS.emptyBox('ยังไม่มีรายการ', 'สแกน QR ที่กล่องพัสดุเพื่อเพิ่มรายการ', 'bi-basket');
    }
    return self.cart.map(function (c, i) {
      var warn = '';
      if (c.better) warn = '<span class="pill pill-warn">ข้ามคิว FEFO</span> ';
      return '<div class="kv"><span>'
        + '<span class="v">' + BBS.esc(c.name) + '</span>'
        + '<div class="t-mute">' + BBS.esc(c.code) + ' · ล็อต ' + BBS.esc(c.lotNo || '-')
        + ' · EXP ' + BBS.dateTH(c.expDate) + '</div>'
        + (warn ? '<div class="mt-1">' + warn + '</div>' : '')
        + '</span>'
        + '<span class="text-end"><b style="font-size:1.05rem">' + BBS.num(c.qty, 2) + '</b> ' + BBS.esc(c.unit)
        + '<div><button class="btn-mini danger mt-1" data-del="' + i + '">ลบ</button></div></span></div>';
    }).join('');
  },

  resolve: function (code) {
    var self = this;
    BBS.api('scan.resolve', { code: code }).then(function (d) {
      if (d.type === 'requester') {
        self.requester = d.requester;
        BBS.cam.stop();
        BBS.toast('ผู้เบิก: ' + d.requester.name, 'ok');
        self.draw();
        return;
      }
      if (d.type === 'lot') { self.askQty(d.line); return; }
      if (d.type === 'issue') {
        BBS.toast('ใบเบิก ' + d.issue.no + ' · ' + d.issue.requesterName, 'ok');
        return;
      }
      BBS.toast('ไม่รู้จัก QR นี้', 'warn');
    }).catch(BBS.err);
  },

  askQty: function (line) {
    var self = this;
    var warn = '';
    if (line.expired) warn = '<div class="pill pill-danger mb-2">ล็อตนี้หมดอายุแล้ว ไม่ควรนำไปใช้</div>';
    else if (line.better) {
      warn = '<div class="pill pill-warn mb-2">ควรใช้ล็อต ' + BBS.esc(line.better.lotNo)
        + ' (EXP ' + BBS.dateTH(line.better.expDate) + ') ก่อน</div>';
    } else if (line.auto) {
      warn = '<div class="pill pill-line mb-2">ระบบเลือกล็อตที่ควรใช้ก่อนให้อัตโนมัติ</div>';
    }

    BBS.ui.openHtml({
      title: 'ระบุจำนวนที่เบิก',
      html: '<div class="fw-bold">' + BBS.esc(line.name) + '</div>'
        + '<div class="t-mute mb-2">' + BBS.esc(line.code) + ' · ล็อต ' + BBS.esc(line.lotNo || '-')
        + ' · EXP ' + BBS.dateTH(line.expDate) + ' · คงเหลือ ' + BBS.num(line.remain, 2) + ' ' + BBS.esc(line.unit) + '</div>'
        + warn
        + '<div class="input-group input-group-lg">'
        + '<button class="btn btn-outline-secondary" id="qMinus">−</button>'
        + '<input type="number" class="form-control text-center" id="qVal" value="1" min="1" step="1">'
        + '<button class="btn btn-outline-secondary" id="qPlus">+</button></div>',
      saveText: 'เพิ่มในใบเบิก',
      onSave: function () {
        var q = Number(document.getElementById('qVal').value || 0);
        if (q <= 0) { BBS.toast('กรุณาระบุจำนวน', 'warn'); return; }
        if (q > line.remain) { BBS.toast('ล็อตนี้เหลือ ' + BBS.num(line.remain, 2) + ' ' + line.unit + ' ไม่พอเบิก', 'warn'); return; }
        if (line.expired) { BBS.toast('ล็อตหมดอายุแล้ว เบิกไม่ได้', 'err'); return; }

        var same = self.cart.filter(function (c) { return c.lotId === line.lotId; })[0];
        if (same) same.qty = Number(same.qty) + q;
        else {
          self.cart.push({
            itemId: line.itemId, lotId: line.lotId, code: line.code, name: line.name,
            unit: line.unit, lotNo: line.lotNo, expDate: line.expDate, qty: q, better: line.better
          });
        }
        BBS.ui.close();
        BBS.toast('เพิ่ม ' + line.name + ' ' + q + ' ' + line.unit + ' แล้ว', 'ok');
        self.draw();
      }
    });

    setTimeout(function () {
      var val = document.getElementById('qVal');
      document.getElementById('qMinus').addEventListener('click', function () {
        val.value = Math.max(1, Number(val.value || 1) - 1);
      });
      document.getElementById('qPlus').addEventListener('click', function () {
        val.value = Number(val.value || 0) + 1;
      });
      val.focus();
      val.select();
    }, 350);
  },

  search: function () {
    var self = this;
    var q = document.getElementById('q').value.trim();
    var box = document.getElementById('searchRes');
    if (q.length < 2) { BBS.toast('พิมพ์อย่างน้อย 2 ตัวอักษร', 'warn'); return; }
    box.innerHTML = '<div class="t-mute">กำลังค้นหา...</div>';
    BBS.api('scan.search', { q: q }).then(function (d) {
      var items = d.items || [];
      if (!items.length) { box.innerHTML = '<div class="t-mute">ไม่พบพัสดุที่ค้นหา</div>'; return; }
      box.innerHTML = items.map(function (i) {
        return '<button class="btn btn-light w-100 text-start mb-1" data-code="' + BBS.esc(i.code) + '">'
          + '<b>' + BBS.esc(i.name) + '</b><div class="t-mute">' + BBS.esc(i.code)
          + ' · คงเหลือ ' + BBS.num(i.onHand, 2) + ' ' + BBS.esc(i.unit) + '</div></button>';
      }).join('');
      box.querySelectorAll('[data-code]').forEach(function (b) {
        b.addEventListener('click', function () {
          self.resolve('BBS|I|' + this.getAttribute('data-code'));
        });
      });
    }).catch(function (e) { box.innerHTML = '<div class="t-mute">' + BBS.esc(e.message) + '</div>'; });
  },

  commit: function () {
    var self = this;
    if (!self.requester) { BBS.toast('กรุณาระบุผู้เบิกก่อน', 'warn'); return; }
    if (!self.cart.length) { BBS.toast('ยังไม่มีรายการที่จะเบิก', 'warn'); return; }

    var btn = document.getElementById('btnCommit');
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก...';

    BBS.apiMsg('scan.commit', {
      requesterId: self.requester.id,
      purpose: 'เบิกผ่านการสแกน QR',
      lines: self.cart.map(function (c) { return { itemId: c.itemId, lotId: c.lotId, qty: c.qty }; })
    }).then(function (r) {
      self.cart = [];
      BBS.toast(r.message, 'ok');
      var no = r.data.no;
      var id = r.data.id;
      BBS.ui.openHtml({
        title: 'บันทึกการเบิกเรียบร้อย',
        html: '<div class="text-center py-2">'
          + '<div style="font-size:2.6rem;color:var(--ok)"><i class="bi bi-check-circle-fill"></i></div>'
          + '<div class="mt-2">ใบเบิกเลขที่</div>'
          + '<div style="font-size:1.4rem;font-weight:700">' + BBS.esc(no) + '</div>'
          + '<div class="t-mute mt-1">ผู้เบิก: ' + BBS.esc(self.requester.name) + '</div>'
          + '<div class="btn-row justify-content-center mt-3">'
          + '<button class="btn btn-light btn-sm" id="btnOpenIssue">เปิดใบเบิก</button>'
          + '<button class="btn btn-light btn-sm" id="btnNextReq">เปลี่ยนผู้เบิก</button>'
          + '</div></div>'
      });
      setTimeout(function () {
        document.getElementById('btnOpenIssue').addEventListener('click', function () {
          BBS.ui.close();
          BBS.go('#/issues');
          setTimeout(function () { BBS.pages.issues.view(id); }, 700);
        });
        document.getElementById('btnNextReq').addEventListener('click', function () {
          BBS.ui.close();
          self.requester = null;
          self.draw();
        });
      }, 350);
      self.draw();
    }).catch(function (e) {
      BBS.err(e);
      if (btn) { btn.disabled = false; btn.textContent = 'ยืนยันการเบิก'; }
    });
  }
};
