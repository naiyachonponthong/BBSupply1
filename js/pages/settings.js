/* =====================================================================
   BBSupply — ตั้งค่า (รวมทุกการตั้งค่าไว้เมนูเดียว)
   ===================================================================== */
BBS.pages.settings = {
  tab: 'org',
  cfg: null,

  render: function (host) {
    var self = this;
    return BBS.api('config.get').then(function (c) {
      self.cfg = c || {};
      var tabs = [{ k: 'org', t: 'ข้อมูลหน่วยงาน' }, { k: 'cat', t: 'หมวดพัสดุ' }];
      if (BBS.isAdmin()) {
        tabs = tabs.concat([
          { k: 'users', t: 'ผู้ใช้และสิทธิ์' },
          { k: 'rules', t: 'เกณฑ์และเอกสาร' },
          { k: 'notify', t: 'การแจ้งเตือน' },
          { k: 'tools', t: 'เครื่องมือระบบ' }
        ]);
      }
      var h = BBS.head('ตั้งค่า', 'รวมการตั้งค่าทั้งหมดของระบบไว้ที่เดียว');
      h += '<div class="tabs-bb">';
      tabs.forEach(function (t) {
        h += '<button class="tab-bb' + (self.tab === t.k ? ' active' : '') + '" data-tab="' + t.k + '">' + BBS.esc(t.t) + '</button>';
      });
      h += '</div><div id="tabBody"></div>';
      host.innerHTML = h;

      host.querySelector('.tabs-bb').addEventListener('click', function (e) {
        var b = e.target.closest('[data-tab]');
        if (!b) return;
        self.tab = b.getAttribute('data-tab');
        BBS.route();
      });

      return self.drawTab(document.getElementById('tabBody'));
    });
  },

  drawTab: function (box) {
    if (this.tab === 'cat') return this.tabCategories(box);
    if (this.tab === 'users') return this.tabUsers(box);
    if (this.tab === 'rules') return this.tabRules(box);
    if (this.tab === 'notify') return this.tabNotify(box);
    if (this.tab === 'tools') return this.tabTools(box);
    return this.tabOrg(box);
  },

  /* --- ข้อมูลหน่วยงาน + โลโก้ --- */
  tabOrg: function (box) {
    var c = this.cfg;
    var ro = BBS.isAdmin() ? '' : ' disabled';
    box.innerHTML = '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-hospital"></i> ข้อมูลหน่วยงานและโลโก้</div>'
      + '<div class="card-bb-body"><div class="row g-3">'
      + '<div class="col-md-3"><label class="form-label">โลโก้ (แสดงบนใบพิมพ์)</label>'
      + '<div class="logo-box" id="logoBox">' + (c.logo_data ? '<img src="' + c.logo_data + '">' : '<i class="bi bi-image"></i>') + '</div>'
      + (BBS.isAdmin()
        ? '<input type="file" id="logoFile" accept="image/*" class="d-none">'
        + '<div class="btn-row justify-content-start mt-2">'
        + '<button class="btn-mini" id="btnLogo">อัปโหลด</button>'
        + '<button class="btn-mini danger" id="btnLogoDel">นำออก</button></div>'
        + '<div class="form-text small">ไฟล์ภาพไม่เกิน 800 KB</div>'
        : '')
      + '</div>'
      + '<div class="col-md-9"><div class="row g-3">'
      + '<div class="col-12"><label class="form-label">ชื่อระบบ (แสดงบนหน้าจอ)</label>'
      + '<input class="form-control" id="s_app_name" value="' + BBS.esc(c.app_name || '') + '"' + ro + '></div>'
      + '<div class="col-12"><label class="form-label">ชื่อหน่วยงาน (บรรทัดที่ 1 บนใบพิมพ์)</label>'
      + '<input class="form-control" id="s_org_name" value="' + BBS.esc(c.org_name || '') + '"' + ro + '></div>'
      + '<div class="col-12"><label class="form-label">ชื่อหน่วยงาน (บรรทัดที่ 2)</label>'
      + '<input class="form-control" id="s_org_line2" value="' + BBS.esc(c.org_line2 || '') + '"' + ro + '></div>'
      + '</div></div>'
      + '</div>'
      + (BBS.isAdmin() ? '<div class="text-end mt-3"><button class="btn btn-brand" id="btnSaveOrg">บันทึกการตั้งค่า</button></div>' : '')
      + '</div></div>';

    if (!BBS.isAdmin()) return;

    document.getElementById('btnSaveOrg').addEventListener('click', function () {
      BBS.apiMsg('config.save', {
        app_name: document.getElementById('s_app_name').value.trim(),
        org_name: document.getElementById('s_org_name').value.trim(),
        org_line2: document.getElementById('s_org_line2').value.trim()
      }).then(function (r) {
        BBS.cfg = r.data;
        BBS.toast(r.message, 'ok');
        document.getElementById('sideAppName').textContent = BBS.cfg.app_name;
        document.getElementById('topOrgName').textContent = BBS.cfg.org_name;
      }).catch(BBS.err);
    });

    document.getElementById('btnLogo').addEventListener('click', function () {
      document.getElementById('logoFile').click();
    });
    document.getElementById('logoFile').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        BBS.apiMsg('config.logo', {
          name: file.name, mimeType: file.type,
          dataBase64: String(reader.result).split(',')[1]
        }).then(function (r) {
          BBS.toast(r.message, 'ok');
          document.getElementById('logoBox').innerHTML = '<img src="' + r.data.logo_data + '">';
          BBS.cfg.logo_data = r.data.logo_data;
        }).catch(BBS.err);
      };
      reader.readAsDataURL(file);
    });
    document.getElementById('btnLogoDel').addEventListener('click', function () {
      BBS.apiMsg('config.logoRemove').then(function (r) {
        BBS.toast(r.message, 'ok');
        document.getElementById('logoBox').innerHTML = '<i class="bi bi-image"></i>';
        BBS.cfg.logo_data = '';
      }).catch(BBS.err);
    });
  },

  /* --- หมวดพัสดุ --- */
  tabCategories: function (box) {
    return BBS.api('category.list').then(function (rows) {
      var cols = [
        { label: 'ลำดับ', w: '80px', cls: 't-center', fmt: function (r) { return BBS.num(r.sort); } },
        { label: 'ชื่อหมวด', fmt: function (r) { return '<strong>' + BBS.esc(r.name) + '</strong>'; } },
        { label: 'สถานะ', w: '100px', fmt: function (r) { return BBS.activePill(r.active); } },
        {
          label: '', w: '96px', cls: 't-right', fmt: function (r) {
            return '<div class="btn-row">'
              + '<button class="btn-mini" data-cat-edit="' + r.id + '"><i class="bi bi-pencil"></i></button>'
              + '<button class="btn-mini danger" data-cat-del="' + r.id + '"><i class="bi bi-trash"></i></button>'
              + '</div>';
          }
        }
      ];
      box.innerHTML = '<div class="card-bb">'
        + '<div class="toolbar"><div class="fw-semibold">หมวดพัสดุ</div>'
        + '<div class="ms-auto"><button class="btn btn-brand btn-sm" id="btnAddCat"><i class="bi bi-plus-lg"></i> เพิ่มหมวด</button></div></div>'
        + '<div class="card-bb-body p0" id="catBox">' + BBS.ui.table(cols, rows, BBS.emptyBox('ยังไม่มีหมวดพัสดุ')) + '</div>'
        + '</div>';

      var form = function (rec) {
        BBS.ui.openForm({
          title: (rec ? 'แก้ไข' : 'เพิ่ม') + 'หมวดพัสดุ',
          fields: [
            { k: 'name', label: 'ชื่อหมวด', req: true },
            { k: 'sort', label: 'ลำดับการแสดง', type: 'number', col: 6 },
            { k: 'active', label: 'สถานะ', type: 'checkbox', checkLabel: 'เปิดใช้งาน', def: true, col: 6 }
          ],
          values: rec || { active: true, sort: (rows.length + 1) * 10 },
          onSave: function (data) {
            if (rec) data.id = rec.id;
            return BBS.apiMsg('category.save', data).then(function (r) {
              BBS.ui.close(); BBS.toast(r.message, 'ok'); BBS.route();
            });
          }
        });
      };

      document.getElementById('btnAddCat').addEventListener('click', function () { form(null); });
      document.getElementById('catBox').addEventListener('click', function (e) {
        var ed = e.target.closest('[data-cat-edit]');
        var dl = e.target.closest('[data-cat-del]');
        if (ed) {
          var r1 = rows.filter(function (x) { return x.id === ed.getAttribute('data-cat-edit'); })[0];
          if (r1) form(r1);
        }
        if (dl) {
          var id = dl.getAttribute('data-cat-del');
          var r2 = rows.filter(function (x) { return x.id === id; })[0];
          BBS.ui.confirm({
            title: 'ยืนยันการลบ',
            message: 'ต้องการลบหมวด "' + (r2 ? r2.name : '') + '" หรือไม่',
            okText: 'ลบหมวด', danger: true
          }).then(function (yes) {
            if (!yes) return;
            BBS.apiMsg('category.delete', { id: id }).then(function (r) {
              BBS.toast(r.message, 'ok'); BBS.route();
            }).catch(BBS.err);
          });
        }
      });
    });
  },

  /* --- ผู้ใช้และสิทธิ์ --- */
  tabUsers: function (box) {
    return BBS.api('user.list').then(function (rows) {
      var roleOpts = [
        { v: 'admin', t: 'ผู้ดูแลระบบ / หัวหน้าพัสดุ' },
        { v: 'staff', t: 'เจ้าหน้าที่พัสดุ' },
        { v: 'issuer', t: 'เจ้าหน้าที่หน่วยเบิก' },
        { v: 'viewer', t: 'หัวหน้างาน / ผู้บริหาร' }
      ];
      var cols = [
        {
          label: 'ผู้ใช้', fmt: function (r) {
            return '<strong>' + BBS.esc(r.name) + '</strong><div class="t-mute">' + BBS.esc(r.username) + '</div>';
          }
        },
        { label: 'บทบาท', fmt: function (r) { return '<span class="pill pill-soft">' + BBS.esc(r.roleLabel) + '</span>'; } },
        {
          label: 'เห็นราคา', w: '104px', cls: 't-center', fmt: function (r) {
            return r.seePrice ? '<span class="pill pill-gold">เห็น</span>' : '<span class="pill pill-mute">ไม่เห็น</span>';
          }
        },
        {
          label: 'เข้าใช้ล่าสุด', w: '150px', fmt: function (r) {
            return '<span class="t-mute">' + BBS.esc(r.last_login ? BBS.dateTimeTH(r.last_login) : 'ยังไม่เคยเข้า') + '</span>';
          }
        },
        { label: 'สถานะ', w: '96px', fmt: function (r) { return BBS.activePill(r.active); } },
        {
          label: '', w: '96px', cls: 't-right', fmt: function (r) {
            return '<div class="btn-row">'
              + '<button class="btn-mini" data-u-edit="' + r.id + '"><i class="bi bi-pencil"></i></button>'
              + '<button class="btn-mini danger" data-u-del="' + r.id + '"><i class="bi bi-trash"></i></button>'
              + '</div>';
          }
        }
      ];
      box.innerHTML = '<div class="card-bb">'
        + '<div class="toolbar"><div class="fw-semibold">ผู้ใช้ระบบ</div>'
        + '<div class="ms-auto"><button class="btn btn-brand btn-sm" id="btnAddUser"><i class="bi bi-plus-lg"></i> เพิ่มผู้ใช้</button></div></div>'
        + '<div class="card-bb-body p0" id="userBox">' + BBS.ui.table(cols, rows) + '</div>'
        + '</div>'
        + '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-shield-lock"></i> สิทธิ์ของแต่ละบทบาท</div>'
        + '<div class="card-bb-body">'
        + BBS.kv('ผู้ดูแลระบบ / หัวหน้าพัสดุ', 'ใช้งานได้ทุกส่วน รวมการตั้งค่าและจัดการผู้ใช้')
        + BBS.kv('เจ้าหน้าที่พัสดุ', 'ข้อมูลหลัก งานรับเข้า-เบิกจ่าย และรายงาน')
        + BBS.kv('เจ้าหน้าที่หน่วยเบิก', 'เบิกพัสดุด้วยการสแกน และดูประวัติการเบิก')
        + BBS.kv('หัวหน้างาน / ผู้บริหาร', 'ดูแดชบอร์ดและรายงานอย่างเดียว')
        + '</div></div>';

      var form = function (rec) {
        BBS.ui.openForm({
          title: (rec ? 'แก้ไข' : 'เพิ่ม') + 'ผู้ใช้',
          fields: [
            { k: 'username', label: 'ชื่อผู้ใช้', req: true, col: 6 },
            { k: 'name', label: 'ชื่อ-สกุล', req: true, col: 6 },
            { k: 'role', label: 'บทบาท', type: 'select', opts: roleOpts, col: 6 },
            {
              k: 'password', label: rec ? 'รหัสผ่านใหม่' : 'รหัสผ่าน', type: 'password', col: 6,
              req: !rec, help: rec ? 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยนรหัสผ่าน' : ''
            },
            { k: 'seePrice', label: 'ราคา', type: 'checkbox', checkLabel: 'ให้เห็นข้อมูลราคาและมูลค่าสต๊อก', col: 6 },
            { k: 'active', label: 'สถานะ', type: 'checkbox', checkLabel: 'เปิดใช้งานบัญชีนี้', def: true, col: 6 }
          ],
          values: rec || { active: true, role: 'staff', seePrice: false },
          onSave: function (data) {
            if (rec) data.id = rec.id;
            return BBS.apiMsg('user.save', data).then(function (r) {
              BBS.ui.close(); BBS.toast(r.message, 'ok'); BBS.route();
            });
          }
        });
      };

      document.getElementById('btnAddUser').addEventListener('click', function () { form(null); });
      document.getElementById('userBox').addEventListener('click', function (e) {
        var ed = e.target.closest('[data-u-edit]');
        var dl = e.target.closest('[data-u-del]');
        if (ed) {
          var u = rows.filter(function (x) { return x.id === ed.getAttribute('data-u-edit'); })[0];
          if (u) { u.password = ''; form(u); }
        }
        if (dl) {
          var id = dl.getAttribute('data-u-del');
          var u2 = rows.filter(function (x) { return x.id === id; })[0];
          BBS.ui.confirm({
            title: 'ยืนยันการลบผู้ใช้',
            message: 'ต้องการลบบัญชี "' + (u2 ? u2.username : '') + '" หรือไม่',
            okText: 'ลบผู้ใช้', danger: true
          }).then(function (yes) {
            if (!yes) return;
            BBS.apiMsg('user.delete', { id: id }).then(function (r) {
              BBS.toast(r.message, 'ok'); BBS.route();
            }).catch(BBS.err);
          });
        }
      });
    });
  },

  /* --- เกณฑ์และเอกสาร --- */
  tabRules: function (box) {
    var c = this.cfg;
    box.innerHTML = '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-sliders"></i> เกณฑ์การเตือนและรูปแบบเอกสาร</div>'
      + '<div class="card-bb-body"><div class="row g-3">'
      + numField('s_expiry_warn_days', 'เตือนของใกล้หมดอายุก่อน (วัน)', c.expiry_warn_days)
      + numField('s_expiry_critical_days', 'ระดับเร่งด่วนเมื่อเหลือน้อยกว่า (วัน)', c.expiry_critical_days)
      + numField('s_session_timeout', 'หมดเวลาการเข้าใช้งาน (ชั่วโมง)', c.session_timeout)
      + numField('s_fiscal_start_month', 'เดือนเริ่มปีงบประมาณ (1-12)', c.fiscal_start_month)
      + txtField('s_doc_prefix_receipt', 'คำนำหน้าเลขที่ใบรับเข้า', c.doc_prefix_receipt)
      + txtField('s_doc_prefix_issue', 'คำนำหน้าเลขที่ใบเบิก', c.doc_prefix_issue)
      + txtField('s_doc_prefix_po', 'คำนำหน้าเลขที่ใบสั่งซื้อ', c.doc_prefix_po)
      + '</div>'
      + '<div class="text-end mt-3"><button class="btn btn-brand" id="btnSaveRules">บันทึกการตั้งค่า</button></div>'
      + '</div></div>';

    document.getElementById('btnSaveRules').addEventListener('click', function () {
      var val = function (id) { return document.getElementById(id).value.trim(); };
      BBS.apiMsg('config.save', {
        expiry_warn_days: Number(val('s_expiry_warn_days')),
        expiry_critical_days: Number(val('s_expiry_critical_days')),
        session_timeout: Number(val('s_session_timeout')),
        fiscal_start_month: Number(val('s_fiscal_start_month')),
        doc_prefix_receipt: val('s_doc_prefix_receipt'),
        doc_prefix_issue: val('s_doc_prefix_issue'),
        doc_prefix_po: val('s_doc_prefix_po')
      }).then(function (r) {
        BBS.cfg = r.data;
        BBS.toast(r.message, 'ok');
      }).catch(BBS.err);
    });
  },

  /* --- การแจ้งเตือน --- */
  tabNotify: function (box) {
    var c = this.cfg;
    box.innerHTML = '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-bell"></i> ช่องทางแจ้งเตือน</div>'
      + '<div class="card-bb-body"><div class="row g-3">'
      + '<div class="col-12"><div class="form-check">'
      + '<input class="form-check-input" type="checkbox" id="s_notify_telegram"' + (c.notify_telegram ? ' checked' : '') + '>'
      + '<label class="form-check-label" for="s_notify_telegram">เปิดการแจ้งเตือนผ่าน Telegram</label></div></div>'
      + txtField('s_telegram_bot_token', 'Telegram Bot Token', c.telegram_bot_token, 8)
      + txtField('s_telegram_chat_id', 'Telegram Chat ID', c.telegram_chat_id, 4)
      + '<div class="col-12"><div class="form-check">'
      + '<input class="form-check-input" type="checkbox" id="s_notify_email"' + (c.notify_email ? ' checked' : '') + '>'
      + '<label class="form-check-label" for="s_notify_email">เปิดการแจ้งเตือนผ่านอีเมล</label></div></div>'
      + txtField('s_email_list', 'รายชื่ออีเมลผู้รับ (คั่นด้วยจุลภาค)', c.email_list, 12)
      + '</div>'
      + '<div class="text-end mt-3">'
      + '<button class="btn btn-light me-2" id="btnTestTg">ส่งข้อความทดสอบ</button>'
      + '<button class="btn btn-brand" id="btnSaveNotify">บันทึกการตั้งค่า</button></div>'
      + '</div></div>'
      + '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-alarm"></i> สรุปพัสดุอัตโนมัติประจำวัน</div>'
      + '<div class="card-bb-body">'
      + '<div class="kv"><span><span class="v">ส่งสรุปทุกวันเวลา 08:00 น.</span>'
      + '<div class="t-mute">สรุปของที่หมดอายุแล้ว ของใกล้หมดอายุ และรายการที่ต่ำกว่าจุดสั่งซื้อ ส่งตามช่องทางที่เปิดไว้ด้านบน</div></span>'
      + '<span id="alertState" class="t-mute">กำลังตรวจสอบ...</span></div>'
      + '<div class="btn-row mt-2">'
      + '<button class="btn-mini" id="btnAlertOn">เปิดการแจ้งเตือนอัตโนมัติ</button>'
      + '<button class="btn-mini danger" id="btnAlertOff">ปิด</button>'
      + '<button class="btn-mini" id="btnAlertNow">ส่งสรุปเดี๋ยวนี้</button>'
      + '</div></div></div>';

    document.getElementById('btnSaveNotify').addEventListener('click', function () {
      BBS.apiMsg('config.save', {
        notify_telegram: document.getElementById('s_notify_telegram').checked,
        telegram_bot_token: document.getElementById('s_telegram_bot_token').value.trim(),
        telegram_chat_id: document.getElementById('s_telegram_chat_id').value.trim(),
        notify_email: document.getElementById('s_notify_email').checked,
        email_list: document.getElementById('s_email_list').value.trim()
      }).then(function (r) { BBS.toast(r.message, 'ok'); }).catch(BBS.err);
    });

    document.getElementById('btnTestTg').addEventListener('click', function () {
      BBS.apiMsg('sys.tool', { action: 'testTelegram' })
        .then(function (r) { BBS.toast(r.message, 'ok'); }).catch(BBS.err);
    });

    var showAlert = function (installed) {
      document.getElementById('alertState').innerHTML = installed
        ? '<span class="pill pill-ok">เปิดอยู่</span>'
        : '<span class="pill pill-mute">ปิดอยู่</span>';
    };
    BBS.api('sys.alertStatus').then(function (d) { showAlert(d.installed); })
      .catch(function () { document.getElementById('alertState').textContent = '-'; });

    document.getElementById('btnAlertOn').addEventListener('click', function () {
      BBS.apiMsg('sys.alertToggle', { on: true }).then(function (r) {
        BBS.toast(r.message, 'ok'); showAlert(true);
      }).catch(BBS.err);
    });
    document.getElementById('btnAlertOff').addEventListener('click', function () {
      BBS.apiMsg('sys.alertToggle', { on: false }).then(function (r) {
        BBS.toast(r.message, 'ok'); showAlert(false);
      }).catch(BBS.err);
    });
    document.getElementById('btnAlertNow').addEventListener('click', function () {
      BBS.apiMsg('sys.alertNow').then(function (r) { BBS.toast(r.message, 'ok'); }).catch(BBS.err);
    });
  },

  /* --- เครื่องมือระบบ --- */
  tabTools: function (box) {
    box.innerHTML = '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-tools"></i> เครื่องมือระบบ</div>'
      + '<div class="card-bb-body">'
      + toolRow('ตรวจสอบและสร้างชีตข้อมูล', 'ตรวจว่าชีตทั้งหมดครบถ้วน ถ้าขาดจะสร้างให้ใหม่โดยไม่กระทบข้อมูลเดิม', 'initSheets', 'สร้าง/ตรวจสอบ')
      + toolRow('คำนวณยอดคงเหลือใหม่ทั้งระบบ', 'สร้างยอดรับเข้า จ่ายออก คงเหลือ และยอดรายล็อตใหม่จากบัญชีเดินสะพัด ใช้เมื่อสงสัยว่ายอดไม่ตรง', 'rebuild', 'คำนวณใหม่')
      + toolRow('ล้างการเข้าใช้งานทั้งหมด', 'ผู้ใช้ทุกคนจะต้องเข้าสู่ระบบใหม่ ใช้เมื่อสงสัยว่ามีการเข้าถึงที่ไม่ควร', 'clearSessions', 'ล้าง session')
      + '</div></div>'
      + '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-info-circle"></i> ข้อมูลระบบ</div>'
      + '<div class="card-bb-body">'
      + BBS.kv('ชื่อระบบ', BBS.cfg.app_name || '')
      + BBS.kv('เวอร์ชัน', BBS.cfg.app_version || '1.0')
      + BBS.kv('บัญชีที่ใช้งานอยู่', BBS.user.username)
      + BBS.kv('ที่อยู่ API', CONFIG.API_URL)
      + '</div></div>';

    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tool]');
      if (!b) return;
      var action = b.getAttribute('data-tool');
      BBS.ui.confirm({ title: 'ยืนยันการทำงาน', message: 'ต้องการดำเนินการนี้หรือไม่' }).then(function (yes) {
        if (!yes) return;
        b.disabled = true;
        var call = action === 'rebuild'
          ? BBS.apiMsg('sys.rebuild')
          : BBS.apiMsg('sys.tool', { action: action });
        call.then(function (r) {
          b.disabled = false;
          BBS.toast(r.message, 'ok');
          if (action === 'clearSessions') setTimeout(BBS.auth.logout, 900);
        }).catch(function (err) { b.disabled = false; BBS.err(err); });
      });
    });
  }
};

function numField(id, label, val, col) {
  return '<div class="col-md-' + (col || 3) + '"><label class="form-label" for="' + id + '">' + BBS.esc(label) + '</label>'
    + '<input class="form-control" type="number" id="' + id + '" value="' + BBS.esc(val === undefined ? '' : val) + '"></div>';
}

function txtField(id, label, val, col) {
  return '<div class="col-md-' + (col || 4) + '"><label class="form-label" for="' + id + '">' + BBS.esc(label) + '</label>'
    + '<input class="form-control" type="text" id="' + id + '" value="' + BBS.esc(val === undefined ? '' : val) + '"></div>';
}

function toolRow(title, desc, action, btnText) {
  return '<div class="kv"><span><span class="v">' + BBS.esc(title) + '</span>'
    + '<div class="t-mute">' + BBS.esc(desc) + '</div></span>'
    + '<span><button class="btn-mini" data-tool="' + action + '">' + BBS.esc(btnText) + '</button></span></div>';
}
