/* =====================================================================
   BBSupply — ใบสั่งซื้อ / รับเข้าพัสดุ / ล็อตและวันหมดอายุ + แบบพิมพ์
   ===================================================================== */
/* ---------- ตัวแก้ไขรายการในเอกสาร (ใช้ทั้งใบสั่งซื้อและใบรับเข้า) ---------- */
function lineBox(cfg) {
  var mode = cfg.mode;                 // 'po' | 'rc'
  var items = cfg.items || [];
  var showPrice = !!cfg.showPrice;
  var byCode = {};
  items.forEach(function (i) { byCode[String(i.code).toUpperCase()] = i; });
  var seq = 0;

  function label(i) { return i.code + ' | ' + i.name; }

  function rowHtml(d) {
    d = d || {};
    var n = seq++;
    var it = d.itemId ? items.filter(function (x) { return x.id === d.itemId; })[0] : null;
    var h = '<tr data-i="' + n + '">'
      + '<td><input class="form-control it" list="itemDL" value="' + BBS.esc(it ? label(it) : '') + '" placeholder="พิมพ์รหัสหรือชื่อพัสดุ"></td>'
      + '<td class="unit t-mute">' + BBS.esc(it ? it.unit : '-') + '</td>'
      + '<td><input type="number" class="form-control qty" min="0" step="1" style="width:88px" value="' + (d.qty || '') + '"></td>';
    if (mode === 'rc') {
      h += '<td><input class="form-control lot" style="width:120px" value="' + BBS.esc(d.lotNo || '') + '" placeholder="เลขล็อต"></td>'
        + '<td><input type="date" class="form-control exp" style="width:150px" value="' + BBS.esc(d.expDate || '') + '"></td>';
    }
    if (showPrice) {
      h += '<td><input type="number" class="form-control price" step="0.01" min="0" style="width:100px" value="' + (d.unitPrice || '') + '"></td>'
        + '<td class="amt t-right t-mute">-</td>';
    }
    h += '<td class="t-right"><button type="button" class="del" title="ลบรายการ"><i class="bi bi-x-lg"></i></button></td></tr>';
    return h;
  }

  var api = {
    html: function () {
      var head = '<th style="min-width:220px">พัสดุ</th><th style="width:70px">หน่วย</th><th style="width:96px">จำนวน</th>';
      if (mode === 'rc') head += '<th style="width:126px">เลขล็อต</th><th style="width:158px">วันหมดอายุ</th>';
      if (showPrice) head += '<th style="width:108px">ราคา/หน่วย</th><th style="width:96px" class="t-right">จำนวนเงิน</th>';
      head += '<th style="width:40px"></th>';

      var dl = '<datalist id="itemDL">';
      items.forEach(function (i) { dl += '<option value="' + BBS.esc(label(i)) + '"></option>'; });
      dl += '</datalist>';

      return dl
        + '<div class="table-scroll"><table class="line-table"><thead><tr>' + head + '</tr></thead>'
        + '<tbody id="lnBody"></tbody></table></div>'
        + '<div class="line-foot">'
        + '<button type="button" class="btn btn-light btn-sm" id="lnAdd"><i class="bi bi-plus-lg"></i> เพิ่มรายการ</button>'
        + '<div class="line-total" id="lnTotal"></div>'
        + '</div>';
    },

    bind: function (initial) {
      var body = document.getElementById('lnBody');
      document.getElementById('lnAdd').addEventListener('click', function () {
        body.insertAdjacentHTML('beforeend', rowHtml());
        api.recalc();
      });
      body.addEventListener('click', function (e) {
        var b = e.target.closest('.del');
        if (!b) return;
        b.closest('tr').remove();
        api.recalc();
      });
      body.addEventListener('input', function (e) {
        var tr = e.target.closest('tr');
        if (!tr) return;
        if (e.target.classList.contains('it')) {
          var it = api.itemOf(tr);
          tr.querySelector('.unit').textContent = it ? it.unit : '-';
          if (it && showPrice) {
            var pe = tr.querySelector('.price');
            if (pe && !pe.value && it.unitPriceLast) pe.value = it.unitPriceLast;
          }
        }
        api.recalc();
      });
      (initial && initial.length ? initial : [{}, {}]).forEach(function (d) {
        body.insertAdjacentHTML('beforeend', rowHtml(d));
      });
      api.recalc();
    },

    itemOf: function (tr) {
      var v = String(tr.querySelector('.it').value || '');
      var code = v.split('|')[0].trim().toUpperCase();
      return byCode[code] || null;
    },

    fill: function (list) {
      var body = document.getElementById('lnBody');
      body.innerHTML = '';
      (list || []).forEach(function (d) { body.insertAdjacentHTML('beforeend', rowHtml(d)); });
      if (!list || !list.length) body.insertAdjacentHTML('beforeend', rowHtml());
      api.recalc();
    },

    recalc: function () {
      var qty = 0, amt = 0;
      var trs = document.querySelectorAll('#lnBody tr');
      for (var i = 0; i < trs.length; i++) {
        var q = Number(trs[i].querySelector('.qty').value || 0);
        qty += q;
        if (showPrice) {
          var p = Number(trs[i].querySelector('.price').value || 0);
          var a = q * p;
          amt += a;
          trs[i].querySelector('.amt').textContent = a ? BBS.money(a) : '-';
        }
      }
      var t = 'รวม <b>' + BBS.num(qty, 2) + '</b> หน่วย';
      if (showPrice) t += ' · เป็นเงิน <b>' + BBS.money(amt) + '</b> บาท';
      document.getElementById('lnTotal').innerHTML = t;
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
        if (!it) { bad = 'ไม่พบพัสดุ "' + raw + '" ในระบบ กรุณาเลือกจากรายการที่ระบบแนะนำ'; break; }
        if (q <= 0) { bad = 'กรุณากรอกจำนวนของ ' + it.name; break; }
        var o = { itemId: it.id, qty: q, qtyOrdered: q };
        if (showPrice) o.unitPrice = Number(tr.querySelector('.price').value || 0);
        if (mode === 'rc') {
          o.lotNo = String(tr.querySelector('.lot').value || '').trim();
          o.expDate = String(tr.querySelector('.exp').value || '').trim();
          if (it.trackLot !== false && !o.lotNo) { bad = 'กรุณากรอกเลขล็อตของ ' + it.name; break; }
          if (it.requireExp !== false && !o.expDate) { bad = 'กรุณากรอกวันหมดอายุของ ' + it.name; break; }
        }
        out.push(o);
      }
      if (bad) throw new Error(bad);
      if (!out.length) throw new Error('กรุณาเพิ่มรายการพัสดุอย่างน้อย 1 รายการ');
      return out;
    }
  };
  return api;
}

function docStatusPill(s) {
  var map = {
    open: ['pill-line', 'ยังไม่รับเข้า'],
    partial: ['pill-warn', 'รับบางส่วน'],
    received: ['pill-ok', 'รับครบแล้ว'],
    closed: ['pill-mute', 'ปิดใบสั่งซื้อ'],
    posted: ['pill-ok', 'สมบูรณ์'],
    void: ['pill-danger', 'ยกเลิก']
  };
  var m = map[s] || ['pill-mute', s || '-'];
  return '<span class="pill ' + m[0] + '">' + m[1] + '</span>';
}

/* ===================== ใบสั่งซื้อ ===================== */
BBS.pages.po = {
  rows: [], sups: [], items: [],

  render: function (host) {
    var self = this;
    return Promise.all([
      BBS.api('po.list'), BBS.api('supplier.list'), BBS.api('item.list')
    ]).then(function (r) {
      self.rows = r[0] || [];
      self.sups = (r[1] || []).filter(function (s) { return s.active !== false; });
      self.items = (r[2] || []).filter(function (i) { return i.active !== false; });

      host.innerHTML = BBS.head('ใบสั่งซื้อ', 'บันทึกจำนวนที่สั่งซื้อไว้เพื่อใช้เทียบตอนรับเข้า',
        '<button class="btn btn-brand" id="btnAdd"><i class="bi bi-plus-lg"></i> สร้างใบสั่งซื้อ</button>')
        + '<div class="card-bb">'
        + '<div class="toolbar"><div class="search"><i class="bi bi-search"></i>'
        + '<input class="form-control" id="q" placeholder="ค้นหาเลขที่ใบสั่งซื้อ หรือบริษัท"></div>'
        + '<div class="t-mute" id="cnt"></div></div>'
        + '<div class="card-bb-body p0" id="listBox"></div></div>';

      document.getElementById('btnAdd').addEventListener('click', function () { self.form(null); });
      document.getElementById('listBox').addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var id = b.getAttribute('data-id');
        var act = b.getAttribute('data-act');
        if (act === 'view') self.view(id);
        if (act === 'edit') self.edit(id);
        if (act === 'close') {
          BBS.apiMsg('po.close', { id: id }).then(function (r) { BBS.toast(r.message, 'ok'); BBS.route(); }).catch(BBS.err);
        }
        if (act === 'del') {
          BBS.ui.confirm({ title: 'ยืนยันการลบ', message: 'ต้องการลบใบสั่งซื้อนี้หรือไม่', okText: 'ลบ', danger: true })
            .then(function (yes) {
              if (!yes) return;
              BBS.apiMsg('po.delete', { id: id }).then(function (r) { BBS.toast(r.message, 'ok'); BBS.route(); }).catch(BBS.err);
            });
        }
      });
      BBS.ui.bindSearch('q', function (q) { self.draw(q); });
      self.draw('');
    });
  },

  draw: function (q) {
    var self = this;
    var list = !q ? self.rows : self.rows.filter(function (r) {
      return [r.no, r.supplierName, r.refNo].join(' ').toLowerCase().indexOf(q) > -1;
    });
    var cols = [
      { label: 'เลขที่', w: '132px', fmt: function (r) { return '<strong>' + BBS.esc(r.no) + '</strong><div class="t-mute">' + BBS.dateTH(r.date) + '</div>'; } },
      { label: 'บริษัทผู้ขาย', fmt: function (r) { return BBS.esc(r.supplierName || '-') + (r.refNo ? '<div class="t-mute">อ้างอิง ' + BBS.esc(r.refNo) + '</div>' : ''); } },
      { label: 'รายการ', w: '84px', cls: 't-center', fmt: function (r) { return BBS.num(r.lineCount); } },
      {
        label: 'สั่ง / รับแล้ว', w: '150px', cls: 't-right', fmt: function (r) {
          return BBS.num(r.qtyReceived, 2) + ' / ' + BBS.num(r.qtyOrdered, 2)
            + '<div class="t-mute">' + r.progress + '%</div>';
        }
      },
      { label: 'สถานะ', w: '116px', fmt: function (r) { return docStatusPill(r.status); } },
      {
        label: '', w: '132px', cls: 't-right', fmt: function (r) {
          return '<div class="btn-row">'
            + '<button class="btn-mini" data-act="view" data-id="' + r.id + '" title="ดู"><i class="bi bi-eye"></i></button>'
            + (r.qtyReceived > 0 ? '' : '<button class="btn-mini" data-act="edit" data-id="' + r.id + '" title="แก้ไข"><i class="bi bi-pencil"></i></button>')
            + '<button class="btn-mini" data-act="close" data-id="' + r.id + '" title="ปิด/เปิดใบสั่งซื้อ"><i class="bi bi-archive"></i></button>'
            + (r.qtyReceived > 0 ? '' : '<button class="btn-mini danger" data-act="del" data-id="' + r.id + '" title="ลบ"><i class="bi bi-trash"></i></button>')
            + '</div>';
        }
      }
    ];
    if (BBS.user.seePrice) {
      cols.splice(4, 0, { label: 'มูลค่า', w: '116px', cls: 't-right', fmt: function (r) { return BBS.money(r.value); } });
    }
    document.getElementById('listBox').innerHTML = BBS.ui.table(cols, list,
      BBS.emptyBox(q ? 'ไม่พบใบสั่งซื้อที่ค้นหา' : 'ยังไม่มีใบสั่งซื้อ',
        q ? '' : 'สร้างใบสั่งซื้อเพื่อบันทึกจำนวนที่สั่งไว้ แล้วดึงมาใช้ตอนรับเข้าได้ทันที', 'bi-file-earmark-text'));
    document.getElementById('cnt').textContent = list.length + ' ใบ';
  },

  edit: function (id) {
    var self = this;
    BBS.api('po.get', { id: id }).then(function (po) {
      self.form(po);
    }).catch(BBS.err);
  },

  form: function (po) {
    var self = this;
    var lb = lineBox({ mode: 'po', items: self.items, showPrice: BBS.user.seePrice });
    var supOpt = '';
    self.sups.forEach(function (s) {
      supOpt += '<option value="' + s.id + '"' + (po && po.supplierId === s.id ? ' selected' : '') + '>' + BBS.esc(s.name) + '</option>';
    });

    var html = '<div class="row g-3 mb-3">'
      + '<div class="col-md-3"><label class="form-label req">วันที่</label>'
      + '<input type="date" class="form-control" id="d_date" value="' + BBS.esc(po ? po.date : BBS.today()) + '"></div>'
      + '<div class="col-md-5"><label class="form-label req">บริษัทผู้ขาย</label>'
      + '<select class="form-select" id="d_sup"><option value="">— เลือกบริษัท —</option>' + supOpt + '</select></div>'
      + '<div class="col-md-4"><label class="form-label">เลขที่อ้างอิง / ใบเสนอราคา</label>'
      + '<input class="form-control" id="d_ref" value="' + BBS.esc(po ? (po.refNo || '') : '') + '"></div>'
      + '</div>'
      + lb.html()
      + '<div class="mt-3"><label class="form-label">หมายเหตุ</label>'
      + '<input class="form-control" id="d_note" value="' + BBS.esc(po ? (po.note || '') : '') + '"></div>';

    BBS.ui.openHtml({
      title: po ? 'แก้ไขใบสั่งซื้อ ' + po.no : 'สร้างใบสั่งซื้อ',
      size: 'xl',
      html: html,
      saveText: 'บันทึกใบสั่งซื้อ',
      onSave: function () {
        var lines;
        try { lines = lb.read(); } catch (e) { BBS.toast(e.message, 'warn'); return; }
        var sup = document.getElementById('d_sup').value;
        if (!sup) { BBS.toast('กรุณาเลือกบริษัทผู้ขาย', 'warn'); return; }
        var data = {
          id: po ? po.id : null,
          date: document.getElementById('d_date').value,
          supplierId: sup,
          refNo: document.getElementById('d_ref').value.trim(),
          note: document.getElementById('d_note').value.trim(),
          lines: lines
        };
        BBS.apiMsg('po.save', data).then(function (r) {
          BBS.ui.close(); BBS.toast(r.message, 'ok'); BBS.route();
        }).catch(BBS.err);
      }
    });

    lb.bind(po ? po.lines.map(function (l) {
      return { itemId: l.itemId, qty: l.qtyOrdered, unitPrice: l.unitPrice };
    }) : null);
  },

  view: function (id) {
    BBS.api('po.get', { id: id }).then(function (po) {
      var cols = [
        { label: 'พัสดุ', fmt: function (l) { return '<strong>' + BBS.esc(l.code) + '</strong> ' + BBS.esc(l.name); } },
        { label: 'สั่ง', w: '90px', cls: 't-right', fmt: function (l) { return BBS.num(l.qtyOrdered, 2) + ' ' + BBS.esc(l.unit); } },
        { label: 'รับแล้ว', w: '90px', cls: 't-right', fmt: function (l) { return BBS.num(l.qtyReceived, 2); } },
        { label: 'ค้างรับ', w: '90px', cls: 't-right', fmt: function (l) { return '<strong>' + BBS.num(l.qtyOrdered - l.qtyReceived, 2) + '</strong>'; } }
      ];
      if (BBS.user.seePrice) {
        cols.push({ label: 'ราคา/หน่วย', w: '100px', cls: 't-right', fmt: function (l) { return BBS.money(l.unitPrice); } });
      }
      var h = '<div class="doc-view">'
        + '<div class="row"><div class="col-md-6">'
        + '<div class="kv"><span class="k">เลขที่</span><span class="v">' + BBS.esc(po.no) + '</span></div>'
        + '<div class="kv"><span class="k">วันที่</span><span class="v">' + BBS.dateTH(po.date) + '</span></div>'
        + '</div><div class="col-md-6">'
        + '<div class="kv"><span class="k">บริษัท</span><span class="v">' + BBS.esc(po.supplierName) + '</span></div>'
        + '<div class="kv"><span class="k">อ้างอิง</span><span class="v">' + BBS.esc(po.refNo || '-') + '</span></div>'
        + '</div></div>'
        + (po.note ? '<div class="doc-note mt-2">' + BBS.esc(po.note) + '</div>' : '')
        + '<div class="mt-3">' + BBS.ui.table(cols, po.lines) + '</div></div>';
      BBS.ui.openHtml({ title: 'ใบสั่งซื้อ ' + po.no, size: 'lg', html: h });
    }).catch(BBS.err);
  }
};

/* ===================== รับเข้าพัสดุ ===================== */
BBS.pages.receipts = {
  rows: [], sups: [], items: [], pos: [],

  render: function (host) {
    var self = this;
    return Promise.all([
      BBS.api('receipt.list'), BBS.api('supplier.list'),
      BBS.api('item.list'), BBS.api('po.list')
    ]).then(function (r) {
      self.rows = r[0] || [];
      self.sups = (r[1] || []).filter(function (s) { return s.active !== false; });
      self.items = (r[2] || []).filter(function (i) { return i.active !== false; });
      self.pos = (r[3] || []).filter(function (p) { return p.status !== 'closed' && p.qtyReceived < p.qtyOrdered; });

      host.innerHTML = BBS.head('รับเข้าพัสดุ', 'บันทึกของที่รับเข้าคลัง พร้อมเลขล็อตและวันหมดอายุ',
        '<button class="btn btn-brand" id="btnAdd"><i class="bi bi-box-arrow-in-down"></i> รับเข้าพัสดุ</button>')
        + '<div class="card-bb">'
        + '<div class="toolbar"><div class="search"><i class="bi bi-search"></i>'
        + '<input class="form-control" id="q" placeholder="ค้นหาเลขที่ใบรับเข้า บริษัท เลขที่ใบส่งของ"></div>'
        + '<div class="t-mute" id="cnt"></div></div>'
        + '<div class="card-bb-body p0" id="listBox"></div></div>';

      document.getElementById('btnAdd').addEventListener('click', function () { self.form(); });
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
      return [r.no, r.supplierName, r.invoiceNo, r.poNo].join(' ').toLowerCase().indexOf(q) > -1;
    });
    var cols = [
      { label: 'เลขที่', w: '132px', fmt: function (r) { return '<strong>' + BBS.esc(r.no) + '</strong><div class="t-mute">' + BBS.dateTH(r.date) + '</div>'; } },
      {
        label: 'บริษัทผู้ขาย', fmt: function (r) {
          return BBS.esc(r.supplierName || '-')
            + (r.invoiceNo ? '<div class="t-mute">ใบส่งของ ' + BBS.esc(r.invoiceNo) + '</div>' : '')
            + (r.poNo ? '<div class="t-mute">อ้างใบสั่งซื้อ ' + BBS.esc(r.poNo) + '</div>' : '');
        }
      },
      { label: 'รายการ', w: '84px', cls: 't-center', fmt: function (r) { return BBS.num(r.lineCount); } },
      { label: 'จำนวนรวม', w: '104px', cls: 't-right', fmt: function (r) { return BBS.num(r.totalQty, 2); } },
      { label: 'สถานะ', w: '110px', fmt: function (r) { return docStatusPill(r.status); } },
      {
        label: '', w: '60px', cls: 't-right', fmt: function (r) {
          return '<button class="btn-mini" data-act="view" data-id="' + r.id + '"><i class="bi bi-eye"></i></button>';
        }
      }
    ];
    if (BBS.user.seePrice) {
      cols.splice(4, 0, { label: 'มูลค่า', w: '116px', cls: 't-right', fmt: function (r) { return BBS.money(r.totalValue); } });
    }
    document.getElementById('listBox').innerHTML = BBS.ui.table(cols, list,
      BBS.emptyBox(q ? 'ไม่พบใบรับเข้าที่ค้นหา' : 'ยังไม่มีการรับเข้าพัสดุ',
        q ? '' : 'กดปุ่มรับเข้าพัสดุเพื่อบันทึกของล็อตแรกเข้าคลัง', 'bi-box-arrow-in-down'));
    document.getElementById('cnt').textContent = list.length + ' ใบ';
  },

  form: function () {
    var self = this;
    var lb = lineBox({ mode: 'rc', items: self.items, showPrice: BBS.user.seePrice });
    var supOpt = '';
    self.sups.forEach(function (s) { supOpt += '<option value="' + BBS.esc(s.name) + '"></option>'; });
    var poOpt = '';
    self.pos.forEach(function (p) {
      poOpt += '<option value="' + p.id + '" data-sup="' + p.supplierId + '">' + BBS.esc(p.no + ' · ' + p.supplierName) + '</option>';
    });

    var html = '<div class="row g-3 mb-3">'
      + '<div class="col-md-3"><label class="form-label req">วันที่รับเข้า</label>'
      + '<input type="date" class="form-control" id="d_date" value="' + BBS.today() + '"></div>'
      + '<div class="col-md-4"><label class="form-label">อ้างใบสั่งซื้อ</label>'
      + '<select class="form-select" id="d_po"><option value="">— ไม่อ้างใบสั่งซื้อ —</option>' + poOpt + '</select>'
      + '<div class="form-text small">เลือกแล้วระบบจะดึงรายการที่ยังค้างรับมาให้</div></div>'
      + '<div class="col-md-5"><label class="form-label req">บริษัทผู้ขาย</label>'
      + '<input class="form-control" id="d_sup_name" list="supplierDL" autocomplete="off" placeholder="พิมพ์ชื่อบริษัท หรือเลือกจากรายการเดิม">'
      + '<datalist id="supplierDL">' + supOpt + '</datalist>'
      + '<div class="form-text small">สามารถพิมพ์เพิ่มบริษัทใหม่ได้</div></div>'
      + '</div>'
      + lb.html()
      + '<div class="row g-3 mt-1">'
      + '<div class="col-md-4"><label class="form-label">เลขที่ใบส่งของ / ใบกำกับ</label>'
      + '<input class="form-control" id="d_inv"></div>'
      + '<div class="col-md-8"><label class="form-label">หมายเหตุ</label>'
      + '<input class="form-control" id="d_note"></div></div>';

    BBS.ui.openHtml({
      title: 'รับเข้าพัสดุ',
      size: 'xl',
      html: html,
      saveText: 'บันทึกการรับเข้า',
      onSave: function () {
        var lines;
        try { lines = lb.read(); } catch (e) { BBS.toast(e.message, 'warn'); return; }
        var supplierName = document.getElementById('d_sup_name').value.trim();
        if (!supplierName) { BBS.toast('กรุณากรอกชื่อบริษัทผู้ขาย', 'warn'); return; }
        var supplierKey = supplierName.toLowerCase();
        var supplier = self.sups.filter(function (s) {
          return String(s.name || '').trim().toLowerCase() === supplierKey;
        })[0];
        BBS.apiMsg('receipt.create', {
          date: document.getElementById('d_date').value,
          poId: document.getElementById('d_po').value,
          supplierId: supplier ? supplier.id : '',
          supplierName: supplierName,
          invoiceNo: document.getElementById('d_inv').value.trim(),
          note: document.getElementById('d_note').value.trim(),
          lines: lines
        }).then(function (r) {
          BBS.ui.close();
          BBS.toast(r.message, 'ok');
          var id = r.data.id;
          setTimeout(function () { BBS.pages.receipts.view(id); }, 400);
          BBS.route();
        }).catch(BBS.err);
      }
    });

    lb.bind(null);

    document.getElementById('d_po').addEventListener('change', function () {
      var opt = this.options[this.selectedIndex];
      var poId = this.value;
      if (!poId) return;
      var poSupplier = self.sups.filter(function (s) {
        return s.id === (opt.getAttribute('data-sup') || '');
      })[0];
      document.getElementById('d_sup_name').value = poSupplier ? poSupplier.name : '';
      BBS.api('po.openLines', { id: poId }).then(function (lines) {
        lb.fill((lines || []).map(function (l) {
          return { itemId: l.itemId, qty: l.outstanding, unitPrice: l.unitPrice };
        }));
      }).catch(BBS.err);
    });
  },

  view: function (id) {
    BBS.api('receipt.get', { id: id }).then(function (doc) {
      var cols = [
        { label: 'พัสดุ', fmt: function (l) { return '<strong>' + BBS.esc(l.code) + '</strong> ' + BBS.esc(l.name); } },
        { label: 'ล็อต', w: '110px', fmt: function (l) { return BBS.esc(l.lotNo || '-'); } },
        { label: 'วันหมดอายุ', w: '190px', fmt: function (l) { return l.expDate ? BBS.expBar(l.expDate) : '<span class="t-mute">-</span>'; } },
        { label: 'จำนวน', w: '96px', cls: 't-right', fmt: function (l) { return '<strong>' + BBS.num(l.qty, 2) + '</strong> ' + BBS.esc(l.unit); } }
      ];
      if (BBS.user.seePrice) {
        cols.push({ label: 'ราคา/หน่วย', w: '100px', cls: 't-right', fmt: function (l) { return BBS.money(l.unitPrice); } });
        cols.push({ label: 'จำนวนเงิน', w: '104px', cls: 't-right', fmt: function (l) { return BBS.money(l.amount); } });
      }

      var h = '<div class="doc-view">'
        + (doc.status === 'void' ? '<div class="mb-2"><span class="void-mark">ยกเลิกแล้ว</span> <span class="t-mute">' + BBS.esc(doc.voidReason || '') + '</span></div>' : '')
        + '<div class="row"><div class="col-md-6">'
        + '<div class="kv"><span class="k">เลขที่</span><span class="v">' + BBS.esc(doc.no) + '</span></div>'
        + '<div class="kv"><span class="k">วันที่รับเข้า</span><span class="v">' + BBS.dateTH(doc.date) + '</span></div>'
        + '<div class="kv"><span class="k">ผู้บันทึก</span><span class="v">' + BBS.esc(doc.byName || doc.byUser || '-') + '</span></div>'
        + '</div><div class="col-md-6">'
        + '<div class="kv"><span class="k">บริษัท</span><span class="v">' + BBS.esc(doc.supplierName || '-') + '</span></div>'
        + '<div class="kv"><span class="k">ใบส่งของ</span><span class="v">' + BBS.esc(doc.invoiceNo || '-') + '</span></div>'
        + '<div class="kv"><span class="k">ใบสั่งซื้อ</span><span class="v">' + BBS.esc(doc.poNo || '-') + '</span></div>'
        + '</div></div>'
        + (doc.note ? '<div class="doc-note mt-2">' + BBS.esc(doc.note) + '</div>' : '')
        + '<div class="mt-3">' + BBS.ui.table(cols, doc.lines) + '</div>'
        + '<div class="btn-row mt-3">'
        + '<button class="btn btn-light btn-sm" id="btnPrintRc"><i class="bi bi-printer"></i> พิมพ์ใบรับเข้า</button>'
        + '<button class="btn btn-light btn-sm" id="btnPrintLbl"><i class="bi bi-upc-scan"></i> พิมพ์สติกเกอร์ QR</button>'
        + (doc.status !== 'void' && BBS.isAdmin() ? '<button class="btn btn-light btn-sm text-danger" id="btnVoid"><i class="bi bi-x-octagon"></i> ยกเลิกเอกสาร</button>' : '')
        + '</div></div>';

      BBS.ui.openHtml({ title: 'ใบรับเข้า ' + doc.no, size: 'xl', html: h });

      document.getElementById('btnPrintRc').addEventListener('click', function () { printReceipt(doc); });
      document.getElementById('btnPrintLbl').addEventListener('click', function () {
        var labels = doc.lines.map(function (l) {
          return {
            lotId: l.lotId, name: l.name, code: l.code, unit: l.unit,
            qty: l.qty, receiptDate: doc.date, lotNo: l.lotNo, expDate: l.expDate
          };
        });
        askLabelCount(labels);
      });
      var bv = document.getElementById('btnVoid');
      if (bv) {
        bv.addEventListener('click', function () {
          BBS.ui.openForm({
            title: 'ยกเลิกใบรับเข้า ' + doc.no,
            fields: [{ k: 'reason', label: 'เหตุผลในการยกเลิก', type: 'textarea', rows: 2, req: true }],
            values: {}, saveText: 'ยืนยันการยกเลิก',
            onSave: function (d) {
              return BBS.apiMsg('receipt.void', { id: doc.id, reason: d.reason }).then(function (r) {
                BBS.ui.close(); BBS.toast(r.message, 'ok'); BBS.route();
              });
            }
          });
        });
      }
    }).catch(BBS.err);
  }
};

/* ===================== ล็อตและวันหมดอายุ ===================== */
BBS.pages.lots = {
  rows: [],
  filter: 'remain',

  render: function (host) {
    var self = this;
    return BBS.api('lot.list').then(function (rows) {
      self.rows = rows || [];
      host.innerHTML = BBS.head('ล็อต และวันหมดอายุ', 'ติดตามพัสดุรายล็อต เรียงตามวันหมดอายุที่ใกล้ที่สุด')
        + '<div class="card-bb">'
        + '<div class="toolbar">'
        + '<div class="search"><i class="bi bi-search"></i>'
        + '<input class="form-control" id="q" placeholder="ค้นหาพัสดุ หรือเลขล็อต"></div>'
        + '<select class="form-select" id="fl" style="max-width:210px">'
        + '<option value="remain">เฉพาะที่ยังมีของ</option>'
        + '<option value="soon">ใกล้หมดอายุ</option>'
        + '<option value="expired">หมดอายุแล้ว</option>'
        + '<option value="all">ทั้งหมด</option>'
        + '</select>'
        + '<div class="t-mute" id="cnt"></div></div>'
        + '<div class="card-bb-body p0" id="listBox"></div></div>';

      document.getElementById('fl').value = self.filter;
      document.getElementById('fl').addEventListener('change', function () {
        self.filter = this.value;
        self.draw(document.getElementById('q').value.trim().toLowerCase());
      });
      BBS.ui.bindSearch('q', function (q) { self.draw(q); });

      document.getElementById('listBox').addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var lot = self.rows.filter(function (r) { return r.id === b.getAttribute('data-id'); })[0];
        if (!lot) return;
        if (b.getAttribute('data-act') === 'qr') {
          askLabelCount([{ lotId: lot.id, name: lot.name, code: lot.code, unit: lot.unit,
            qty: lot.qtyRemain, lotNo: lot.lotNo, expDate: lot.expDate }]);
        }
        if (b.getAttribute('data-act') === 'dispose') self.dispose(lot);
      });

      self.draw('');
    });
  },

  draw: function (q) {
    var self = this;
    var warn = Number(BBS.cfg.expiry_warn_days || 90);
    var list = self.rows.filter(function (r) {
      if (self.filter === 'remain') return r.qtyRemain > 0;
      if (self.filter === 'soon') return r.qtyRemain > 0 && r.days !== null && r.days >= 0 && r.days <= warn;
      if (self.filter === 'expired') return r.qtyRemain > 0 && r.days !== null && r.days < 0;
      return true;
    });
    if (q) {
      list = list.filter(function (r) {
        return [r.code, r.name, r.lotNo].join(' ').toLowerCase().indexOf(q) > -1;
      });
    }
    var cols = [
      {
        label: 'พัสดุ', fmt: function (r) {
          return '<strong>' + BBS.esc(r.name) + '</strong>'
            + '<div class="t-mute">' + BBS.esc(r.code) + '</div>';
        }
      },
      { label: 'เลขล็อต', w: '120px', fmt: function (r) { return '<span class="pill pill-line">' + BBS.esc(r.lotNo || '-') + '</span>'; } },
      { label: 'วันหมดอายุ', w: '200px', fmt: function (r) { return BBS.expBar(r.expDate, r.days); } },
      { label: 'รับเข้า', w: '92px', cls: 't-right', fmt: function (r) { return BBS.num(r.qtyIn, 2); } },
      { label: 'จ่ายออก', w: '92px', cls: 't-right', fmt: function (r) { return BBS.num(r.qtyOut, 2); } },
      {
        label: 'คงเหลือ', w: '104px', cls: 't-right', fmt: function (r) {
          return '<strong>' + BBS.num(r.qtyRemain, 2) + '</strong> <span class="t-mute">' + BBS.esc(r.unit) + '</span>';
        }
      },
      {
        label: '', w: '92px', cls: 't-right', fmt: function (r) {
          return '<div class="btn-row">'
            + '<button class="btn-mini" data-act="qr" data-id="' + r.id + '" title="พิมพ์สติกเกอร์ QR"><i class="bi bi-upc-scan"></i></button>'
            + (r.qtyRemain > 0 ? '<button class="btn-mini danger" data-act="dispose" data-id="' + r.id + '" title="ตัดจำหน่าย"><i class="bi bi-trash3"></i></button>' : '')
            + '</div>';
        }
      }
    ];
    document.getElementById('listBox').innerHTML = BBS.ui.table(cols, list,
      BBS.emptyBox('ไม่พบล็อตพัสดุตามเงื่อนไขนี้', 'ล็อตจะถูกสร้างอัตโนมัติเมื่อบันทึกการรับเข้าพัสดุ', 'bi-calendar-x'));
    document.getElementById('cnt').textContent = list.length + ' ล็อต';
  },

  dispose: function (lot) {
    BBS.ui.openForm({
      title: 'ตัดจำหน่ายพัสดุ',
      fields: [
        { k: 'info', label: 'พัสดุ', type: 'text', col: 12 },
        { k: 'qty', label: 'จำนวนที่ตัดจำหน่าย (คงเหลือ ' + BBS.num(lot.qtyRemain, 2) + ' ' + lot.unit + ')', type: 'number', req: true, col: 6 },
        { k: 'reason', label: 'เหตุผล', type: 'textarea', rows: 2, req: true }
      ],
      values: { info: lot.name + ' · ล็อต ' + (lot.lotNo || '-'), qty: lot.qtyRemain },
      saveText: 'ยืนยันการตัดจำหน่าย',
      onSave: function (d) {
        return BBS.apiMsg('lot.dispose', { id: lot.id, qty: d.qty, reason: d.reason }).then(function (r) {
          BBS.ui.close(); BBS.toast(r.message, 'ok'); BBS.route();
        });
      }
    });
  }
};

/* ===================== แบบพิมพ์ ===================== */
function printReceipt(doc) {
  var h = BBS.printHead('ใบรับพัสดุเข้าคลัง', [
    ['เลขที่', doc.no],
    ['วันที่', BBS.dateTH(doc.date)],
    ['บริษัทผู้ขาย', doc.supplierName],
    ['ใบส่งของ', doc.invoiceNo || '-'],
    ['ใบสั่งซื้อ', doc.poNo || '-']
  ]);
  h += '<table class="pr-table"><thead><tr>'
    + '<th style="width:6%">ที่</th><th style="width:12%">รหัส</th><th>รายการพัสดุ</th>'
    + '<th style="width:13%">เลขล็อต</th><th style="width:13%">วันหมดอายุ</th>'
    + '<th style="width:10%">จำนวน</th><th style="width:8%">หน่วย</th>'
    + (BBS.user.seePrice ? '<th style="width:11%">ราคา/หน่วย</th><th style="width:12%">จำนวนเงิน</th>' : '')
    + '</tr></thead><tbody>';
  doc.lines.forEach(function (l, i) {
    h += '<tr><td class="pr-center">' + (i + 1) + '</td><td>' + BBS.esc(l.code) + '</td><td>' + BBS.esc(l.name) + '</td>'
      + '<td class="pr-center">' + BBS.esc(l.lotNo || '-') + '</td>'
      + '<td class="pr-center">' + (l.expDate ? BBS.dateTH(l.expDate) : '-') + '</td>'
      + '<td class="pr-right">' + BBS.num(l.qty, 2) + '</td><td class="pr-center">' + BBS.esc(l.unit) + '</td>'
      + (BBS.user.seePrice ? '<td class="pr-right">' + BBS.money(l.unitPrice) + '</td><td class="pr-right">' + BBS.money(l.amount) + '</td>' : '')
      + '</tr>';
  });
  var span = BBS.user.seePrice ? 5 : 5;
  h += '<tr><td class="pr-right" colspan="' + span + '"><b>รวม</b></td>'
    + '<td class="pr-right"><b>' + BBS.num(doc.totalQty, 2) + '</b></td><td></td>'
    + (BBS.user.seePrice ? '<td></td><td class="pr-right"><b>' + BBS.money(doc.totalValue) + '</b></td>' : '')
    + '</tr>';
  h += '</tbody></table>';
  if (doc.note) h += '<div style="margin-top:8px;font-size:11pt">หมายเหตุ: ' + BBS.esc(doc.note) + '</div>';
  h += '<div class="pr-sign">'
    + '<div><div class="pr-line"></div>(............................................)<div>ผู้รับพัสดุ</div></div>'
    + '<div><div class="pr-line"></div>(............................................)<div>หัวหน้าพัสดุ</div></div>'
    + '</div>';
  h += '<div class="pr-foot">พิมพ์เมื่อ ' + BBS.dateTimeTH(new Date().toISOString()) + ' โดย ' + BBS.esc(BBS.user.name) + '</div>';
  BBS.printNow(h);
}

function askLabelCount(labels) {
  BBS.ui.openForm({
    title: 'พิมพ์สติกเกอร์ QR',
    fields: [
      { k: 'copies', label: 'จำนวนดวงต่อ 1 ล็อต', type: 'number', req: true, col: 6, help: 'สติกเกอร์ขนาด A4 เรียง 4 ดวงต่อแถว' }
    ],
    values: { copies: 4 },
    saveText: 'พิมพ์',
    onSave: function (d) {
      BBS.ui.close();
      setTimeout(function () { printLabels(labels, Number(d.copies) || 1); }, 300);
    }
  });
}

function printLabels(labels, copies) {
  var h = '<div class="lbl-sheet">';
  labels.forEach(function (l) {
    var img = BBS.qrDataUrl('BBS|L|' + l.lotId, 5);
    for (var c = 0; c < copies; c++) {
      h += '<div class="lbl">'
        + (img ? '<img src="' + img + '">' : '')
        + '<div class="l-name">' + BBS.esc(l.name) + '</div>'
        + (l.receiptDate ? '<div class="l-date">รับเข้า ' + BBS.dateTH(l.receiptDate) + '</div>' : '')
        + (l.qty !== undefined && l.qty !== null ? '<div class="l-qty">จำนวน ' + BBS.num(l.qty, 2) + ' ' + BBS.esc(l.unit || '') + '</div>' : '')
        + '<div class="l-lot">' + (l.code ? BBS.esc(l.code) + ' · ' : '') + 'LOT ' + BBS.esc(l.lotNo || '-') + '</div>'
        + '<div class="l-exp">EXP ' + (l.expDate ? BBS.dateTH(l.expDate) : '-') + '</div>'
        + '</div>';
    }
  });
  h += '</div>';
  BBS.printNow(h);
}
