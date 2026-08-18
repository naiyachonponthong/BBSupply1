/* =====================================================================
   BBSupply — รายงานทั้งหมด + ส่งออก CSV + แบบพิมพ์รายงาน
   ===================================================================== */
BBS.pages.reports = {
  tab: 'receive',
  opt: null,
  data: null,

  render: function (host) {
    var self = this;
    return (self.opt ? Promise.resolve(self.opt) : BBS.api('report.options')).then(function (opt) {
      self.opt = opt;
      var tabs = [
        { k: 'receive', t: 'สรุปรับเข้า' },
        { k: 'issue', t: 'สรุปจ่ายออก' },
        { k: 'balance', t: 'คงเหลือและมูลค่า' },
        { k: 'card', t: 'บัญชีพัสดุรายตัว' },
        { k: 'expiry', t: 'ใกล้หมดอายุ' }
      ];
      var h = BBS.head('รายงาน', 'เลือกช่วงเวลาและเงื่อนไข แล้วสั่งพิมพ์หรือส่งออกเป็นไฟล์ได้');
      h += '<div class="tabs-bb">';
      tabs.forEach(function (t) {
        h += '<button class="tab-bb' + (self.tab === t.k ? ' active' : '') + '" data-tab="' + t.k + '">' + BBS.esc(t.t) + '</button>';
      });
      h += '</div>'
        + '<div class="card-bb"><div class="card-bb-body" id="fltBox"></div></div>'
        + '<div id="repBox"></div>';
      host.innerHTML = h;

      host.querySelector('.tabs-bb').addEventListener('click', function (e) {
        var b = e.target.closest('[data-tab]');
        if (!b) return;
        self.tab = b.getAttribute('data-tab');
        self.data = null;
        BBS.route();
      });

      self.drawFilter();
    });
  },

  monthStart: function () {
    var d = new Date();
    var p = function (x) { return ('0' + x).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-01';
  },

  sel: function (id, label, list, valKey, textFn, col, allText) {
    var h = '<div class="col-md-' + (col || 3) + '"><label class="form-label" for="' + id + '">' + BBS.esc(label) + '</label>'
      + '<select class="form-select" id="' + id + '"><option value="">' + BBS.esc(allText || 'ทั้งหมด') + '</option>';
    (list || []).forEach(function (x) {
      h += '<option value="' + BBS.esc(x[valKey]) + '">' + BBS.esc(textFn(x)) + '</option>';
    });
    return h + '</select></div>';
  },

  dateFields: function () {
    return '<div class="col-md-3"><label class="form-label">ตั้งแต่วันที่</label>'
      + '<input type="date" class="form-control" id="f_from" value="' + this.monthStart() + '"></div>'
      + '<div class="col-md-3"><label class="form-label">ถึงวันที่</label>'
      + '<input type="date" class="form-control" id="f_to" value="' + BBS.today() + '"></div>';
  },

  drawFilter: function () {
    var self = this;
    var o = self.opt;
    var h = '<div class="row g-3 align-items-end">';

    if (self.tab === 'receive') {
      h += self.dateFields()
        + self.sel('f_sup', 'บริษัทผู้ขาย', o.suppliers, 'id', function (x) { return x.name; })
        + self.sel('f_cat', 'หมวดพัสดุ', o.categories, 'id', function (x) { return x.name; });
    } else if (self.tab === 'issue') {
      h += self.dateFields()
        + self.sel('f_dept', 'หน่วยงาน', (o.depts || []).map(function (d) { return { d: d }; }), 'd', function (x) { return x.d; })
        + self.sel('f_req', 'ผู้เบิก', o.requesters, 'id', function (x) { return x.code + ' · ' + x.name; })
        + self.sel('f_cat', 'หมวดพัสดุ', o.categories, 'id', function (x) { return x.name; });
    } else if (self.tab === 'balance') {
      h += self.sel('f_cat', 'หมวดพัสดุ', o.categories, 'id', function (x) { return x.name; }, 4)
        + '<div class="col-md-4"><div class="form-check mt-4">'
        + '<input class="form-check-input" type="checkbox" id="f_low">'
        + '<label class="form-check-label" for="f_low">แสดงเฉพาะที่ต่ำกว่าจุดสั่งซื้อ</label></div></div>';
    } else if (self.tab === 'card') {
      h += self.sel('f_item', 'รายการพัสดุ', o.items, 'id', function (x) { return x.code + ' · ' + x.name; }, 6, '— เลือกพัสดุ —')
        + self.dateFields();
    } else if (self.tab === 'expiry') {
      h += '<div class="col-md-3"><label class="form-label">แสดงล็อตที่เหลืออายุไม่เกิน (วัน)</label>'
        + '<input type="number" class="form-control" id="f_days" value="' + (BBS.cfg.expiry_warn_days || 90) + '"></div>'
        + self.sel('f_cat', 'หมวดพัสดุ', o.categories, 'id', function (x) { return x.name; }, 4);
    }

    h += '<div class="col-md-2"><button class="btn btn-brand w-100" id="btnRun">'
      + '<i class="bi bi-search"></i> ดูรายงาน</button></div></div>';

    document.getElementById('fltBox').innerHTML = h;
    document.getElementById('btnRun').addEventListener('click', function () { self.run(); });
    document.getElementById('repBox').innerHTML =
      '<div class="card-bb"><div class="card-bb-body">'
      + BBS.emptyBox('เลือกเงื่อนไขแล้วกดดูรายงาน', '', 'bi-funnel') + '</div></div>';
  },

  val: function (id) {
    var el = document.getElementById(id);
    if (!el) return '';
    return el.type === 'checkbox' ? el.checked : el.value;
  },

  run: function () {
    var self = this;
    var box = document.getElementById('repBox');
    BBS.spinner(box);

    var call, args = {};
    if (self.tab === 'receive') {
      args = { from: self.val('f_from'), to: self.val('f_to'), supplierId: self.val('f_sup'), categoryId: self.val('f_cat') };
      call = 'report.receive';
    } else if (self.tab === 'issue') {
      args = {
        from: self.val('f_from'), to: self.val('f_to'), dept: self.val('f_dept'),
        requesterId: self.val('f_req'), categoryId: self.val('f_cat')
      };
      call = 'report.issue';
    } else if (self.tab === 'balance') {
      args = { categoryId: self.val('f_cat'), lowOnly: self.val('f_low') };
      call = 'report.balance';
    } else if (self.tab === 'card') {
      if (!self.val('f_item')) { BBS.toast('กรุณาเลือกรายการพัสดุ', 'warn'); self.drawFilter(); return; }
      args = { itemId: self.val('f_item'), from: self.val('f_from'), to: self.val('f_to') };
      call = 'report.card';
    } else {
      args = { days: Number(self.val('f_days') || 90), categoryId: self.val('f_cat') };
      call = 'report.expiry';
    }

    self.args = args;
    BBS.api(call, args).then(function (d) {
      self.data = d;
      self.draw(box);
    }).catch(function (e) { BBS.app.pageError(box, e); });
  },

  periodText: function () {
    var a = this.args || {};
    if (!a.from && !a.to) return 'ข้อมูล ณ ' + BBS.dateTH(new Date().toISOString());
    return 'ระหว่างวันที่ ' + BBS.dateTH(a.from) + ' ถึง ' + BBS.dateTH(a.to);
  },

  head: function (title, extraHtml) {
    return '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-file-earmark-bar-graph"></i> ' + BBS.esc(title)
      + '<span class="sub">' + BBS.esc(this.periodText()) + '</span></div>'
      + '<div class="card-bb-body p0" id="repTable"></div>'
      + '<div class="card-bb-body" style="border-top:1px solid var(--line)">'
      + (extraHtml || '')
      + '<div class="btn-row">'
      + '<button class="btn btn-light btn-sm" id="btnCsv"><i class="bi bi-filetype-csv"></i> ส่งออก CSV</button>'
      + '<button class="btn btn-light btn-sm" id="btnPrintRep"><i class="bi bi-printer"></i> พิมพ์รายงาน</button>'
      + '</div></div></div>';
  },

  draw: function (box) {
    var self = this;
    var d = self.data;
    var cfg = REPORTS[self.tab](d, self);

    box.innerHTML = self.head(cfg.title, cfg.summary || '');
    document.getElementById('repTable').innerHTML =
      BBS.ui.table(cfg.cols, cfg.rows, BBS.emptyBox('ไม่พบข้อมูลตามเงื่อนไขที่เลือก'));

    document.getElementById('btnCsv').addEventListener('click', function () {
      exportCsv(cfg.title, cfg.csvHead, cfg.csvRows());
    });
    document.getElementById('btnPrintRep').addEventListener('click', function () {
      printReport(cfg, self.periodText());
    });
  }
};

/* ---------- นิยามของแต่ละรายงาน ---------- */
var REPORTS = {

  receive: function (d) {
    var seePrice = d.seePrice;
    var cols = [
      { label: 'วันที่', w: '116px', fmt: function (r) { return BBS.dateTH(r.date); } },
      { label: 'เลขที่', w: '132px', fmt: function (r) { return BBS.esc(r.no) + (r.status === 'void' ? ' <span class="pill pill-danger">ยกเลิก</span>' : ''); } },
      { label: 'บริษัท', fmt: function (r) { return BBS.esc(r.supplierName); } },
      { label: 'พัสดุ', fmt: function (r) { return '<strong>' + BBS.esc(r.code) + '</strong> ' + BBS.esc(r.name); } },
      { label: 'ล็อต', w: '100px', fmt: function (r) { return BBS.esc(r.lotNo || '-'); } },
      { label: 'หมดอายุ', w: '116px', fmt: function (r) { return r.expDate ? BBS.dateTH(r.expDate) : '-'; } },
      { label: 'จำนวน', w: '104px', cls: 't-right', fmt: function (r) { return BBS.num(r.qty, 2) + ' ' + BBS.esc(r.unit); } }
    ];
    if (seePrice) {
      cols.push({ label: 'ราคา/หน่วย', w: '100px', cls: 't-right', fmt: function (r) { return BBS.money(r.unitPrice); } });
      cols.push({ label: 'จำนวนเงิน', w: '110px', cls: 't-right', fmt: function (r) { return BBS.money(r.amount); } });
    }
    return {
      title: 'รายงานสรุปรายการรับเข้าพัสดุ',
      cols: cols, rows: d.rows,
      summary: statLine([
        ['จำนวนใบรับเข้า', BBS.num(d.docCount) + ' ใบ'],
        ['รายการทั้งหมด', BBS.num(d.rows.length) + ' รายการ'],
        ['จำนวนรวม', BBS.num(d.totalQty, 2) + ' หน่วย']
      ].concat(seePrice ? [['มูลค่ารวม', BBS.money(d.totalValue) + ' บาท']] : [])),
      csvHead: ['วันที่', 'เลขที่', 'บริษัท', 'ใบส่งของ', 'รหัส', 'พัสดุ', 'ล็อต', 'วันหมดอายุ', 'จำนวน', 'หน่วย']
        .concat(seePrice ? ['ราคาต่อหน่วย', 'จำนวนเงิน'] : []),
      csvRows: function () {
        return d.rows.map(function (r) {
          return [r.date, r.no, r.supplierName, r.invoiceNo, r.code, r.name, r.lotNo, r.expDate, r.qty, r.unit]
            .concat(seePrice ? [r.unitPrice, r.amount] : []);
        });
      },
      printCols: ['วันที่:date', 'เลขที่:no', 'บริษัท:supplierName', 'รหัส:code', 'พัสดุ:name', 'ล็อต:lotNo', 'หมดอายุ:expDate', 'จำนวน:qty', 'หน่วย:unit']
        .concat(seePrice ? ['จำนวนเงิน:amount'] : [])
    };
  },

  issue: function (d) {
    var seePrice = d.seePrice;
    var cols = [
      { label: 'วันที่', w: '116px', fmt: function (r) { return BBS.dateTH(r.date); } },
      { label: 'เลขที่', w: '132px', fmt: function (r) { return BBS.esc(r.no); } },
      {
        label: 'ผู้เบิก', fmt: function (r) {
          return BBS.esc(r.requesterName) + '<div class="t-mute">' + BBS.esc(r.dept) + '</div>';
        }
      },
      { label: 'พัสดุ', fmt: function (r) { return '<strong>' + BBS.esc(r.code) + '</strong> ' + BBS.esc(r.name); } },
      { label: 'ล็อต', w: '100px', fmt: function (r) { return BBS.esc(r.lotNo || '-'); } },
      {
        label: 'จ่ายสุทธิ', w: '116px', cls: 't-right', fmt: function (r) {
          return '<strong>' + BBS.num(r.netQty, 2) + '</strong> ' + BBS.esc(r.unit)
            + (r.returnedQty ? '<div class="t-mute">คืน ' + BBS.num(r.returnedQty, 2) + '</div>' : '');
        }
      },
      {
        label: 'ช่องทาง', w: '92px', cls: 't-center', fmt: function (r) {
          return r.channel === 'qr' ? '<span class="pill pill-gold">QR</span>' : '<span class="pill pill-line">เว็บ</span>';
        }
      }
    ];
    if (seePrice) cols.push({ label: 'มูลค่า', w: '110px', cls: 't-right', fmt: function (r) { return BBS.money(r.amount); } });

    var deptHtml = '';
    if (d.byDept && d.byDept.length) {
      deptHtml = '<div class="mb-3"><div class="fw-semibold mb-2">แยกตามหน่วยงาน</div>';
      d.byDept.forEach(function (x) {
        deptHtml += '<div class="kv"><span class="k">' + BBS.esc(x.dept) + '</span>'
          + '<span class="v">' + BBS.num(x.qty, 2) + ' หน่วย</span></div>';
      });
      deptHtml += '</div>';
    }

    return {
      title: 'รายงานสรุปรายการจ่ายออกพัสดุ',
      cols: cols, rows: d.rows,
      summary: statLine([
        ['จำนวนใบเบิก', BBS.num(d.docCount) + ' ใบ'],
        ['รายการทั้งหมด', BBS.num(d.rows.length) + ' รายการ'],
        ['จ่ายสุทธิ', BBS.num(d.totalQty, 2) + ' หน่วย']
      ].concat(seePrice ? [['มูลค่ารวม', BBS.money(d.totalValue) + ' บาท']] : [])) + deptHtml,
      csvHead: ['วันที่', 'เลขที่', 'ผู้เบิก', 'หน่วยงาน', 'รหัส', 'พัสดุ', 'ล็อต', 'วันหมดอายุ', 'จ่าย', 'คืน', 'จ่ายสุทธิ', 'หน่วย', 'ช่องทาง']
        .concat(seePrice ? ['มูลค่า'] : []),
      csvRows: function () {
        return d.rows.map(function (r) {
          return [r.date, r.no, r.requesterName, r.dept, r.code, r.name, r.lotNo, r.expDate,
          r.qty, r.returnedQty, r.netQty, r.unit, r.channel === 'qr' ? 'สแกน QR' : 'หน้าเว็บ']
            .concat(seePrice ? [r.amount] : []);
        });
      },
      printCols: ['วันที่:date', 'เลขที่:no', 'ผู้เบิก:requesterName', 'หน่วยงาน:dept', 'รหัส:code', 'พัสดุ:name', 'ล็อต:lotNo', 'จ่ายสุทธิ:netQty', 'หน่วย:unit']
        .concat(seePrice ? ['มูลค่า:amount'] : [])
    };
  },

  balance: function (d) {
    var seePrice = d.seePrice;
    var cols = [
      { label: 'รหัส', w: '96px', fmt: function (r) { return '<span class="pill pill-line">' + BBS.esc(r.code) + '</span>'; } },
      {
        label: 'พัสดุ', fmt: function (r) {
          return '<strong>' + BBS.esc(r.name) + '</strong>'
            + (r.categoryName ? '<div class="t-mute">' + BBS.esc(r.categoryName) + '</div>' : '');
        }
      },
      { label: 'สั่งซื้อรวม', w: '100px', cls: 't-right', fmt: function (r) { return BBS.num(r.qtyOrdered, 2); } },
      { label: 'รับเข้า', w: '96px', cls: 't-right', fmt: function (r) { return BBS.num(r.qtyIn, 2); } },
      { label: 'เบิก', w: '96px', cls: 't-right', fmt: function (r) { return BBS.num(r.qtyOut, 2); } },
      {
        label: 'คงเหลือ', w: '120px', cls: 't-right', fmt: function (r) {
          return '<strong>' + BBS.num(r.qtyOnHand, 2) + '</strong> ' + BBS.esc(r.unit)
            + (r.low ? ' <span class="pill pill-warn">ต่ำ</span>' : '');
        }
      },
      { label: 'ล็อตที่ควรใช้ก่อน', w: '190px', fmt: function (r) { return r.nextExp ? BBS.expBar(r.nextExp, r.nextExpDays) : '<span class="t-mute">-</span>'; } }
    ];
    if (seePrice) cols.push({ label: 'มูลค่า', w: '120px', cls: 't-right', fmt: function (r) { return BBS.money(r.value); } });

    return {
      title: 'รายงานพัสดุคงเหลือและมูลค่า',
      cols: cols, rows: d.rows,
      summary: statLine([
        ['รายการทั้งหมด', BBS.num(d.rows.length) + ' รายการ'],
        ['ต่ำกว่าจุดสั่งซื้อ', BBS.num(d.lowCount) + ' รายการ']
      ].concat(seePrice ? [['มูลค่าสต๊อกรวม', BBS.money(d.totalValue) + ' บาท']] : [])),
      csvHead: ['รหัส', 'พัสดุ', 'หมวด', 'บริษัท', 'หน่วย', 'สั่งซื้อรวม', 'รับเข้า', 'เบิก', 'ปรับปรุง', 'คงเหลือ', 'จุดสั่งซื้อ', 'ล็อตหมดอายุใกล้สุด']
        .concat(seePrice ? ['ต้นทุนเฉลี่ย', 'มูลค่า'] : []),
      csvRows: function () {
        return d.rows.map(function (r) {
          return [r.code, r.name, r.categoryName, r.supplierName, r.unit, r.qtyOrdered, r.qtyIn, r.qtyOut,
          r.qtyAdj, r.qtyOnHand, r.minStock, r.nextExp]
            .concat(seePrice ? [r.avgCost, r.value] : []);
        });
      },
      printCols: ['รหัส:code', 'พัสดุ:name', 'หน่วย:unit', 'สั่งซื้อ:qtyOrdered', 'รับเข้า:qtyIn', 'เบิก:qtyOut', 'คงเหลือ:qtyOnHand', 'จุดสั่งซื้อ:minStock']
        .concat(seePrice ? ['มูลค่า:value'] : [])
    };
  },

  card: function (d) {
    var typeName = { IN: 'รับเข้า', OUT: 'เบิกจ่าย', RETURN: 'รับคืน', ADJ: 'ปรับปรุง', DISPOSE: 'ตัดจำหน่าย' };
    var cols = [
      { label: 'วันที่', w: '116px', fmt: function (r) { return BBS.dateTH(r.date); } },
      { label: 'ประเภท', w: '110px', fmt: function (r) { return '<span class="pill pill-soft">' + BBS.esc(typeName[r.type] || r.type) + '</span>'; } },
      { label: 'เอกสาร', w: '132px', fmt: function (r) { return BBS.esc(r.refNo || '-'); } },
      { label: 'ล็อต', w: '110px', fmt: function (r) { return BBS.esc(r.lotNo || '-'); } },
      { label: 'รับ', w: '90px', cls: 't-right', fmt: function (r) { return r.inQty ? BBS.num(r.inQty, 2) : '<span class="t-mute">-</span>'; } },
      { label: 'จ่าย', w: '90px', cls: 't-right', fmt: function (r) { return r.outQty ? BBS.num(r.outQty, 2) : '<span class="t-mute">-</span>'; } },
      { label: 'คงเหลือ', w: '104px', cls: 't-right', fmt: function (r) { return '<strong>' + BBS.num(r.balance, 2) + '</strong>'; } },
      { label: 'หมายเหตุ', fmt: function (r) { return '<span class="t-mute">' + BBS.esc(r.note || '') + '</span>'; } }
    ];
    return {
      title: 'บัญชีคุมพัสดุ · ' + d.item.code + ' ' + d.item.name,
      cols: cols, rows: d.rows,
      summary: statLine([
        ['ยอดยกมา', BBS.num(d.opening, 2) + ' ' + d.item.unit],
        ['ความเคลื่อนไหว', BBS.num(d.rows.length) + ' รายการ'],
        ['ยอดคงเหลือ', BBS.num(d.closing, 2) + ' ' + d.item.unit]
      ].concat(d.seePrice ? [['มูลค่าคงเหลือ', BBS.money(d.value) + ' บาท']] : [])),
      csvHead: ['วันที่', 'ประเภท', 'เอกสาร', 'ล็อต', 'วันหมดอายุ', 'รับ', 'จ่าย', 'คงเหลือ', 'ผู้ทำรายการ', 'หมายเหตุ'],
      csvRows: function () {
        return d.rows.map(function (r) {
          return [r.date, typeName[r.type] || r.type, r.refNo, r.lotNo, r.expDate,
          r.inQty, r.outQty, r.balance, r.byUser, r.note];
        });
      },
      printCols: ['วันที่:date', 'ประเภท:typeTH', 'เอกสาร:refNo', 'ล็อต:lotNo', 'รับ:inQty', 'จ่าย:outQty', 'คงเหลือ:balance'],
      prep: function (r) { r.typeTH = typeName[r.type] || r.type; return r; }
    };
  },

  expiry: function (d) {
    var bucketName = { expired: 'หมดอายุแล้ว', d30: 'ไม่เกิน 30 วัน', d60: '31-60 วัน', d90: '61 วันขึ้นไป' };
    var cols = [
      { label: 'รหัส', w: '96px', fmt: function (r) { return '<span class="pill pill-line">' + BBS.esc(r.code) + '</span>'; } },
      { label: 'พัสดุ', fmt: function (r) { return '<strong>' + BBS.esc(r.name) + '</strong>'; } },
      { label: 'ล็อต', w: '110px', fmt: function (r) { return BBS.esc(r.lotNo || '-'); } },
      { label: 'วันหมดอายุ', w: '200px', fmt: function (r) { return BBS.expBar(r.expDate, r.days); } },
      { label: 'ช่วง', w: '120px', fmt: function (r) { return '<span class="pill ' + (r.bucket === 'expired' ? 'pill-danger' : (r.bucket === 'd30' ? 'pill-warn' : 'pill-soft')) + '">' + bucketName[r.bucket] + '</span>'; } },
      { label: 'คงเหลือ', w: '110px', cls: 't-right', fmt: function (r) { return '<strong>' + BBS.num(r.qty, 2) + '</strong> ' + BBS.esc(r.unit); } }
    ];
    return {
      title: 'รายงานพัสดุใกล้หมดอายุ',
      cols: cols, rows: d.rows,
      summary: statLine([
        ['หมดอายุแล้ว', BBS.num(d.summary.expired) + ' ล็อต'],
        ['ไม่เกิน 30 วัน', BBS.num(d.summary.d30) + ' ล็อต'],
        ['31-60 วัน', BBS.num(d.summary.d60) + ' ล็อต'],
        ['61 วันขึ้นไป', BBS.num(d.summary.d90) + ' ล็อต']
      ]),
      csvHead: ['รหัส', 'พัสดุ', 'ล็อต', 'วันหมดอายุ', 'เหลือ (วัน)', 'คงเหลือ', 'หน่วย', 'ช่วง'],
      csvRows: function () {
        return d.rows.map(function (r) {
          return [r.code, r.name, r.lotNo, r.expDate, r.days, r.qty, r.unit, bucketName[r.bucket]];
        });
      },
      printCols: ['รหัส:code', 'พัสดุ:name', 'ล็อต:lotNo', 'วันหมดอายุ:expDateTH', 'เหลือ (วัน):days', 'คงเหลือ:qty', 'หน่วย:unit'],
      prep: function (r) { r.expDateTH = BBS.dateTH(r.expDate); return r; }
    };
  }
};

function statLine(pairs) {
  var h = '<div class="stat-row" style="margin-bottom:14px">';
  pairs.forEach(function (p, i) {
    h += '<div class="stat ' + (i % 2 ? 's-gold' : '') + '"><div class="lbl">' + BBS.esc(p[0]) + '</div>'
      + '<div class="val" style="font-size:1.2rem">' + BBS.esc(p[1]) + '</div></div>';
  });
  return h + '</div>';
}

/* ---------- ส่งออก CSV ---------- */
function exportCsv(title, head, rows) {
  if (!rows || !rows.length) { BBS.toast('ไม่มีข้อมูลให้ส่งออก', 'warn'); return; }
  var esc = function (v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  };
  var lines = [head.map(esc).join(',')];
  rows.forEach(function (r) { lines.push(r.map(esc).join(',')); });
  var csv = '\ufeff' + lines.join('\r\n');
  var name = title.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]+/g, '_') + '_' + BBS.today() + '.csv';

  try {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    BBS.toast('กำลังดาวน์โหลดไฟล์ ' + name, 'ok');
  } catch (e) {
    BBS.ui.openHtml({
      title: 'ข้อมูลสำหรับคัดลอกไปวางใน Excel',
      size: 'lg',
      html: '<div class="mb-2 t-mute">เบราว์เซอร์นี้ดาวน์โหลดไฟล์จากหน้านี้ไม่ได้ ให้เลือกข้อความทั้งหมดแล้วคัดลอกไปวางใน Excel แทน</div>'
        + '<textarea class="form-control" rows="14">' + BBS.esc(csv) + '</textarea>'
    });
  }
}

/* ---------- พิมพ์รายงาน ---------- */
function printReport(cfg, periodText) {
  var rows = cfg.rows || [];
  if (cfg.prep) rows = rows.map(function (r) { return cfg.prep(Object.assign({}, r)); });

  var h = BBS.printHead(cfg.title, [['ช่วงข้อมูล', periodText], ['จำนวนรายการ', BBS.num(rows.length) + ' รายการ']]);
  h += '<table class="pr-table"><thead><tr><th style="width:5%">ที่</th>';
  cfg.printCols.forEach(function (c) { h += '<th>' + BBS.esc(c.split(':')[0]) + '</th>'; });
  h += '</tr></thead><tbody>';

  rows.forEach(function (r, i) {
    h += '<tr><td class="pr-center">' + (i + 1) + '</td>';
    cfg.printCols.forEach(function (c) {
      var k = c.split(':')[1];
      var v = r[k];
      if (k === 'date' || k === 'expDate') v = v ? BBS.dateTH(v) : '-';
      else if (typeof v === 'number') v = BBS.num(v, 2);
      h += '<td' + (typeof r[k] === 'number' ? ' class="pr-right"' : '') + '>' + BBS.esc(v === undefined || v === null ? '' : v) + '</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table>';
  h += '<div class="pr-sign">'
    + '<div><div class="pr-line"></div>(............................................)<div>เจ้าหน้าที่พัสดุ</div></div>'
    + '<div><div class="pr-line"></div>(............................................)<div>หัวหน้างานธนาคารเลือด</div></div>'
    + '</div>';
  h += '<div class="pr-foot">พิมพ์เมื่อ ' + BBS.dateTimeTH(new Date().toISOString()) + ' โดย ' + BBS.esc(BBS.user.name) + '</div>';
  BBS.printNow(h);
}
