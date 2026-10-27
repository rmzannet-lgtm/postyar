// بعد از "npx cap add android" اجرا می‌شود (چندبار اجرا هم مشکلی ندارد):
// مجوزها، اسکنر ZXing (همان کتابخانه‌ی zxing-android-embedded) و تنظیمات اندروید را اضافه می‌کند.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const a = path.join(root, 'android');
const appId = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8')).appId;
const javaDir = path.join(a, 'app', 'src', 'main', 'java', ...appId.split('.'));
fs.mkdirSync(javaDir, { recursive: true });
const jstr = s => s.replace(/[^\x00-\x7f]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

/* ---------- ۱) AndroidManifest ---------- */
const mf = path.join(a, 'app', 'src', 'main', 'AndroidManifest.xml');
let m = fs.readFileSync(mf, 'utf8');
const perms = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.microphone" android:required="false" />'
].filter(x => !m.includes(x.match(/android:name="([^"]+)"/)[1]));
if (perms.length) m = m.replace('<application', perms.join('\n    ') + '\n\n    <application');
if (!m.includes('android.speech.RecognitionService')) {
  m = m.replace('</manifest>', '    <queries>\n        <intent>\n            <action android:name="android.speech.RecognitionService" />\n        </intent>\n    </queries>\n</manifest>');
}
if (!m.includes('screenOrientation')) m = m.replace('<activity', '<activity\n            android:screenOrientation="portrait"');
if (!m.includes('PortraitCaptureActivity')) {
  m = m.replace('</application>',
    `    <activity
            android:name="${appId}.PortraitCaptureActivity"
            android:screenOrientation="portrait"
            android:stateNotNeeded="true"
            android:theme="@style/zxing_CaptureTheme"
            android:windowSoftInputMode="stateAlwaysHidden" />
    </application>`);
}
fs.writeFileSync(mf, m);
console.log('✓ AndroidManifest.xml');

/* ---------- ۲) حداقل SDK ---------- */
const vg = path.join(a, 'variables.gradle');
fs.writeFileSync(vg, fs.readFileSync(vg, 'utf8').replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 24'));
console.log('✓ variables.gradle (minSdk 24)');

/* ---------- ۳) وابستگی ZXing ---------- */
const bg = path.join(a, 'app', 'build.gradle');
let g = fs.readFileSync(bg, 'utf8');
if (!g.includes('zxing-android-embedded')) {
  g = g.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.journeyapps:zxing-android-embedded:4.3.0'");
  fs.writeFileSync(bg, g);
}
console.log('✓ app/build.gradle (zxing-android-embedded:4.3.0)');

/* ---------- ۴) کدهای جاوا ---------- */
fs.writeFileSync(path.join(javaDir, 'PortraitCaptureActivity.java'),
`package ${appId};

import com.journeyapps.barcodescanner.CaptureActivity;

public class PortraitCaptureActivity extends CaptureActivity {
}
`);

fs.writeFileSync(path.join(javaDir, 'ZxingScannerPlugin.java'),
`package ${appId};

import android.Manifest;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.journeyapps.barcodescanner.ScanIntentResult;
import com.journeyapps.barcodescanner.ScanOptions;

@CapacitorPlugin(name = "ZxingScanner", permissions = { @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera") })
public class ZxingScannerPlugin extends Plugin {

    @PluginMethod
    public void scan(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraResult");
            return;
        }
        start(call);
    }

    @PermissionCallback
    private void cameraResult(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            start(call);
        } else {
            call.reject("camera permission denied");
        }
    }

    private void start(PluginCall call) {
        ScanOptions o = new ScanOptions();
        o.setDesiredBarcodeFormats(ScanOptions.ALL_CODE_TYPES);
        o.setCaptureActivity(PortraitCaptureActivity.class);
        o.setPrompt("${jstr('بارکد را داخل کادر بگیرید')}");
        o.setBeepEnabled(false);
        o.setBarcodeImageEnabled(false);
        Intent intent = o.createScanIntent(getContext());
        startActivityForResult(call, intent, "scanResult");
    }

    @ActivityCallback
    private void scanResult(PluginCall call, ActivityResult result) {
        ScanIntentResult r = ScanIntentResult.parseActivityResult(result.getResultCode(), result.getData());
        String text = r.getContents();
        JSObject ret = new JSObject();
        ret.put("text", text == null ? "" : text);
        ret.put("cancelled", text == null);
        call.resolve(ret);
    }
}
`);

fs.writeFileSync(path.join(javaDir, 'MainActivity.java'),
`package ${appId};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ZxingScannerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
console.log('✓ ZxingScannerPlugin / PortraitCaptureActivity / MainActivity');
