/* =====================================================================
   BBSupply — ข้อมูลหลัก: รายการพัสดุ / บริษัทผู้ขาย / ผู้เบิก
   ===================================================================== */

/* ตัวสร้างหน้าแบบตาราง + ฟอร์ม ใช้ร่วมทุกหน้าข้อมูลหลัก */
function makeCrud(o) {
  return {
    rows: [],
    ctx: {},

    render: function (host) {
      var self = this;
      return Promise.resolve(o.prepare ? o.prepare() : {}).then(function (ctx) {
        self.ctx = ctx || {};
        return BBS.api(o.listRoute);
      }).then(function (rows) {
        self.rows = rows || [];
        var canEdit = BBS.can(o.perm || 'master');
        var actions = '';
        if (o.extra) {
          actions += '<button class="btn btn-outline-brand" id="btnExtra"><i class="bi ' + o.extra.icon + '"></i> '
            + BBS.esc(o.extra.label) + '</button>';
        }
        if (canEdit) {
          actions += '<button class="btn btn-brand" id="btnAdd"><i class="bi bi-plus-lg"></i> ' + BBS.esc(o.addLabel) + '</button>';
        }

        host.innerHTML = BBS.head(o.title, o.sub, actions)
          + '<div class="card-bb">'
          + '<div class="toolbar">'
          + '<div class="search"><i class="bi bi-search"></i>'
          + '<input class="form-control" id="q" placeholder="' + BBS.esc(o.searchPlaceholder || 'ค้นหา...') + '"></div>'
          + '<div class="t-mute" id="cnt"></div>'
          + '</div>'
          + '<div class="card-bb-body p0" id="listBox"></div>'
          + '</div>';

        if (canEdit) document.getElementById('btnAdd').addEventListener('click', function () { self.form(null); });
        if (o.extra) document.getElementById('btnExtra').addEventListener('click', function () { o.extra.run(self); });

        document.getElementById('listBox').addEventListener('click', function (e) {
          var btn = e.target.closest('[data-act]');
          if (!btn) return;
          var rec = self.rows.filter(function (r) { return r.id === btn.getAttribute('data-id'); })[0];
          if (!rec) return;
          if (btn.getAttribute('data-act') === 'edit') self.form(rec);
          if (btn.getAttribute('data-act') === 'del') self.del(rec);
        });

        BBS.ui.bindSearch('q', function (q) { self.draw(q); });
        self.draw('');
      });
    },

    draw: function (q) {
      var self = this;
      var list = !q ? self.rows : self.rows.filter(function (r) { return o.match(r, q); });
      var cols = o.cols(self);
      if (BBS.can(o.perm || 'master')) {
        cols = cols.concat([{
          label: '', w: '96px', cls: 't-right', fmt: function (r) {
            return '<div class="btn-row">'
              + '<button class="btn-mini" data-act="edit" data-id="' + r.id + '"><i class="bi bi-pencil"></i></button>'
              + '<button class="btn-mini danger" data-act="del" data-id="' + r.id + '"><i class="bi bi-trash"></i></button>'
              + '</div>';
          }
        }]);
      }
      document.getElementById('listBox').innerHTML =
        BBS.ui.table(cols, list, BBS.emptyBox(q ? 'ไม่พบข้อมูลที่ค้นหา' : o.emptyText, q ? '' : o.emptyHint, o.emptyIcon));
      document.getElementById('cnt').textContent = list.length + ' รายการ';
    },

    form: function (rec) {
      var self = this;
      BBS.ui.openForm({
        title: (rec ? 'แก้ไข' : 'เพิ่ม') + o.formTitle,
        size: o.formSize || 'lg',
        fields: o.fields(self, rec),
        values: rec || o.defaults || {},
        onSave: function (data) {
          if (rec) data.id = rec.id;
          return BBS.apiMsg(o.saveRoute, data).then(function (r) {
            BBS.ui.close();
            BBS.toast(r.message, 'ok');
            BBS.route();
          });
        }
      });
    },

    del: function (rec) {
      BBS.ui.confirm({
        title: 'ยืนยันการลบ',
        message: 'ต้องการลบ "' + (rec.name || rec.code) + '" ออกจากระบบหรือไม่ การลบนี้ย้อนกลับไม่ได้',
        okText: 'ลบข้อมูล',
        danger: true
      }).then(function (yes) {
        if (!yes) return;
        BBS.apiMsg(o.delRoute, { id: rec.id }).then(function (r) {
          BBS.toast(r.message, 'ok');
          BBS.route();
        }).catch(BBS.err);
      });
    }
  };
}

/* ===================== บริษัทผู้ขาย ===================== */
BBS.pages.suppliers = makeCrud({
  title: 'บริษัทผู้ขาย',
  sub: 'รายชื่อบริษัทที่หน่วยงานสั่งซื้อพัสดุ',
  addLabel: 'เพิ่มบริษัท',
  formTitle: 'ข้อมูลบริษัท',
  listRoute: 'supplier.list',
  saveRoute: 'supplier.save',
  delRoute: 'supplier.delete',
  searchPlaceholder: 'ค้นหาชื่อบริษัท ผู้ติดต่อ เบอร์โทร',
  emptyText: 'ยังไม่มีบริษัทผู้ขาย',
  emptyHint: 'เพิ่มบริษัทแรกเพื่อใช้อ้างอิงตอนสั่งซื้อและรับเข้าพัสดุ',
  emptyIcon: 'bi-building',
  match: function (r, q) {
    return [r.name, r.contact, r.phone, r.taxId].join(' ').toLowerCase().indexOf(q) > -1;
  },
  cols: function () {
    return [
      {
        label: 'ชื่อบริษัท', fmt: function (r) {
          return '<strong>' + BBS.esc(r.name) + '</strong>'
            + (r.taxId ? '<div class="t-mute">เลขผู้เสียภาษี ' + BBS.esc(r.taxId) + '</div>' : '');
        }
      },
      { label: 'ผู้ติดต่อ', fmt: function (r) { return BBS.esc(r.contact || '-'); } },
      { label: 'โทรศัพท์', fmt: function (r) { return BBS.esc(r.phone || '-'); } },
      { label: 'อีเมล', fmt: function (r) { return BBS.esc(r.email || '-'); } },
      { label: 'สถานะ', w: '96px', fmt: function (r) { return BBS.activePill(r.active); } }
    ];
  },
  fields: function () {
    return [
      { k: 'name', label: 'ชื่อบริษัท', req: true, col: 8 },
      { k: 'taxId', label: 'เลขประจำตัวผู้เสียภาษี', col: 4 },
      { k: 'contact', label: 'ชื่อผู้ติดต่อ', col: 4 },
      { k: 'phone', label: 'โทรศัพท์', col: 4 },
      { k: 'email', label: 'อีเมล', col: 4 },
      { k: 'address', label: 'ที่อยู่', type: 'textarea', rows: 2 },
      { k: 'note', label: 'หมายเหตุ', type: 'textarea', rows: 2 },
      { k: 'active', label: 'สถานะ', type: 'checkbox', checkLabel: 'เปิดใช้งานบริษัทนี้', def: true, col: 6 }
    ];
  },
  defaults: { active: true }
});

/* ===================== รายการพัสดุ ===================== */
BBS.pages.items = makeCrud({
  title: 'รายการพัสดุ',
  sub: 'ทะเบียนพัสดุของหน่วยรับบริจาคเลือด',
  addLabel: 'เพิ่มพัสดุ',
  formTitle: 'รายการพัสดุ',
  listRoute: 'item.list',
  saveRoute: 'item.save',
  delRoute: 'item.delete',
  searchPlaceholder: 'ค้นหารหัส ชื่อพัสดุ หมวด บริษัท',
  emptyText: 'ยังไม่มีรายการพัสดุ',
  emptyHint: 'เพิ่มพัสดุรายการแรก หรือคีย์จากทะเบียนพัสดุเดิมของหน่วยงาน',
  emptyIcon: 'bi-box-seam',
  prepare: function () {
    return Promise.all([BBS.api('category.list'), BBS.api('supplier.list')])
      .then(function (r) { return { cats: r[0] || [], sups: r[1] || [] }; });
  },
  match: function (r, q) {
    return [r.code, r.name, r.categoryName, r.supplierName, r.unit].join(' ').toLowerCase().indexOf(q) > -1;
  },
  cols: function () {
    var cols = [
      { label: 'รหัส', w: '92px', fmt: function (r) { return '<span class="pill pill-line">' + BBS.esc(r.code) + '</span>'; } },
      {
        label: 'ชื่อพัสดุ', fmt: function (r) {
          return '<strong>' + BBS.esc(r.name) + '</strong>'
            + (r.trackLot !== false ? ' <span class="pill pill-gold">คุมล็อต</span>' : '')
            + (r.categoryName ? '<div class="t-mute">' + BBS.esc(r.categoryName) + '</div>' : '');
        }
      },
      { label: 'บริษัทผู้ขาย', fmt: function (r) { return BBS.esc(r.supplierName || '-'); } },
      { label: 'หน่วยนับ', w: '86px', fmt: function (r) { return BBS.esc(r.unit); } },
      {
        label: 'คงเหลือ', w: '116px', cls: 't-right', fmt: function (r) {
          return '<strong>' + BBS.num(r.qtyOnHand, 2) + '</strong>'
            + (r.low ? ' <span class="pill pill-warn">ต่ำ</span>' : '')
            + '<div class="t-mute">จุดสั่งซื้อ ' + BBS.num(r.minStock) + '</div>';
        }
      },
      {
        label: 'ล็อตที่ควรใช้ก่อน', w: '190px', fmt: function (r) {
          return r.nextExp ? BBS.expBar(r.nextExp, r.nextExpDays) : '<span class="t-mute">-</span>';
        }
      }
    ];
    if (BBS.user && BBS.user.seePrice) {
      cols.push({ label: 'ราคา/หน่วย', w: '106px', cls: 't-right', fmt: function (r) { return BBS.money(r.unitPriceLast); } });
    }
    cols.push({ label: 'สถานะ', w: '96px', fmt: function (r) { return BBS.activePill(r.active); } });
    return cols;
  },
  fields: function (self) {
    var catOpts = [{ v: '', t: '— ไม่ระบุหมวด —' }].concat((self.ctx.cats || []).map(function (c) {
      return { v: c.id, t: c.name };
    }));
    var supOpts = [{ v: '', t: '— ไม่ระบุบริษัท —' }].concat((self.ctx.sups || []).map(function (s) {
      return { v: s.id, t: s.name };
    }));
    var f = [
      { k: 'code', label: 'รหัสพัสดุ', col: 4, ph: 'เว้นว่างให้ระบบออกให้', help: 'เว้นว่างไว้ ระบบจะออกรหัสรูปแบบ BB-0001 ให้อัตโนมัติ' },
      { k: 'name', label: 'ชื่อพัสดุ', req: true, col: 8 },
      { k: 'categoryId', label: 'หมวดพัสดุ', type: 'select', opts: catOpts, col: 6 },
      { k: 'supplierId', label: 'บริษัทผู้ขาย', type: 'select', opts: supOpts, col: 6 },
      { k: 'unit', label: 'หน่วยนับ', req: true, col: 4, ph: 'ถุง / กล่อง / ชิ้น' },
      { k: 'minStock', label: 'จุดสั่งซื้อ (แจ้งเตือนเมื่อคงเหลือต่ำกว่า)', type: 'number', col: 4 }
    ];
    if (BBS.user && BBS.user.seePrice) {
      f.push({ k: 'unitPriceLast', label: 'ราคาต่อหน่วยล่าสุด (บาท)', type: 'number', step: '0.01', col: 4 });
    }
    return f.concat([
      { k: 'trackLot', label: 'ล็อต', type: 'checkbox', checkLabel: 'คุมเลขล็อตของพัสดุนี้', def: true, col: 6 },
      { k: 'requireExp', label: 'วันหมดอายุ', type: 'checkbox', checkLabel: 'บังคับกรอกวันหมดอายุตอนรับเข้า', def: true, col: 6 },
      { k: 'note', label: 'หมายเหตุ', type: 'textarea', rows: 2 },
      { k: 'active', label: 'สถานะ', type: 'checkbox', checkLabel: 'เปิดใช้งานพัสดุนี้', def: true, col: 6 }
    ]);
  },
  defaults: { active: true, trackLot: true, requireExp: true, minStock: 0 }
});

/* ===================== ผู้เบิก ===================== */
BBS.pages.requesters = makeCrud({
  title: 'ผู้เบิก',
  sub: 'รายชื่อผู้มีสิทธิ์เบิกพัสดุ พร้อมหน่วยงานที่สังกัด',
  addLabel: 'เพิ่มผู้เบิก',
  formTitle: 'ข้อมูลผู้เบิก',
  listRoute: 'requester.list',
  saveRoute: 'requester.save',
  delRoute: 'requester.delete',
  searchPlaceholder: 'ค้นหาชื่อ หน่วยงาน ตำแหน่ง',
  emptyText: 'ยังไม่มีผู้เบิก',
  emptyHint: 'เพิ่มรายชื่อเจ้าหน้าที่ที่มาเบิกพัสดุ พร้อมระบุหน่วยงานที่สังกัด',
  emptyIcon: 'bi-person-badge',
  match: function (r, q) {
    return [r.code, r.name, r.dept, r.position].join(' ').toLowerCase().indexOf(q) > -1;
  },
  cols: function () {
    return [
      { label: 'รหัส', w: '86px', fmt: function (r) { return '<span class="pill pill-line">' + BBS.esc(r.code) + '</span>'; } },
      {
        label: 'ชื่อ-สกุล', fmt: function (r) {
          return '<strong>' + BBS.esc(r.name) + '</strong>'
            + (r.position ? '<div class="t-mute">' + BBS.esc(r.position) + '</div>' : '');
        }
      },
      { label: 'หน่วยงาน / แผนก', fmt: function (r) { return BBS.esc(r.dept || '-'); } },
      { label: 'โทรศัพท์', w: '120px', fmt: function (r) { return BBS.esc(r.phone || '-'); } },
      { label: 'สถานะ', w: '96px', fmt: function (r) { return BBS.activePill(r.active); } }
    ];
  },
  fields: function () {
    return [
      { k: 'code', label: 'รหัสผู้เบิก', col: 4, ph: 'เว้นว่างให้ระบบออกให้', help: 'ใช้เป็นรหัสอ้างอิงบนบัตรผู้เบิก' },
      { k: 'name', label: 'ชื่อ-สกุล', req: true, col: 8 },
      { k: 'position', label: 'ตำแหน่ง', col: 6 },
      { k: 'dept', label: 'หน่วยงาน / แผนก', req: true, col: 6 },
      { k: 'phone', label: 'โทรศัพท์', col: 6 },
      { k: 'note', label: 'หมายเหตุ', type: 'textarea', rows: 2 },
      { k: 'active', label: 'สถานะ', type: 'checkbox', checkLabel: 'เปิดใช้งานผู้เบิกรายนี้', def: true, col: 6 }
    ];
  },
  defaults: { active: true },
  extra: {
    label: 'พิมพ์บัตรผู้เบิก', icon: 'bi-person-vcard',
    run: function (self) {
      var list = self.rows.filter(function (r) { return r.active !== false; });
      if (!list.length) { BBS.toast('ยังไม่มีผู้เบิกที่เปิดใช้งาน', 'warn'); return; }
      BBS.ui.confirm({
        title: 'พิมพ์บัตรผู้เบิก',
        message: 'พิมพ์บัตรของผู้เบิกที่เปิดใช้งานทั้งหมด ' + list.length + ' ใบ (A4 เรียง 2 ใบต่อแถว) บัตรนี้ใช้สแกนตอนเบิกพัสดุ',
        okText: 'พิมพ์'
      }).then(function (yes) {
        if (!yes) return;
        setTimeout(function () { printRequesterCards(list); }, 300);
      });
    }
  }
});

function printRequesterCards(list) {
  var c = BBS.cfg || {};
  var h = '<div class="card-sheet">';
  list.forEach(function (r) {
    var img = BBS.qrDataUrl('BBS|R|' + r.id, 5);
    h += '<div class="id-card">'
      + (img ? '<img class="c-qr" src="' + img + '">' : '')
      + '<div><div class="c-org">' + BBS.esc(c.org_name || '') + '</div>'
      + '<div class="c-name">' + BBS.esc(r.name) + '</div>'
      + '<div class="c-dept">' + BBS.esc(r.dept || '') + '</div>'
      + '<div class="c-code">บัตรผู้เบิก ' + BBS.esc(r.code) + '</div></div>'
      + '</div>';
  });
  BBS.printNow(h + '</div>');
}
