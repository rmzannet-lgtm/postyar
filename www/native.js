/* پل بین وب‌اپ و قابلیت‌های بومی اندروید (فقط داخل اپ نصب‌شده فعال می‌شود) */
(() => {
  const C0 = window.Capacitor;
  if (!C0) return; /* مرورگر معمولی */
  const go_ = () => boot(window.Capacitor);
  if (typeof C0.registerPlugin === 'function') go_();
  else {
    /* هسته Capacitor هنوز بارگذاری نشده: خودمان بارگذاری می‌کنیم (اگر نبود، حالت جایگزین) */
    const s = document.createElement('script');
    s.src = 'vendor/capacitor.js';
    s.onload = go_; s.onerror = go_;
    document.head.appendChild(s);
  }

  function boot(C) {
  const plat = C.getPlatform ? C.getPlatform() : (C.isNative ? 'android' : 'web');
  const isNative = C.isNativePlatform ? C.isNativePlatform() : (plat !== 'web' || !!C.PluginHeaders);
  if (!isNative) return;
  const P = n => (typeof C.registerPlugin === 'function')
    ? C.registerPlugin(n)
    : new Proxy({}, { get: (_, m) => (m === 'then' ? undefined : (o) => {
        if (m === 'addListener') return Promise.reject(new Error('listener'));
        return C.nativePromise(n, m, o || {});
      }) });
  const FS = P('Filesystem'), SH = P('Share'), ZX = P('ZxingScanner'),
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

  /* ---------- اسکنر بارکد (ZXing Android Embedded، آفلاین، تمام‌صفحه) ---------- */
  window.scan = async function (cb) {
    try {
      const r = await ZX.scan();
      if (r && r.text) {
        navigator.vibrate && navigator.vibrate(60);
        cb(r.text);
      }
      /* اگر کاربر با دکمه بازگشت خارج شد، cb صدا زده نمی‌شود و اسکن پشت‌سرهم هم متوقف می‌شود */
    } catch (e) {
      toast('اسکن ممکن نشد: ' + String((e && (e.message || e.errorMessage)) || e).slice(0, 120));
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
  Promise.resolve(AP.addListener('backButton', () => {
    if (document.getElementById('scan').style.display === 'flex') return closeScan();
    if (!document.getElementById('sheet').classList.contains('hide')) return closeSheet();
    if (!document.getElementById('t-home').classList.contains('hide')) return AP.exitApp();
    go('home');
  })).catch(() => {});

  /* ---------- نوار وضعیت ---------- */
  try { SB.setBackgroundColor({ color: '#0f1a3a' }); SB.setStyle({ style: 'DARK' }); } catch (e) {}

  const t = document.getElementById('t-set');
  if (t) t.insertAdjacentHTML('beforeend', "<p class='hint' style='text-align:center'>نسخه بومی فعال است \u2713 (اسکنر ZXing)</p>");
  }
})();
