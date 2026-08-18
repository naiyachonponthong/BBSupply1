/* =====================================================================
   BBSupply — ตัวช่วย UI ที่ใช้ร่วมทุกหน้า
   ===================================================================== */
window.BBS = window.BBS || {};

/* ---------- แปลงค่า ---------- */
BBS.esc = function (s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

BBS.num = function (n, d) {
  return Number(n || 0).toLocaleString('th-TH', {
    minimumFractionDigits: d || 0,
    maximumFractionDigits: d === undefined ? 0 : d
  });
};

BBS.money = function (n) { return BBS.num(n, 2); };

BBS.dateTH = function (iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  var m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear() + 543);
};

BBS.dateTimeTH = function (iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  var p = function (x) { return ('0' + x).slice(-2); };
  return BBS.dateTH(iso) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
};

BBS.today = function () {
  var d = new Date();
  var p = function (x) { return ('0' + x).slice(-2); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
};

BBS.daysTo = function (expDate) {
  if (!expDate) return null;
  var d = new Date(expDate + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
};

BBS.can = function (perm) {
  if (!BBS.user) return false;
  var p = BBS.user.permissions || [];
  return p.indexOf('*') > -1 || p.indexOf(perm) > -1;
};

BBS.isAdmin = function () { return !!(BBS.user && BBS.user.role === 'admin'); };

BBS.store = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) { } }
};

/* ---------- แจ้งเตือน ---------- */
BBS.toast = function (msg, type) {
  var wrap = document.getElementById('toastWrap');
  var el = document.createElement('div');
  el.className = 'toast-bb ' + (type || 'ok');
  el.innerHTML = BBS.esc(msg);
  wrap.appendChild(el);
  setTimeout(function () {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
  }, 3400);
};

BBS.err = function (e) { BBS.toast((e && e.message) ? e.message : 'เกิดข้อผิดพลาด', 'err'); };

BBS.spinner = function (host) {
  host.innerHTML = '<div class="spin-wrap"><div class="spinner-border text-secondary" role="status"></div>'
    + '<div class="mt-2 small">กำลังโหลดข้อมูล</div></div>';
};

/* ---------- ชิ้นส่วนหน้าจอ ---------- */
BBS.head = function (title, sub, actionsHtml) {
  return '<div class="page-head"><div><h1 class="page-title">' + BBS.esc(title) + '</h1>'
    + (sub ? '<div class="page-sub">' + BBS.esc(sub) + '</div>' : '')
    + '</div>'
    + (actionsHtml ? '<div class="page-actions">' + actionsHtml + '</div>' : '')
    + '</div>';
};

BBS.emptyBox = function (text, hint, icon) {
  return '<div class="empty"><i class="bi ' + (icon || 'bi-inbox') + '"></i>'
    + '<div>' + BBS.esc(text) + '</div>'
    + (hint ? '<div class="hint">' + BBS.esc(hint) + '</div>' : '')
    + '</div>';
};

BBS.activePill = function (active) {
  return active === false
    ? '<span class="pill pill-mute">ปิดใช้งาน</span>'
    : '<span class="pill pill-ok">ใช้งาน</span>';
};

BBS.kv = function (k, v) {
  return '<div class="kv"><span class="k">' + BBS.esc(k) + '</span><span class="v">' + BBS.esc(v) + '</span></div>';
};

BBS.statCard = function (label, val, unit, cls, money) {
  return '<div class="stat ' + (cls || '') + '"><div class="lbl">' + BBS.esc(label) + '</div>'
    + '<div class="val">' + (money ? BBS.money(val) : BBS.num(val, 0))
    + '<span class="unit">' + BBS.esc(unit) + '</span></div></div>';
};

/* แถบอายุพัสดุ — องค์ประกอบเด่นของระบบนี้ */
BBS.expBar = function (expDate, days) {
  if (!expDate) return '<span class="t-mute">ไม่ระบุวันหมดอายุ</span>';
  var d = (days === null || days === undefined) ? BBS.daysTo(expDate) : days;
  var warn = Number(BBS.cfg.expiry_warn_days || 90);
  var crit = Number(BBS.cfg.expiry_critical_days || 30);
  var cls, txt;
  if (d < 0) { cls = 'exp-dead'; txt = 'หมดอายุแล้ว ' + Math.abs(d) + ' วัน'; }
  else if (d <= crit) { cls = 'exp-crit'; txt = 'เหลือ ' + d + ' วัน'; }
  else if (d <= warn) { cls = 'exp-warn'; txt = 'เหลือ ' + d + ' วัน'; }
  else { cls = 'exp-good'; txt = 'เหลือ ' + d + ' วัน'; }
  var pct = Math.max(4, Math.min(100, Math.round((d / 365) * 100)));
  return '<div class="exp-wrap ' + cls + '">'
    + '<div class="exp-bar"><span style="width:' + (d < 0 ? 100 : pct) + '%"></span></div>'
    + '<div class="exp-txt">' + BBS.dateTH(expDate) + ' · ' + txt + '</div></div>';
};

BBS.qrDataUrl = function (text, size) {
  try {
    var q = qrcode(0, 'M');
    q.addData(String(text));
    q.make();
    return q.createDataURL(size || 6, 2);
  } catch (e) { return ''; }
};

/* ---------- แบบพิมพ์ ---------- */
BBS.printHead = function (title, metaPairs) {
  var c = BBS.cfg || {};
  var h = '<div class="pr-head">'
    + (c.logo_data ? '<img class="pr-logo" src="' + c.logo_data + '">' : '')
    + '<div><div class="pr-org">' + BBS.esc(c.org_name || CONFIG.ORG_NAME) + '</div>'
    + '<div class="pr-org2">' + BBS.esc(c.org_line2 || '') + '</div></div></div>'
    + '<div class="pr-title">' + BBS.esc(title) + '</div>';
  if (metaPairs && metaPairs.length) {
    h += '<div class="pr-meta">';
    metaPairs.forEach(function (m) {
      h += '<div><b>' + BBS.esc(m[0]) + ':</b> ' + BBS.esc(m[1] === null || m[1] === undefined ? '-' : m[1]) + '</div>';
    });
    h += '</div>';
  }
  return h;
};

BBS.printNow = function (html, cls) {
  var el = document.getElementById('printArea');
  el.className = cls || '';
  el.innerHTML = '<div class="pr-doc">' + html + '</div>';
  window.print();
};

/* ---------- popup กลาง / ฟอร์ม / ตาราง ---------- */
BBS.ui = {
  _modal: null,
  _onSave: null,

  modal: function () {
    if (!BBS.ui._modal) BBS.ui._modal = new bootstrap.Modal(document.getElementById('bbsModal'));
    return BBS.ui._modal;
  },

  openForm: function (o) {
    var vals = o.values || {};
    var h = '<div class="row g-3">';
    (o.fields || []).forEach(function (f) {
      var col = f.col || 12;
      var id = 'f_' + f.k;
      var v = vals[f.k];
      h += '<div class="col-md-' + col + '">';
      if (f.type === 'checkbox') {
        var on = (v === undefined) ? !!f.def : !!v;
        h += '<div class="form-check mt-4">'
          + '<input class="form-check-input" type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '>'
          + '<label class="form-check-label" for="' + id + '">' + BBS.esc(f.checkLabel || f.label) + '</label></div>';
      } else {
        h += '<label class="form-label' + (f.req ? ' req' : '') + '" for="' + id + '">' + BBS.esc(f.label) + '</label>';
        if (f.type === 'textarea') {
          h += '<textarea class="form-control" id="' + id + '" rows="' + (f.rows || 2) + '">' + BBS.esc(v || '') + '</textarea>';
        } else if (f.type === 'select') {
          h += '<select class="form-select" id="' + id + '">';
          (f.opts || []).forEach(function (op) {
            var sel = String(op.v) === String(v === undefined ? '' : v) ? ' selected' : '';
            h += '<option value="' + BBS.esc(op.v) + '"' + sel + '>' + BBS.esc(op.t) + '</option>';
          });
          h += '</select>';
        } else {
          var extra = '';
          if (f.type === 'number') extra = ' step="' + (f.step || 1) + '" min="' + (f.min === undefined ? 0 : f.min) + '"';
          h += '<input class="form-control" type="' + (f.type || 'text') + '" id="' + id + '"' + extra
            + ' value="' + BBS.esc(v === undefined || v === null ? '' : v) + '"'
            + (f.ph ? ' placeholder="' + BBS.esc(f.ph) + '"' : '') + '>';
        }
        if (f.help) h += '<div class="form-text small">' + BBS.esc(f.help) + '</div>';
      }
      h += '</div>';
    });
    h += '</div>';

    document.getElementById('bbsModalTitle').textContent = o.title || 'แบบฟอร์ม';
    document.getElementById('bbsModalBody').innerHTML = h;
    document.getElementById('bbsModalDialog').className =
      'modal-dialog modal-dialog-centered' + (o.size ? ' modal-' + o.size : '');
    var saveBtn = document.getElementById('bbsModalSave');
    saveBtn.className = 'btn btn-brand';
    saveBtn.textContent = o.saveText || 'บันทึก';
    saveBtn.style.display = '';

    BBS.ui._onSave = function () {
      var data = {};
      (o.fields || []).forEach(function (f) {
        var el = document.getElementById('f_' + f.k);
        if (!el) return;
        if (f.type === 'checkbox') data[f.k] = el.checked;
        else if (f.type === 'number') data[f.k] = el.value === '' ? 0 : Number(el.value);
        else data[f.k] = el.value.trim();
      });
      var missing = (o.fields || []).filter(function (f) {
        return f.req && f.type !== 'checkbox' && !String(data[f.k] === 0 ? '0' : (data[f.k] || '')).trim();
      });
      if (missing.length) {
        BBS.toast('กรุณากรอก: ' + missing.map(function (f) { return f.label; }).join(', '), 'warn');
        return;
      }
      saveBtn.disabled = true;
      Promise.resolve(o.onSave(data)).then(function () { saveBtn.disabled = false; })
        .catch(function (e) { saveBtn.disabled = false; BBS.err(e); });
    };

    BBS.ui.modal().show();
    BBS.ui.enhance(document.getElementById('bbsModalBody'));
    setTimeout(function () {
      var first = document.querySelector('#bbsModalBody input, #bbsModalBody textarea');
      if (first) first.focus();
    }, 350);
  },

  openHtml: function (o) {
    document.getElementById('bbsModalTitle').textContent = o.title || '';
    document.getElementById('bbsModalBody').innerHTML = o.html || '';
    document.getElementById('bbsModalDialog').className =
      'modal-dialog modal-dialog-centered' + (o.size ? ' modal-' + o.size : '');
    var saveBtn = document.getElementById('bbsModalSave');
    if (o.onSave) {
      saveBtn.style.display = '';
      saveBtn.className = 'btn btn-brand';
      saveBtn.textContent = o.saveText || 'บันทึก';
      BBS.ui._onSave = o.onSave;
    } else {
      saveBtn.style.display = 'none';
      BBS.ui._onSave = null;
    }
    BBS.ui.modal().show();
    BBS.ui.enhance(document.getElementById('bbsModalBody'));
  },

  close: function () { BBS.ui.modal().hide(); },

  confirm: function (o) {
    return new Promise(function (resolve) {
      document.getElementById('bbsModalTitle').textContent = o.title || 'ยืนยันการทำงาน';
      document.getElementById('bbsModalBody').innerHTML = '<div class="py-1">' + BBS.esc(o.message || '') + '</div>';
      document.getElementById('bbsModalDialog').className = 'modal-dialog modal-dialog-centered';
      var saveBtn = document.getElementById('bbsModalSave');
      saveBtn.style.display = '';
      saveBtn.className = 'btn ' + (o.danger ? 'btn-danger' : 'btn-brand');
      saveBtn.textContent = o.okText || 'ยืนยัน';
      BBS.ui._onSave = function () { BBS.ui.close(); resolve(true); };
      var el = document.getElementById('bbsModal');
      var onHide = function () { el.removeEventListener('hidden.bs.modal', onHide); resolve(false); };
      el.addEventListener('hidden.bs.modal', onHide);
      BBS.ui.modal().show();
    });
  },

  table: function (cols, rows, emptyHtml) {
    if (!rows || !rows.length) return emptyHtml || BBS.emptyBox('ยังไม่มีข้อมูล');
    var h = '<div class="table-scroll"><table class="table-bb"><thead><tr>';
    cols.forEach(function (c) {
      h += '<th' + (c.cls ? ' class="' + c.cls + '"' : '') + (c.w ? ' style="width:' + c.w + '"' : '') + '>'
        + BBS.esc(c.label) + '</th>';
    });
    h += '</tr></thead><tbody>';
    rows.forEach(function (r, i) {
      h += '<tr>';
      cols.forEach(function (c) {
        var v = c.fmt ? c.fmt(r, i) : BBS.esc(r[c.k]);
        h += '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + (v === undefined || v === null ? '' : v) + '</td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  },

  bindSearch: function (inputId, listFn) {
    var el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('input', function () { listFn(el.value.trim().toLowerCase()); });
  },

  /* ---------- dropdown ค้นหาได้ ----------
     อัปเกรด <select> เดิมในตำแหน่งเดิม โดยซ่อน select ไว้เป็นค่าอ้างอิง
     โค้ดหน้าอื่นยังอ่าน .value ได้เหมือนเดิม ไม่ต้องแก้อะไร
     กดแล้วเห็นรายการทั้งหมดทันทีก่อนพิมพ์ค้นหา */
  searchable: function (sel) {
    if (!sel || sel.dataset.bbsSearchable === '1') return;
    if (sel.options.length < 8) return;          // รายการสั้นใช้ select ปกติดีกว่า
    sel.dataset.bbsSearchable = '1';
    sel.style.display = 'none';

    var box = document.createElement('div');
    box.className = 'ss-box';
    var input = document.createElement('input');
    input.className = 'form-control ss-input';
    input.setAttribute('autocomplete', 'off');
    input.placeholder = 'พิมพ์เพื่อค้นหา หรือกดเพื่อดูทั้งหมด';
    var list = document.createElement('div');
    list.className = 'ss-list d-none';
    box.appendChild(input);
    box.appendChild(list);
    sel.parentNode.insertBefore(box, sel.nextSibling);

    var opts = function () {
      return Array.prototype.map.call(sel.options, function (o) { return { v: o.value, t: o.textContent }; });
    };
    var sync = function () {
      var cur = opts().filter(function (o) { return o.v === sel.value; })[0];
      input.value = cur ? cur.t : '';
    };
    var draw = function (q) {
      var items = opts().filter(function (o) {
        return !q || o.t.toLowerCase().indexOf(q) > -1;
      });
      list.innerHTML = items.length
        ? items.map(function (o) {
          return '<div class="ss-item' + (o.v === sel.value ? ' sel' : '') + '" data-v="' + BBS.esc(o.v) + '">'
            + BBS.esc(o.t) + '</div>';
        }).join('')
        : '<div class="ss-item t-mute">ไม่พบรายการที่ค้นหา</div>';
      list.classList.remove('d-none');
    };

    input.addEventListener('focus', function () { input.select(); draw(''); });
    input.addEventListener('input', function () { draw(input.value.trim().toLowerCase()); });
    list.addEventListener('mousedown', function (e) {
      var it = e.target.closest('.ss-item[data-v]');
      if (!it) return;
      e.preventDefault();
      sel.value = it.getAttribute('data-v');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
      list.classList.add('d-none');
    });
    input.addEventListener('blur', function () {
      setTimeout(function () { list.classList.add('d-none'); sync(); }, 150);
    });
    sel.addEventListener('bbs:sync', sync);
    sync();
  },

  enhance: function (root) {
    if (!root) return;
    root.querySelectorAll('select:not([data-bbs-plain])').forEach(function (s) { BBS.ui.searchable(s); });
  },

  watch: function (root) {
    if (!root || !window.MutationObserver) return;
    new MutationObserver(function () { BBS.ui.enhance(root); }).observe(root, { childList: true, subtree: true });
  }
};
