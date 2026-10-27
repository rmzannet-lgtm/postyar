// بعد از "npx cap add android" اجرا می‌شود: مجوزها و تنظیمات لازم را به پروژه اندروید اضافه می‌کند.
const fs = require('fs');
const path = require('path');
const a = path.join(__dirname, '..', 'android');

// ۱) AndroidManifest: مجوزهای دوربین، میکروفون و ...
const mf = path.join(a, 'app', 'src', 'main', 'AndroidManifest.xml');
let m = fs.readFileSync(mf, 'utf8');
const add = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.microphone" android:required="false" />'
].filter(x => !m.includes(x.match(/android:name="([^"]+)"/)[1]));
if (add.length) m = m.replace('<application', add.join('\n    ') + '\n\n    <application');
if (!m.includes('android.speech.RecognitionService')) {
  m = m.replace('</manifest>', '    <queries>\n        <intent>\n            <action android:name="android.speech.RecognitionService" />\n        </intent>\n    </queries>\n</manifest>');
}
// فقط عمودی (مناسب موبایل)
if (!m.includes('screenOrientation')) m = m.replace('<activity', '<activity\n            android:screenOrientation="portrait"');
fs.writeFileSync(mf, m);
console.log('✓ AndroidManifest.xml');

// ۲) حداقل SDK برای ML Kit / CameraX
const vg = path.join(a, 'variables.gradle');
let v = fs.readFileSync(vg, 'utf8');
v = v.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 24');
fs.writeFileSync(vg, v);
console.log('✓ variables.gradle (minSdk 24)');
