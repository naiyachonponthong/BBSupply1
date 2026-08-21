/* =====================================================================
   BBSupply — เบิกจ่ายพัสดุ (FEFO) / ตรวจนับ + ใบเบิกและสลิป
   ===================================================================== */
/* ---------- จัดสรรล็อตแบบ FEFO ฝั่งหน้าจอ (ใช้แสดงตัวอย่างก่อนบันทึก) ---------- */
function fefoPreview(lots, itemId, qty) {
  var avail = lots.filter(function (l) {
    return l.itemId === itemId && l.qtyRemain > 0 && !(l.days !== null && l.days < 0);
  }).sort(function (a, b) {
    var ax = a.expDate || '9999-12-31', bx = b.expDate || '9999-12-31';
    if (ax !== bx) return ax.localeCompare(bx);
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
  var plan = [], need = Number(qty || 0);
  for (var i = 0; i < avail.length && need > 0; i++) {
    var take = Math.min(avail[i].qtyRemain, need);
    plan.push({ lot: avail[i], qty: take });
    need = Math.round((need - take) * 100) / 100;
  }
  return { plan: plan, shortage: need };
}

function issueLineBox(ctx) {
  var byCode = {};
  ctx.items.forEach(function (i) { byCode[String(i.code).toUpperCase()] = i; });
  var seq = 0;

  function label(i) { return i.code + ' | ' + i.name; }

  function rowHtml() {
    var n = seq++;
    return '<tr data-i="' + n + '">'
      + '<td><input class="form-control it" list="issueDL" placeholder="พิมพ์รหัสหรือชื่อพัสดุ"></td>'
      + '<td class="onhand t-mute">-</td>'
      + '<td><input type="number" class="form-control qty" min="0" step="1" style="width:88px"></td>'
      + '<td><select class="form-select lotsel" style="min-width:180px"><option value="">อัตโนมัติ (FEFO)</option></select>'
      + '<div class="plan t-mute" style="font-size:.76rem;margin-top:3px"></div></td>'
      + '<td class="t-right"><button type="button" class="del"><i class="bi bi-x-lg"></i></button></td></tr>';
  }

  var api = {
    html: function () {
      var dl = '<datalist id="issueDL">';
      ctx.items.forEach(function (i) { dl += '<option value="' + BBS.esc(label(i)) + '"></option>'; });
      dl += '</datalist>';
      return dl
        + '<div class="table-scroll"><table class="line-table"><thead><tr>'
        + '<th style="min-width:220px">พัสดุ</th><th style="width:110px">คงเหลือ</th>'
        + '<th style="width:96px">จำนวนเบิก</th><th style="min-width:210px">ล็อตที่ตัดจ่าย</th>'
        + '<th style="width:40px"></th></tr></thead><tbody id="lnBody"></tbody></table></div>'
        + '<div class="line-foot">'
        + '<button type="button" class="btn btn-light btn-sm" id="lnAdd"><i class="bi bi-plus-lg"></i> เพิ่มรายการ</button>'
        + '<div class="line-total" id="lnTotal"></div></div>';
    },

    itemOf: function (tr) {
      var v = String(tr.querySelector('.it').value || '');
      return byCode[v.split('|')[0].trim().toUpperCase()] || null;
    },

    refresh: function (tr) {
      var it = api.itemOf(tr);
      var onhand = tr.querySelector('.onhand');
      var sel = tr.querySelector('.lotsel');
      var plan = tr.querySelector('.plan');
      if (!it) {
        onhand.textContent = '-';
        sel.innerHTML = '<option value="">อัตโนมัติ (FEFO)</option>';
        plan.innerHTML = '';
        return;
      }
      onhand.innerHTML = '<strong>' + BBS.num(it.qtyOnHand, 2) + '</strong> ' + BBS.esc(it.unit);

      if (sel.getAttribute('data-item') !== it.id) {
        var opts = '<option value="">อัตโนมัติ (FEFO)</option>';
        ctx.lots.filter(function (l) { return l.itemId === it.id; })
          .sort(function (a, b) { return String(a.expDate || '9999').localeCompare(String(b.expDate || '9999')); })
          .forEach(function (l) {
            var exp = l.expDate ? BBS.dateTH(l.expDate) : 'ไม่ระบุวันหมดอายุ';
            var tag = (l.days !== null && l.days < 0) ? ' [หมดอายุแล้ว]' : '';
            opts += '<option value="' + l.id + '">ล็อต ' + BBS.esc(l.lotNo || '-') + ' · ' + exp
              + ' · เหลือ ' + BBS.num(l.qtyRemain, 2) + tag + '</option>';
          });
        sel.innerHTML = opts;
        sel.setAttribute('data-item', it.id);
      }

      var qty = Number(tr.querySelector('.qty').value || 0);
      if (!qty) { plan.innerHTML = ''; return; }

      if (sel.value) {
        var lot = ctx.lots.filter(function (l) { return l.id === sel.value; })[0];
        if (!lot) { plan.innerHTML = ''; return; }
        var warn = '';
        var first = fefoPreview(ctx.lots, it.id, 1).plan[0];
        if (first && first.lot.id !== lot.id) {
          warn = '<div style="color:var(--warn)">ควรใช้ล็อต ' + BBS.esc(first.lot.lotNo || '-')
            + ' (' + BBS.dateTH(first.lot.expDate) + ') ก่อน</div>';
        }
        if (lot.days !== null && lot.days < 0) {
          warn += '<div style="color:var(--danger)">ล็อตนี้หมดอายุแล้ว</div>';
        }
        plan.innerHTML = (qty > lot.qtyRemain
          ? '<span style="color:var(--danger)">ล็อตนี้เหลือ ' + BBS.num(lot.qtyRemain, 2) + ' ไม่พอเบิก</span>'
          : 'ตัดจากล็อตนี้ ' + BBS.num(qty, 2) + ' ' + BBS.esc(it.unit)) + warn;
        return;
      }

      var res = fefoPreview(ctx.lots, it.id, qty);
      if (res.shortage > 0) {
        plan.innerHTML = '<span style="color:var(--danger)">ของไม่พอ ขาดอีก ' + BBS.num(res.shortage, 2) + ' ' + BBS.esc(it.unit) + '</span>';
        return;
      }
      plan.innerHTML = res.plan.map(function (x) {
        var d = x.lot.days;
        var color = (d !== null && d <= Number(BBS.cfg.expiry_critical_days || 30)) ? 'var(--danger)' : 'inherit';
        return '<span style="color:' + color + '">ล็อต ' + BBS.esc(x.lot.lotNo || '-')
          + ' (EXP ' + (x.lot.expDate ? BBS.dateTH(x.lot.expDate) : '-') + ') → ' + BBS.num(x.qty, 2) + '</span>';
      }).join('<br>');
    },

    bind: function () {
      var body = document.getElementById('lnBody');
      document.getElementById('lnAdd').addEventListener('click', function () {
        body.insertAdjacentHTML('beforeend', rowHtml());
        api.total();
      });
      body.addEventListener('click', function (e) {
        var b = e.target.closest('.del');
        if (!b) return;
        b.closest('tr').remove();
        api.total();
      });
      var handler = function (e) {
        var tr = e.target.closest('tr');
        if (!tr) return;
        api.refresh(tr);
        api.total();
      };
      body.addEventListener('input', handler);
      body.addEventListener('change', handler);
      body.insertAdjacentHTML('beforeend', rowHtml());
      body.insertAdjacentHTML('beforeend', rowHtml());
      api.total();
    },

    total: function () {
      var qty = 0;
      var trs = document.querySelectorAll('#lnBody tr');
      for (var i = 0; i < trs.length; i++) qty += Number(trs[i].querySelector('.qty').value || 0);
      document.getElementById('lnTotal').innerHTML = 'รวม <b>' + BBS.num(qty, 2) + '</b> หน่วย';
    },

    read: function () {
      var out = [], bad = null;
      var trs = document.querySelectorAll('#lnBody tr');
      for (var i = 0; i < trs.length; i++) {
        var tr = trs[i];
        var raw = String(tr.querySelector('.it').value || '').trim();
        var q = Number(tr.querySelector('.qty').value || 0);
        if (!raw && !q) continue;
        var it = api.itemOf(tr);
        if (!it) { bad = 'ไม่พบพัสดุ "' + raw + '" ในระบบ'; break; }
        if (q <= 0) { bad = 'กรุณากรอกจำนวนเบิกของ ' + it.name; break; }
        out.push({ itemId: it.id, qty: q, lotId: tr.querySelector('.lotsel').value || '' });
      }
      if (bad) throw new Error(bad);
      if (!out.length) throw new Error('กรุณาเพิ่มรายการพัสดุอย่างน้อย 1 รายการ');
      return out;
    }
  };
  return api;
}

/* ===================== เบิกจ่ายพัสดุ ===================== */
BBS.pages.issues = {
  rows: [], ctx: null,

  render: function (host) {
    var self = this;
    return Promise.all([BBS.api('issue.list'), BBS.api('issue.ctx')]).then(function (r) {
      self.rows = r[0] || [];
      self.ctx = r[1] || { items: [], lots: [], requesters: [] };

      host.innerHTML = BBS.head('เบิกจ่ายพัสดุ', 'ระบบตัดจ่ายจากล็อตที่หมดอายุก่อนโดยอัตโนมัติ',
        (BBS.can('report') ? '<button class="btn btn-outline-brand" id="btnIssueReport"><i class="bi bi-printer"></i> พิมพ์รายงานการเบิกจ่าย</button>' : '')
        + '<button class="btn btn-brand" id="btnAdd"><i class="bi bi-box-arrow-up"></i> สร้างใบเบิก</button>')
        + '<div class="card-bb">'
        + '<div class="toolbar"><div class="search"><i class="bi bi-search"></i>'
        + '<input class="form-control" id="q" placeholder="ค้นหาเลขที่ใบเบิก ผู้เบิก หน่วยงาน"></div>'
        + '<div class="t-mute" id="cnt"></div></div>'
        + '<div class="card-bb-body p0" id="listBox"></div></div>';

      document.getElementById('btnAdd').addEventListener('click', function () { self.form(); });
      var reportBtn = document.getElementById('btnIssueReport');
      if (reportBtn) reportBtn.addEventListener('click', function () { self.printReport(); });
      document.getElementById('listBox').addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        self.view(b.getAttribute('data-id'));
      });
      BBS.ui.bindSearch('q', function (q) { self.draw(q); });
      self.draw('');
    });
  },

  draw: function (q) {
    var self = this;
    var list = !q ? self.rows : self.rows.filter(function (r) {
      return [r.no, r.requesterName, r.dept, r.purpose].join(' ').toLowerCase().indexOf(q) > -1;
    });
    var cols = [
      { label: 'เลขที่', w: '132px', fmt: function (r) { return '<strong>' + BBS.esc(r.no) + '</strong><div class="t-mute">' + BBS.dateTH(r.date) + '</div>'; } },
      {
        label: 'ผู้เบิก', fmt: function (r) {
          return '<strong>' + BBS.esc(r.requesterName) + '</strong>'
            + '<div class="t-mute">' + BBS.esc(r.dept || '') + (r.purpose ? ' · ' + BBS.esc(r.purpose) : '') + '</div>';
        }
      },
      { label: 'รายการ', w: '80px', cls: 't-center', fmt: function (r) { return BBS.num(r.lineCount); } },
      { label: 'จำนวนรวม', w: '100px', cls: 't-right', fmt: function (r) { return BBS.num(r.totalQty, 2); } },
      {
        label: 'ช่องทาง', w: '92px', cls: 't-center', fmt: function (r) {
          return r.channel === 'qr'
            ? '<span class="pill pill-gold">สแกน QR</span>'
            : '<span class="pill pill-line">หน้าเว็บ</span>';
        }
      },
      {
        label: 'สถานะ', w: '110px', fmt: function (r) {
          if (r.status === 'returned') return '<span class="pill pill-soft">คืนครบแล้ว</span>';
          return docStatusPill(r.status);
        }
      },
      {
        label: '', w: '60px', cls: 't-right', fmt: function (r) {
          return '<button class="btn-mini" data-act="view" data-id="' + r.id + '"><i class="bi bi-eye"></i></button>';
        }
      }
    ];
    if (BBS.user.seePrice) {
      cols.splice(4, 0, { label: 'มูลค่า', w: '110px', cls: 't-right', fmt: function (r) { return BBS.money(r.totalValue); } });
    }
    document.getElementById('listBox').innerHTML = BBS.ui.table(cols, list,
      BBS.emptyBox(q ? 'ไม่พบใบเบิกที่ค้นหา' : 'ยังไม่มีการเบิกพัสดุ',
        q ? '' : 'กดสร้างใบเบิกเพื่อจ่ายพัสดุออกจากคลัง', 'bi-box-arrow-up'));
    document.getElementById('cnt').textContent = list.length + ' ใบ';
  },

  printReport: function () {
    var btn = document.getElementById('btnIssueReport');
    if (btn) btn.disabled = true;
    BBS.api('report.issue', { from: '', to: '', dept: '', requesterId: '', categoryId: '' })
      .then(function (d) {
        if (!d || !d.rows || !d.rows.length) {
          BBS.toast('ยังไม่มีข้อมูลการเบิกจ่ายให้พิมพ์', 'warn');
          return;
        }
        printReport(REPORTS.issue(d), 'ทั้งหมด');
      })
      .catch(BBS.err)
      .then(function () { if (btn) btn.disabled = false; });
  },

  form: function () {
    var self = this;
    var lb = issueLineBox(self.ctx);
    var reqOpt = '';
    self.ctx.requesters.forEach(function (r) {
      reqOpt += '<option value="' + r.id + '" data-dept="' + BBS.esc(r.dept) + '">'
        + BBS.esc(r.code + ' · ' + r.name) + '</option>';
    });

    var html = '<div class="row g-3 mb-3">'
      + '<div class="col-md-3"><label class="form-label req">วันที่เบิก</label>'
      + '<input type="date" class="form-control" id="d_date" value="' + BBS.today() + '"></div>'
      + '<div class="col-md-4"><label class="form-label req">ผู้เบิก</label>'
      + '<select class="form-select" id="d_req"><option value="">— เลือกผู้เบิก —</option>' + reqOpt + '</select></div>'
      + '<div class="col-md-5"><label class="form-label">หน่วยงาน</label>'
      + '<input class="form-control" id="d_dept" disabled></div>'
      + '</div>'
      + lb.html()
      + '<div class="mt-3"><label class="form-label">วัตถุประสงค์การเบิก</label>'
      + '<input class="form-control" id="d_purpose" placeholder="เช่น ใช้ในหน่วยรับบริจาคเลือดประจำวัน"></div>';

    BBS.ui.openHtml({
      title: 'สร้างใบเบิกพัสดุ',
      size: 'xl',
      html: html,
      saveText: 'บันทึกการเบิก',
      onSave: function () {
        var lines;
        try { lines = lb.read(); } catch (e) { BBS.toast(e.message, 'warn'); return; }
        var req = document.getElementById('d_req').value;
        if (!req) { BBS.toast('กรุณาเลือกผู้เบิก', 'warn'); return; }
        BBS.apiMsg('issue.create', {
          date: document.getElementById('d_date').value,
          requesterId: req,
          purpose: document.getElementById('d_purpose').value.trim(),
          channel: 'web',
          lines: lines
        }).then(function (r) {
          BBS.ui.close();
          BBS.toast(r.message, 'ok');
          var id = r.data.id;
          setTimeout(function () { BBS.pages.issues.view(id); }, 400);
          BBS.route();
        }).catch(BBS.err);
      }
    });

    lb.bind();
    document.getElementById('d_req').addEventListener('change', function () {
      var opt = this.options[this.selectedIndex];
      document.getElementById('d_dept').value = opt.getAttribute('data-dept') || '';
    });
  },

  view: function (id) {
    var self = this;
    BBS.api('issue.get', { id: id }).then(function (doc) {
      var cols = [
        { label: 'พัสดุ', fmt: function (l) { return '<strong>' + BBS.esc(l.code) + '</strong> ' + BBS.esc(l.name); } },
        { label: 'ล็อต', w: '110px', fmt: function (l) { return BBS.esc(l.lotNo || '-'); } },
        { label: 'วันหมดอายุ', w: '190px', fmt: function (l) { return l.expDate ? BBS.expBar(l.expDate) : '<span class="t-mute">-</span>'; } },
        { label: 'จ่าย', w: '96px', cls: 't-right', fmt: function (l) { return '<strong>' + BBS.num(l.qty, 2) + '</strong> ' + BBS.esc(l.unit); } },
        {
          label: 'คืนแล้ว', w: '88px', cls: 't-right', fmt: function (l) {
            return l.returnedQty ? '<span class="pill pill-soft">' + BBS.num(l.returnedQty, 2) + '</span>' : '<span class="t-mute">-</span>';
          }
        }
      ];
      if (BBS.user.seePrice) {
        cols.push({ label: 'มูลค่า', w: '104px', cls: 't-right', fmt: function (l) { return BBS.money(l.amount); } });
      }

      var canReturn = doc.status !== 'void' && doc.lines.some(function (l) { return l.qty > l.returnedQty; });
      var h = '<div class="doc-view">'
        + (doc.status === 'void' ? '<div class="mb-2"><span class="void-mark">ยกเลิกแล้ว</span> <span class="t-mute">' + BBS.esc(doc.voidReason || '') + '</span></div>' : '')
        + '<div class="row"><div class="col-md-6">'
        + '<div class="kv"><span class="k">เลขที่</span><span class="v">' + BBS.esc(doc.no) + '</span></div>'
        + '<div class="kv"><span class="k">วันที่เบิก</span><span class="v">' + BBS.dateTH(doc.date) + '</span></div>'
        + '<div class="kv"><span class="k">ผู้จ่าย</span><span class="v">' + BBS.esc(doc.issuedName || doc.issuedBy || '-') + '</span></div>'
        + '</div><div class="col-md-6">'
        + '<div class="kv"><span class="k">ผู้เบิก</span><span class="v">' + BBS.esc(doc.requesterName) + '</span></div>'
        + '<div class="kv"><span class="k">หน่วยงาน</span><span class="v">' + BBS.esc(doc.dept || '-') + '</span></div>'
        + '<div class="kv"><span class="k">วัตถุประสงค์</span><span class="v">' + BBS.esc(doc.purpose || '-') + '</span></div>'
        + '</div></div>'
        + '<div class="mt-3">' + BBS.ui.table(cols, doc.lines) + '</div>'
        + '<div class="btn-row mt-3">'
        + '<button class="btn btn-light btn-sm" id="btnPrintIs"><i class="bi bi-printer"></i> พิมพ์ใบเบิก</button>'
        + '<button class="btn btn-light btn-sm" id="btnPrintSlip"><i class="bi bi-receipt"></i> พิมพ์สลิป 80 มม.</button>'
        + (canReturn ? '<button class="btn btn-light btn-sm" id="btnReturn"><i class="bi bi-arrow-counterclockwise"></i> รับคืนพัสดุ</button>' : '')
        + (doc.status !== 'void' && BBS.isAdmin() ? '<button class="btn btn-light btn-sm text-danger" id="btnVoidIs"><i class="bi bi-x-octagon"></i> ยกเลิกเอกสาร</button>' : '')
        + '</div></div>';

      BBS.ui.openHtml({ title: 'ใบเบิก ' + doc.no, size: 'xl', html: h });

      document.getElementById('btnPrintIs').addEventListener('click', function () { printIssue(doc); });
      document.getElementById('btnPrintSlip').addEventListener('click', function () { printIssueSlip(doc); });

      var br = document.getElementById('btnReturn');
      if (br) br.addEventListener('click', function () { self.returnForm(doc); });

      var bv = document.getElementById('btnVoidIs');
      if (bv) bv.addEventListener('click', function () {
        BBS.ui.openForm({
          title: 'ยกเลิกใบเบิก ' + doc.no,
          fields: [{ k: 'reason', label: 'เหตุผลในการยกเลิก', type: 'textarea', rows: 2, req: true }],
          values: {}, saveText: 'ยืนยันการยกเลิก',
          onSave: function (d) {
            return BBS.apiMsg('issue.void', { id: doc.id, reason: d.reason }).then(function (r) {
              BBS.ui.close(); BBS.toast(r.message, 'ok'); BBS.route();
            });
          }
        });
      });
    }).catch(BBS.err);
  },

  returnForm: function (doc) {
    var open = doc.lines.filter(function (l) { return l.qty > l.returnedQty; });
    var h = '<div class="table-scroll"><table class="line-table"><thead><tr>'
      + '<th>พัสดุ</th><th style="width:110px">ล็อต</th>'
      + '<th style="width:100px" class="t-right">คืนได้</th><th style="width:110px">จำนวนคืน</th>'
      + '</tr></thead><tbody>';
    open.forEach(function (l) {
      var can = l.qty - l.returnedQty;
      h += '<tr><td>' + BBS.esc(l.name) + '<div class="t-mute">' + BBS.esc(l.code) + '</div></td>'
        + '<td>' + BBS.esc(l.lotNo || '-') + '</td>'
        + '<td class="t-right">' + BBS.num(can, 2) + ' ' + BBS.esc(l.unit) + '</td>'
        + '<td><input type="number" class="form-control rq" data-line="' + l.id + '" min="0" max="' + can + '" step="1" style="width:96px"></td>'
        + '</tr>';
    });
    h += '</tbody></table></div>'
      + '<div class="mt-3"><label class="form-label">หมายเหตุการคืน</label><input class="form-control" id="r_note"></div>';

    BBS.ui.openHtml({
      title: 'รับคืนพัสดุ · ใบเบิก ' + doc.no,
      size: 'lg',
      html: h,
      saveText: 'บันทึกการคืน',
      onSave: function () {
        var lines = [];
        var els = document.querySelectorAll('.rq');
        for (var i = 0; i < els.length; i++) {
          var q = Number(els[i].value || 0);
          if (q > 0) lines.push({ lineId: els[i].getAttribute('data-line'), qty: q });
        }
        if (!lines.length) { BBS.toast('กรุณากรอกจำนวนที่คืนอย่างน้อย 1 รายการ', 'warn'); return; }
        BBS.apiMsg('issue.return', {
          id: doc.id, lines: lines,
          note: document.getElementById('r_note').value.trim()
        }).then(function (r) {
          BBS.ui.close(); BBS.toast(r.message, 'ok'); BBS.route();
        }).catch(BBS.err);
      }
    });
  }
};

/* ===================== ตรวจนับ และปรับปรุงยอด ===================== */
BBS.pages.counts = {
  rows: [],

  render: function (host) {
    var self = this;
    return BBS.api('count.list').then(function (rows) {
      self.rows = rows || [];
      host.innerHTML = BBS.head('ตรวจนับ และปรับปรุงยอด', 'นับของจริงรายล็อต แล้วให้ระบบปรับยอดตามผลต่าง',
        '<button class="btn btn-brand" id="btnAdd"><i class="bi bi-clipboard-check"></i> เริ่มตรวจนับ</button>')
        + '<div class="card-bb"><div class="card-bb-body p0" id="listBox"></div></div>';

      var cols = [
        { label: 'เลขที่', w: '140px', fmt: function (r) { return '<strong>' + BBS.esc(r.no) + '</strong><div class="t-mute">' + BBS.dateTH(r.date) + '</div>'; } },
        { label: 'หมายเหตุ', fmt: function (r) { return BBS.esc(r.note || '-'); } },
        { label: 'ล็อตที่นับ', w: '110px', cls: 't-right', fmt: function (r) { return BBS.num(r.lineCount); } },
        {
          label: 'พบผลต่าง', w: '110px', cls: 't-right', fmt: function (r) {
            return r.diffCount
              ? '<span class="pill pill-warn">' + BBS.num(r.diffCount) + ' รายการ</span>'
              : '<span class="pill pill-ok">ตรงทั้งหมด</span>';
          }
        },
        { label: 'ผู้ตรวจนับ', w: '150px', fmt: function (r) { return BBS.esc(r.byName || r.byUser || '-'); } },
        {
          label: '', w: '60px', cls: 't-right', fmt: function (r) {
            return '<button class="btn-mini" data-act="view" data-id="' + r.id + '"><i class="bi bi-eye"></i></button>';
          }
        }
      ];
      document.getElementById('listBox').innerHTML = BBS.ui.table(cols, self.rows,
        BBS.emptyBox('ยังไม่มีการตรวจนับ', 'กดเริ่มตรวจนับเพื่อเทียบยอดในระบบกับของจริงบนชั้น', 'bi-clipboard-check'));

      document.getElementById('btnAdd').addEventListener('click', function () { self.form(); });
      document.getElementById('listBox').addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (b) self.view(b.getAttribute('data-id'));
      });
    });
  },

  form: function () {
    BBS.api('count.sheet').then(function (rows) {
      if (!rows.length) { BBS.toast('ยังไม่มีล็อตที่มีของคงเหลือให้ตรวจนับ', 'warn'); return; }
      var h = '<div class="row g-3 mb-3">'
        + '<div class="col-md-3"><label class="form-label">วันที่ตรวจนับ</label>'
        + '<input type="date" class="form-control" id="c_date" value="' + BBS.today() + '"></div>'
        + '<div class="col-md-9"><label class="form-label">หมายเหตุ</label>'
        + '<input class="form-control" id="c_note" placeholder="เช่น ตรวจนับประจำเดือน"></div></div>'
        + '<div class="doc-note">กรอกเฉพาะล็อตที่นับจริง ล็อตที่เว้นว่างไว้ระบบจะไม่แตะยอด</div>'
        + '<div class="table-scroll" style="max-height:52vh;overflow:auto"><table class="line-table"><thead><tr>'
        + '<th>พัสดุ</th><th style="width:110px">ล็อต</th><th style="width:130px">วันหมดอายุ</th>'
        + '<th style="width:96px" class="t-right">ยอดระบบ</th><th style="width:110px">นับได้จริง</th>'
        + '<th style="width:96px" class="t-right">ผลต่าง</th></tr></thead><tbody id="cntBody">';
      rows.forEach(function (r) {
        h += '<tr data-sys="' + r.systemQty + '">'
          + '<td>' + BBS.esc(r.name) + '<div class="t-mute">' + BBS.esc(r.code) + '</div></td>'
          + '<td>' + BBS.esc(r.lotNo || '-') + '</td>'
          + '<td>' + (r.expDate ? BBS.dateTH(r.expDate) : '-') + '</td>'
          + '<td class="t-right"><strong>' + BBS.num(r.systemQty, 2) + '</strong> <span class="t-mute">' + BBS.esc(r.unit) + '</span></td>'
          + '<td><input type="number" class="form-control cq" data-lot="' + r.lotId + '" min="0" step="1" style="width:96px"></td>'
          + '<td class="t-right diff t-mute">-</td></tr>';
      });
      h += '</tbody></table></div>';

      BBS.ui.openHtml({
        title: 'ใบตรวจนับพัสดุ',
        size: 'xl',
        html: h,
        saveText: 'บันทึกและปรับยอด',
        onSave: function () {
          var lines = [];
          var els = document.querySelectorAll('.cq');
          for (var i = 0; i < els.length; i++) {
            if (String(els[i].value).trim() === '') continue;
            lines.push({ lotId: els[i].getAttribute('data-lot'), counted: Number(els[i].value) });
          }
          if (!lines.length) { BBS.toast('กรุณากรอกจำนวนที่นับได้อย่างน้อย 1 ล็อต', 'warn'); return; }
          BBS.ui.confirm({
            title: 'ยืนยันการปรับยอด',
            message: 'ระบบจะปรับยอดคงเหลือตามผลต่างที่นับได้ทันที และบันทึกไว้ในบัญชีเดินสะพัด ต้องการดำเนินการหรือไม่',
            okText: 'ยืนยันปรับยอด'
          }).then(function (yes) {
            if (!yes) return;
            BBS.apiMsg('count.create', {
              date: document.getElementById('c_date').value,
              note: document.getElementById('c_note').value.trim(),
              lines: lines
            }).then(function (r) {
              BBS.ui.close(); BBS.toast(r.message, 'ok'); BBS.route();
            }).catch(BBS.err);
          });
        }
      });

      document.getElementById('cntBody').addEventListener('input', function (e) {
        if (!e.target.classList.contains('cq')) return;
        var tr = e.target.closest('tr');
        var sys = Number(tr.getAttribute('data-sys') || 0);
        var cell = tr.querySelector('.diff');
        if (String(e.target.value).trim() === '') { cell.innerHTML = '-'; cell.className = 't-right diff t-mute'; return; }
        var diff = Math.round((Number(e.target.value) - sys) * 100) / 100;
        cell.className = 't-right diff';
        cell.innerHTML = diff === 0
          ? '<span class="pill pill-ok">ตรง</span>'
          : '<span class="pill ' + (diff > 0 ? 'pill-soft' : 'pill-danger') + '">' + (diff > 0 ? '+' : '') + BBS.num(diff, 2) + '</span>';
      });
    }).catch(BBS.err);
  },

  view: function (id) {
    BBS.api('count.get', { id: id }).then(function (doc) {
      var cols = [
        { label: 'พัสดุ', fmt: function (l) { return '<strong>' + BBS.esc(l.code) + '</strong> ' + BBS.esc(l.name); } },
        { label: 'ล็อต', w: '110px', fmt: function (l) { return BBS.esc(l.lotNo || '-'); } },
        { label: 'ยอดระบบ', w: '100px', cls: 't-right', fmt: function (l) { return BBS.num(l.systemQty, 2); } },
        { label: 'นับได้จริง', w: '100px', cls: 't-right', fmt: function (l) { return BBS.num(l.counted, 2); } },
        {
          label: 'ผลต่าง', w: '100px', cls: 't-right', fmt: function (l) {
            if (!l.diff) return '<span class="pill pill-ok">ตรง</span>';
            return '<span class="pill ' + (l.diff > 0 ? 'pill-soft' : 'pill-danger') + '">'
              + (l.diff > 0 ? '+' : '') + BBS.num(l.diff, 2) + '</span>';
          }
        }
      ];
      var h = '<div class="doc-view">'
        + '<div class="row"><div class="col-md-6">'
        + '<div class="kv"><span class="k">เลขที่</span><span class="v">' + BBS.esc(doc.no) + '</span></div>'
        + '<div class="kv"><span class="k">วันที่</span><span class="v">' + BBS.dateTH(doc.date) + '</span></div>'
        + '</div><div class="col-md-6">'
        + '<div class="kv"><span class="k">ผู้ตรวจนับ</span><span class="v">' + BBS.esc(doc.byName || doc.byUser || '-') + '</span></div>'
        + '<div class="kv"><span class="k">พบผลต่าง</span><span class="v">' + BBS.num(doc.diffCount) + ' รายการ</span></div>'
        + '</div></div>'
        + (doc.note ? '<div class="doc-note mt-2">' + BBS.esc(doc.note) + '</div>' : '')
        + '<div class="mt-3">' + BBS.ui.table(cols, doc.lines || []) + '</div>'
        + '<div class="btn-row mt-3"><button class="btn btn-light btn-sm" id="btnPrintCt"><i class="bi bi-printer"></i> พิมพ์ใบตรวจนับ</button></div>'
        + '</div>';
      BBS.ui.openHtml({ title: 'ใบตรวจนับ ' + doc.no, size: 'xl', html: h });
      document.getElementById('btnPrintCt').addEventListener('click', function () { printCount(doc); });
    }).catch(BBS.err);
  }
};

/* ===================== แบบพิมพ์ ===================== */
function printIssue(doc) {
  var h = BBS.printHead('ใบเบิกพัสดุ', [
    ['เลขที่', doc.no],
    ['วันที่', BBS.dateTH(doc.date)],
    ['ผู้เบิก', doc.requesterName],
    ['หน่วยงาน', doc.dept || '-'],
    ['วัตถุประสงค์', doc.purpose || '-']
  ]);
  h += '<table class="pr-table"><thead><tr>'
    + '<th style="width:6%">ที่</th><th style="width:13%">รหัส</th><th>รายการพัสดุ</th>'
    + '<th style="width:14%">เลขล็อต</th><th style="width:14%">วันหมดอายุ</th>'
    + '<th style="width:10%">จำนวน</th><th style="width:9%">หน่วย</th>'
    + '</tr></thead><tbody>';
  doc.lines.forEach(function (l, i) {
    h += '<tr><td class="pr-center">' + (i + 1) + '</td><td>' + BBS.esc(l.code) + '</td><td>' + BBS.esc(l.name) + '</td>'
      + '<td class="pr-center">' + BBS.esc(l.lotNo || '-') + '</td>'
      + '<td class="pr-center">' + (l.expDate ? BBS.dateTH(l.expDate) : '-') + '</td>'
      + '<td class="pr-right">' + BBS.num(l.qty, 2) + '</td>'
      + '<td class="pr-center">' + BBS.esc(l.unit) + '</td></tr>';
  });
  h += '<tr><td class="pr-right" colspan="5"><b>รวม</b></td>'
    + '<td class="pr-right"><b>' + BBS.num(doc.totalQty, 2) + '</b></td><td></td></tr>'
    + '</tbody></table>';
  h += '<div class="pr-sign">'
    + '<div><div class="pr-line"></div>(............................................)<div>ผู้เบิก</div></div>'
    + '<div><div class="pr-line"></div>(............................................)<div>ผู้จ่ายพัสดุ</div></div>'
    + '</div>';
  h += '<div class="pr-foot">พิมพ์เมื่อ ' + BBS.dateTimeTH(new Date().toISOString()) + '</div>';
  BBS.printNow(h, 'a5');
}

function printIssueSlip(doc) {
  var h = BBS.printHead('ใบเบิกพัสดุ', [
    ['เลขที่', doc.no],
    ['วันที่', BBS.dateTH(doc.date)],
    ['ผู้เบิก', doc.requesterName],
    ['หน่วยงาน', doc.dept || '-']
  ]);
  h += '<table class="pr-table"><tbody>';
  doc.lines.forEach(function (l) {
    h += '<tr><td>' + BBS.esc(l.name)
      + '<div style="font-size:8pt">ล็อต ' + BBS.esc(l.lotNo || '-')
      + ' · EXP ' + (l.expDate ? BBS.dateTH(l.expDate) : '-') + '</div></td>'
      + '<td class="pr-right" style="width:26%">' + BBS.num(l.qty, 2) + ' ' + BBS.esc(l.unit) + '</td></tr>';
  });
  h += '<tr><td><b>รวม</b></td><td class="pr-right"><b>' + BBS.num(doc.totalQty, 2) + '</b></td></tr>'
    + '</tbody></table>'
    + '<div style="text-align:center;margin-top:8px;font-size:8pt">ผู้จ่าย ' + BBS.esc(doc.issuedName || '-') + '</div>'
    + '<div style="text-align:center;margin-top:14px;font-size:8pt">...................................</div>'
    + '<div style="text-align:center;font-size:8pt">ลายมือชื่อผู้เบิก</div>';
  BBS.printNow(h, 'slip');
}

function printCount(doc) {
  var h = BBS.printHead('ใบตรวจนับพัสดุ', [
    ['เลขที่', doc.no],
    ['วันที่', BBS.dateTH(doc.date)],
    ['ผู้ตรวจนับ', doc.byName || doc.byUser || '-']
  ]);
  h += '<table class="pr-table"><thead><tr>'
    + '<th style="width:6%">ที่</th><th style="width:13%">รหัส</th><th>รายการพัสดุ</th>'
    + '<th style="width:13%">เลขล็อต</th><th style="width:12%">ยอดระบบ</th>'
    + '<th style="width:12%">นับได้จริง</th><th style="width:11%">ผลต่าง</th>'
    + '</tr></thead><tbody>';
  (doc.lines || []).forEach(function (l, i) {
    h += '<tr><td class="pr-center">' + (i + 1) + '</td><td>' + BBS.esc(l.code) + '</td><td>' + BBS.esc(l.name) + '</td>'
      + '<td class="pr-center">' + BBS.esc(l.lotNo || '-') + '</td>'
      + '<td class="pr-right">' + BBS.num(l.systemQty, 2) + '</td>'
      + '<td class="pr-right">' + BBS.num(l.counted, 2) + '</td>'
      + '<td class="pr-right">' + (l.diff > 0 ? '+' : '') + BBS.num(l.diff, 2) + '</td></tr>';
  });
  h += '</tbody></table>';
  h += '<div class="pr-sign">'
    + '<div><div class="pr-line"></div>(............................................)<div>ผู้ตรวจนับ</div></div>'
    + '<div><div class="pr-line"></div>(............................................)<div>หัวหน้าพัสดุ</div></div>'
    + '</div>';
  BBS.printNow(h);
}
