/* =====================================================================
   BBSupply — หน้าแดชบอร์ด
   ===================================================================== */
BBS.pages.dashboard = {
  render: function (host) {
    return BBS.api('dash.get').then(function (d) {
      var h = BBS.head('แดชบอร์ด', BBS.cfg.org_name || '');

      h += '<div class="stat-row">';
      if (BBS.user.seePrice) h += BBS.statCard('มูลค่าสต๊อกคงเหลือ', d.totalValue, 'บาท', '', true);
      h += BBS.statCard('รายการพัสดุ', d.items, 'รายการ', '')
        + BBS.statCard('ต่ำกว่าจุดสั่งซื้อ', d.lowCount, 'รายการ', d.lowCount ? 's-gold' : 's-ok')
        + BBS.statCard('ใกล้หมดอายุใน ' + d.warnDays + ' วัน', d.expSoon, 'ล็อต', d.expSoon ? 's-gold' : 's-ok')
        + BBS.statCard('หมดอายุแล้ว', d.expired, 'ล็อต', d.expired ? '' : 's-ok')
        + BBS.statCard('รับเข้าเดือนนี้', d.recvMonth, 'หน่วย', 's-info')
        + BBS.statCard('เบิกเดือนนี้', d.issueMonth, 'หน่วย', 's-info')
        + '</div>';

      h += '<div class="grid-2"><div>';

      var expCols = [
        {
          label: 'พัสดุ', fmt: function (r) {
            return '<strong>' + BBS.esc(r.name) + '</strong><div class="t-mute">'
              + BBS.esc(r.code) + ' · ล็อต ' + BBS.esc(r.lotNo || '-') + '</div>';
          }
        },
        { label: 'วันหมดอายุ', w: '200px', fmt: function (r) { return BBS.expBar(r.expDate, r.days); } },
        {
          label: 'คงเหลือ', w: '104px', cls: 't-right', fmt: function (r) {
            return '<strong>' + BBS.num(r.qty, 2) + '</strong> <span class="t-mute">' + BBS.esc(r.unit) + '</span>';
          }
        }
      ];
      h += '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-calendar-x"></i> ล็อตที่ต้องเร่งใช้'
        + '<span class="sub"><a href="#/lots">ดูทั้งหมด</a></span></div>'
        + '<div class="card-bb-body p0">'
        + BBS.ui.table(expCols, d.expList, BBS.emptyBox('ยังไม่มีล็อตที่ใกล้หมดอายุ', '', 'bi-check2-circle'))
        + '</div></div>';

      var lowCols = [
        { label: 'พัสดุ', fmt: function (r) { return '<strong>' + BBS.esc(r.name) + '</strong><div class="t-mute">' + BBS.esc(r.code) + '</div>'; } },
        {
          label: 'คงเหลือ', w: '110px', cls: 't-right', fmt: function (r) {
            return '<strong>' + BBS.num(r.onHand, 2) + '</strong> <span class="t-mute">' + BBS.esc(r.unit) + '</span>';
          }
        },
        { label: 'จุดสั่งซื้อ', w: '96px', cls: 't-right', fmt: function (r) { return BBS.num(r.minStock, 2); } },
        {
          label: 'ยอดคงเหลือจากจุดสั่งซื้อ', w: '150px', cls: 't-right', fmt: function (r) {
            return '<strong>' + BBS.num(r.reorderRemain, 2) + '</strong> <span class="t-mute">' + BBS.esc(r.unit) + '</span>';
          }
        }
      ];
      h += '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-exclamation-triangle"></i> พัสดุที่ควรสั่งซื้อเพิ่ม'
        + '<span class="sub"><a href="#/po">สร้างใบสั่งซื้อ</a></span></div>'
        + '<div class="card-bb-body p0">'
        + BBS.ui.table(lowCols, d.lowList, BBS.emptyBox('ทุกรายการอยู่เหนือจุดสั่งซื้อ', '', 'bi-check2-circle'))
        + '</div></div>';

      h += '</div><div>';

      var rcCols = [
        { label: 'เลขที่', fmt: function (r) { return '<strong>' + BBS.esc(r.no) + '</strong><div class="t-mute">' + BBS.dateTH(r.date) + '</div>'; } },
        {
          label: 'จำนวน', w: '84px', cls: 't-right', fmt: function (r) {
            return r.status === 'void' ? '<span class="pill pill-danger">ยกเลิก</span>' : BBS.num(r.totalQty, 2);
          }
        }
      ];
      h += '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-box-arrow-in-down"></i> รับเข้าล่าสุด'
        + '<span class="sub"><a href="#/receipts">ทั้งหมด</a></span></div>'
        + '<div class="card-bb-body p0">'
        + BBS.ui.table(rcCols, d.recentReceipts, BBS.emptyBox('ยังไม่มีการรับเข้า', '', 'bi-inbox'))
        + '</div></div>';

      h += '<div class="card-bb"><div class="card-bb-head"><i class="bi bi-clipboard-data"></i> ภาพรวมข้อมูล</div>'
        + '<div class="card-bb-body">'
        + BBS.kv('ใบสั่งซื้อที่ยังค้างรับ', BBS.num(d.openPO) + ' ใบ')
        + BBS.kv('บริษัทผู้ขาย', BBS.num(d.suppliers) + ' ราย')
        + BBS.kv('ผู้เบิก', BBS.num(d.requesters) + ' คน')
        + BBS.kv('พัสดุที่คุมล็อต', BBS.num(d.lotTracked) + ' รายการ')
        + BBS.kv('ผู้ใช้ระบบ', BBS.num(d.users) + ' บัญชี')
        + '</div></div>';

      h += '</div></div>';
      host.innerHTML = h;
    });
  }
};
