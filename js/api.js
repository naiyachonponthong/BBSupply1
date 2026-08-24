/* =====================================================================
   BBSupply — สะพานเชื่อม Apps Script
   ห้ามแก้รูปแบบคำขอ: POST + text/plain + ไม่มี custom header
   ถ้าใส่ Content-Type: application/json หรือ header อื่นจะติด CORS ทันที
   ===================================================================== */
window.BBS = window.BBS || {};

BBS.token = null;
BBS.user = null;
BBS.cfg = {};

/* ต้องสร้างตรงนี้ (ไฟล์แรกสุดที่โหลด) ไม่ใช่ใน app.js
   เพราะไฟล์หน้าเว็บทุกไฟล์ (js/pages/*.js) โหลดก่อน app.js เสมอ
   และแต่ละหน้าจะเขียน BBS.pages.<ชื่อหน้า> = {...} ทันทีตอนโหลด
   ถ้า BBS.pages ยังไม่มี ทุกหน้าจะลงทะเบียนไม่ติดโดยไม่มีข้อความเตือนใด ๆ */
BBS.pages = BBS.pages || {};
BBS.pageKey = BBS.pageKey || 'dashboard';
BBS.param = BBS.param || null;

/* เวลารอสูงสุดต่อคำขอหนึ่งครั้ง
   Apps Script ที่ไม่ได้ถูกเรียกมานาน (cold start) ใช้เวลาตอบครั้งแรกได้ถึง ~10 วินาที
   ตั้งไว้ 45 วินาทีเพื่อไม่ตัดคำขอที่กำลังจะสำเร็จทิ้ง แต่ก็ไม่ค้างรอตลอดไปเมื่อสายหลุด */
BBS.TIMEOUT_MS = 45000;

/* เก็บรายละเอียดความล้มเหลวครั้งล่าสุดไว้ให้ตรวจใน Console: BBS.lastError */
BBS.lastError = null;

/* ลองใหม่ได้เฉพาะคำขออ่านข้อมูล/เข้าสู่ระบบ และ config.save ซึ่งเป็น idempotent
   ห้าม retry คำสั่งบันทึก เพราะอาจทำให้เกิดรายการซ้ำเมื่อเซิร์ฟเวอร์
   บันทึกสำเร็จแล้วแต่การตอบกลับขาดหายระหว่างทาง
   config.logo/logoRemove เขียนทับค่าเดิมเสมอ ยิงซ้ำได้ไม่เกิดข้อมูลซ้ำ */
BBS.isRetryableRoute = function (route) {
  return /^(auth\.login|auth\.me|dash\.get|config\.(get|save|logo|logoRemove)|.*\.list|.*\.get|report\..+|issue\.ctx|count\.sheet|scan\.(resolve|search|history)|sys\.alertStatus)$/.test(String(route || ''));
};

BBS.wait = function (ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
};

/* TypeError  = เบราว์เซอร์ยิงคำขอออกไปไม่ถึงเซิร์ฟเวอร์เลย (เน็ตหลุด / โดนบล็อก / CORS)
   AbortError = ยิงออกไปแล้วแต่ครบเวลารอยังไม่มีคำตอบ
   สองกรณีนี้เท่านั้นที่ถือว่า "เชื่อมต่อไม่ได้" และลองใหม่ได้ */
BBS.isNetworkError = function (e) {
  return (e instanceof TypeError) || !!(e && (e.name === 'AbortError' || e.name === 'ApiDegradedError'));
};

/* ข้อความบอกสาเหตุแบบเจาะจง พร้อมชื่อคำสั่งที่ล้ม ทำให้ไล่ปัญหาได้จากหน้าจอจริง
   เตือนเรื่อง googleusercontent.com ด้วย เพราะ script.google.com จะ 302 ไปโดเมนนั้น
   เครือข่ายองค์กรที่เปิดเฉพาะ script.google.com จึงพังทั้งที่ URL ถูกต้อง */
BBS.netMessage = function (route, e) {
  var why = (e && e.name === 'AbortError')
    ? 'เซิร์ฟเวอร์ไม่ตอบภายใน ' + Math.round(BBS.TIMEOUT_MS / 1000) + ' วินาที'
    : (e && e.name === 'ApiDegradedError')
      ? 'คำขอหล่นกลางทาง เซิร์ฟเวอร์ตอบกลับไม่ตรงคำสั่ง'
      : 'ส่งคำขอออกไปไม่ถึงเซิร์ฟเวอร์';
  return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (' + route + ') — ' + why
    + ' ตรวจสัญญาณอินเทอร์เน็ต และตรวจว่าเครือข่ายไม่ได้บล็อก script.google.com หรือ script.googleusercontent.com';
};

BBS.call = function (route, payload) {
  var attempt = 0;
  var maxAttempts = BBS.isRetryableRoute(route) ? 3 : 1;

  /* ยิงหนึ่งครั้ง พร้อมตัดจบเมื่อครบเวลารอ */
  var once = function () {
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = null;
    var opt = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({ route: route, token: BBS.token || '', payload: payload || {} })
    };
    if (ctl) {
      opt.signal = ctl.signal;
      timer = setTimeout(function () { ctl.abort(); }, BBS.TIMEOUT_MS);
    }
    var stopTimer = function () { if (timer) { clearTimeout(timer); timer = null; } };

    return fetch(CONFIG.API_URL, opt).then(function (r) {
      stopTimer();
      if (!r.ok) throw new Error('เซิร์ฟเวอร์ตอบกลับผิดพลาด (' + r.status + ')');
      return r.text();
    }).then(function (txt) {
      var res;
      try {
        res = JSON.parse(txt);
      } catch (e) {
        throw new Error('ข้อมูลที่ได้กลับมาไม่ถูกต้อง — ตรวจว่า Deploy เป็นเว็บแอปแบบ "ทุกคน" แล้ว');
      }
      /* บางครั้ง Google ทำ POST หล่นกลางทางแล้วไปเสิร์ฟผลของ doGet แทน
         สังเกตได้จากคำตอบเป็นข้อความต้อนรับของ API ทั้งที่เราส่ง route มา
         กรณีนี้คำสั่งยังไม่ได้ทำงานจริง ต้องยิงใหม่ ห้ามนับว่าสำเร็จ */
      if (res.status === 'success' && res.data && res.data.version && !res.data.token
          && String(res.message || '').indexOf('พร้อมใช้งาน') > -1) {
        var de = new Error('คำขอหล่นกลางทาง เซิร์ฟเวอร์ตอบกลับไม่ตรงคำสั่ง');
        de.name = 'ApiDegradedError';
        throw de;
      }
      if (res.status === 'error') {
        if (res.message === 'SESSION_EXPIRED') { BBS.auth.forceLogin(); }
        throw new Error(res.message || 'เกิดข้อผิดพลาด');
      }
      return res;
    }).catch(function (e) {
      stopTimer();
      throw e;
    });
  };

  var run = function () {
    attempt++;
    return once().catch(function (e) {
      if (BBS.isNetworkError(e) && attempt < maxAttempts) {
        return BBS.wait(attempt * 1200).then(run);
      }
      if (BBS.isNetworkError(e)) {
        BBS.lastError = {
          route: route, name: e.name, message: e.message,
          attempts: attempt, url: CONFIG.API_URL, at: new Date().toISOString()
        };
        throw new Error(BBS.netMessage(route, e));
      }
      throw e;
    });
  };

  return run();
};

/* ทดสอบการเชื่อมต่อโดยไม่ต้องล็อกอินและไม่แตะข้อมูล
   ใช้ GET ที่ doGet ตอบกลับเป็น JSON สั้น ๆ จึงวัดได้ว่าเส้นทางไปถึงเซิร์ฟเวอร์จริงหรือไม่
   เรียกจากหน้า ตั้งค่า > เครื่องมือระบบ หรือพิมพ์ BBS.diag() ใน Console ก็ได้ */
BBS.diag = function () {
  var t0 = Date.now();
  var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timer = null;
  var opt = { method: 'GET', redirect: 'follow' };
  if (ctl) { opt.signal = ctl.signal; timer = setTimeout(function () { ctl.abort(); }, BBS.TIMEOUT_MS); }

  return fetch(CONFIG.API_URL, opt).then(function (r) {
    if (timer) clearTimeout(timer);
    return r.text().then(function (txt) {
      var ms = Date.now() - t0;
      var res = null;
      try { res = JSON.parse(txt); } catch (e) { /* ไม่ใช่ JSON */ }
      if (!r.ok) return { ok: false, ms: ms, detail: 'เซิร์ฟเวอร์ตอบกลับ HTTP ' + r.status };
      if (!res) return { ok: false, ms: ms, detail: 'ได้คำตอบที่ไม่ใช่ JSON — Deploy ยังไม่ได้ตั้งเป็น "ทุกคน"' };
      return { ok: true, ms: ms, detail: 'ติดต่อได้ ' + ms + ' ms', version: res.data && res.data.version };
    });
  }).catch(function (e) {
    if (timer) clearTimeout(timer);
    BBS.lastError = { route: 'diag', name: e.name, message: e.message, url: CONFIG.API_URL, at: new Date().toISOString() };
    return { ok: false, ms: Date.now() - t0, detail: BBS.netMessage('diag', e) };
  });
};

/* คืนเฉพาะ data */
BBS.api = function (route, payload) {
  return BBS.call(route, payload).then(function (r) {
    return (r && r.data !== undefined) ? r.data : r;
  });
};

/* คืนทั้งก้อน (ใช้ตอนอยากได้ message มาแสดง) */
BBS.apiMsg = function (route, payload) { return BBS.call(route, payload); };
