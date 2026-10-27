/* پل بین وب‌اپ و قابلیت‌های بومی اندروید (فقط داخل اپ نصب‌شده فعال می‌شود) */
(() => {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const P = n => C.registerPlugin(n);
  const FS = P('Filesystem'), SH = P('Share'), BS = P('BarcodeScanner'),
        SP = P('SpeechRecognition'), AP = P('App'), SB = P('StatusBar');
  document.documentElement.classList.add('native');
  try { Object.defineProperty(navigator, 'canShare', { value: () => false }); } catch (e) {}

  /* ---------- ارسال/ذخیره فایل: همه‌ی دانلودها از طریق منوی اشتراک‌گذاری اندروید ---------- */
  const b64 = b => new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = no;
    r.readAsDataURL(b);
  });
  async function outFile(blob, name) {
    try {
      const path = 'out/' + name;
      await FS.writeFile({ path, data: await b64(blob), directory: 'CACHE', recursive: true });
      const { uri } = await FS.getUri({ path, directory: 'CACHE' });
      await SH.share({ title: name, files: [uri], dialogTitle: 'ارسال یا ذخیره فایل' });
      return true;
    } catch (e) {
      if (!/cancel/i.test(String((e && e.message) || e))) toast('ارسال فایل ممکن نشد');
      return false;
    }
  }
  const oldClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && String(this.href).startsWith('blob:')) {
      const name = this.download;
      fetch(this.href).then(r => r.blob()).then(b => outFile(b, name));
      return;
    }
    return oldClick.call(this);
  };

  /* ---------- اسکنر بارکد (ML Kit، آفلاین) ---------- */
  let listener = null;
  window.stopScan = async function () {
    document.documentElement.classList.remove('scanning');
    document.body.classList.remove('scanning', 'barcode-scanner-active');
    document.getElementById('scan').style.display = 'none';
    try { if (listener) { await listener.remove(); listener = null; } await BS.stopScan(); } catch (e) {}
  };
  window.scan = async function (cb) {
    try {
      const s = await BS.isSupported();
      if (!s.supported) { toast('اسکنر روی این دستگاه پشتیبانی نمی‌شود؛ بارکد را دستی وارد کنید'); return; }
      let p = await BS.checkPermissions();
      if (p.camera !== 'granted') p = await BS.requestPermissions();
      if (p.camera !== 'granted') { toast('دسترسی به دوربین داده نشد'); return; }
      document.documentElement.classList.add('scanning');
      document.body.classList.add('scanning', 'barcode-scanner-active');
      document.getElementById('scan').style.display = 'flex';
      let done = false;
      listener = await BS.addListener('barcodesScanned', async ev => {
        const code = ev.barcodes && ev.barcodes[0] && ev.barcodes[0].rawValue;
        if (!code || done) return;
        done = true;
        await window.stopScan();
        navigator.vibrate && navigator.vibrate(60);
        cb(code);
      });
      await BS.startScan();
    } catch (e) {
      await window.stopScan();
      toast('اسکن ممکن نشد؛ بارکد را دستی وارد کنید');
    }
  };

  /* ---------- تایپ صوتی فارسی ---------- */
  let micOn = null;
  window.nativeMic = function (el, btn) {
    (async () => {
      if (micOn) { try { await SP.stop(); } catch (e) {} return; }
      try {
        const a = await SP.available();
        if (!a.available) { toast('تشخیص گفتار در این گوشی نصب/فعال نیست'); return; }
        const pm = await SP.requestPermissions();
        if (pm.speechRecognition !== 'granted') { toast('دسترسی به میکروفون داده نشد'); return; }
        const base = el.value ? el.value.trimEnd() + ' ' : '';
        btn.classList.add('on');
        const l1 = await SP.addListener('partialResults', e => {
          const t = (e.matches || [])[0] || '';
          el.value = base + t;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const l2 = await SP.addListener('listeningState', e => {
          if (e.status === 'stopped') {
            btn.classList.remove('on');
            l1.remove(); l2.remove(); micOn = null;
          }
        });
        micOn = true;
        await SP.start({ language: 'fa-IR', maxResults: 1, partialResults: true, popup: false });
      } catch (e) {
        btn.classList.remove('on'); micOn = null;
        toast('تایپ صوتی انجام نشد؛ دوباره امتحان کنید');
      }
    })();
    return true;
  };

  /* ---------- دکمه بازگشت اندروید ---------- */
  AP.addListener('backButton', () => {
    if (document.getElementById('scan').style.display === 'flex') return closeScan();
    if (!document.getElementById('sheet').classList.contains('hide')) return closeSheet();
    if (!document.getElementById('t-home').classList.contains('hide')) return AP.exitApp();
    go('home');
  });

  /* ---------- نوار وضعیت ---------- */
  try { SB.setBackgroundColor({ color: '#0f1a3a' }); SB.setStyle({ style: 'DARK' }); } catch (e) {}
})();
