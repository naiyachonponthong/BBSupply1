/* =====================================================================
   BBSupply — สะพานเชื่อม Apps Script
   ห้ามแก้รูปแบบคำขอ: POST + text/plain + ไม่มี custom header
   ถ้าใส่ Content-Type: application/json หรือ header อื่นจะติด CORS ทันที
   ===================================================================== */
window.BBS = window.BBS || {};

BBS.token = null;
BBS.user = null;
BBS.cfg = {};

BBS.call = function (route, payload) {
  return fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify({ route: route, token: BBS.token || '', payload: payload || {} })
  }).then(function (r) {
    if (!r.ok) throw new Error('เซิร์ฟเวอร์ตอบกลับผิดพลาด (' + r.status + ')');
    return r.text();
  }).then(function (txt) {
    var res;
    try {
      res = JSON.parse(txt);
    } catch (e) {
      throw new Error('ข้อมูลที่ได้กลับมาไม่ถูกต้อง — ตรวจว่า Deploy เป็นเว็บแอปแบบ "ทุกคน" แล้ว');
    }
    if (res.status === 'error') {
      if (res.message === 'SESSION_EXPIRED') { BBS.auth.forceLogin(); }
      throw new Error(res.message || 'เกิดข้อผิดพลาด');
    }
    return res;
  }).catch(function (e) {
    if (e instanceof TypeError) {
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบสัญญาณอินเทอร์เน็ตและ API_URL ใน config.js');
    }
    throw e;
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
