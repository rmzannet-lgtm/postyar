// کتابخانه‌ها و فونت را از node_modules داخل www/vendor کپی می‌کند تا اپ کاملاً آفلاین کار کند.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'www', 'vendor');
fs.mkdirSync(out, { recursive: true });

function copy(from, to) {
  const src = path.join(root, 'node_modules', from);
  if (!fs.existsSync(src)) { console.error('✗ پیدا نشد:', from); process.exitCode = 1; return false; }
  fs.copyFileSync(src, path.join(out, to));
  console.log('✓', to);
  return true;
}

copy('xlsx/dist/xlsx.full.min.js', 'xlsx.full.min.js');
copy('jszip/dist/jszip.min.js', 'jszip.min.js');

// هسته Capacitor برای صفحه وب (اگر نبود، اپ با حالت جایگزین کار می‌کند)
const capSrc = path.join(root, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js');
if (fs.existsSync(capSrc)) { fs.copyFileSync(capSrc, path.join(out, 'capacitor.js')); console.log('✓ capacitor.js'); }
else console.warn('! capacitor.js پیدا نشد؛ حالت جایگزین استفاده می‌شود');

// فونت وزیرمتن (محلی)
const RANGES = {
  arabic: 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0898-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC',
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
};
let css = '';
for (const w of [400, 600, 800]) {
  for (const sub of ['arabic', 'latin']) {
    const f = `vazirmatn-${sub}-${w}-normal.woff2`;
    const src = path.join(root, 'node_modules', '@fontsource', 'vazirmatn', 'files', f);
    if (!fs.existsSync(src)) { console.warn('! فونت پیدا نشد (جایگزین Tahoma می‌شود):', f); continue; }
    fs.copyFileSync(src, path.join(out, f));
    css += `@font-face{font-family:Vazirmatn;font-style:normal;font-weight:${w};font-display:swap;src:url(${f}) format('woff2');unicode-range:${RANGES[sub]}}\n`;
  }
}
fs.writeFileSync(path.join(out, 'fonts.css'), css);
console.log('✓ fonts.css');
