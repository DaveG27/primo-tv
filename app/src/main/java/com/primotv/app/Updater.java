package com.primotv.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * In-app updates. Asks a small control file where updates live (so they can move off GitHub
 * without anyone reinstalling), falls back to the latest GitHub release, then downloads the
 * APK and hands it to Android's installer.
 */
final class Updater {
    private static final String CONTROL = "https://primo-updates.vercel.app/primotv.json";
    private static final String DEFAULT_REPO = "DaveG27/primo-tv";
    private static final String INSTALL_ACTION = "com.primotv.app.INSTALL_RESULT";
    private static volatile boolean busy = false;
    private static BroadcastReceiver receiver;

    private Updater() {}

    static void check(Activity a, boolean userAsked) {
        if (busy) return;
        busy = true;
        new Thread(() -> {
            try {
                int latest = 0; String apk = null; String shown = null;
                JSONObject ctl = null;
                try { ctl = new JSONObject(get(CONTROL, null)); } catch (Exception ignored) { }
                if (ctl != null && ctl.optInt("build", 0) > 0 && ctl.optString("apk", "").startsWith("https://")) {
                    latest = ctl.optInt("build", 0); apk = ctl.optString("apk", ""); shown = ctl.optString("version", "");
                } else {
                    String repo = ctl != null ? ctl.optString("github", DEFAULT_REPO) : DEFAULT_REPO;
                    if (!repo.matches("[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")) repo = DEFAULT_REPO;
                    JSONObject rel = new JSONObject(get("https://api.github.com/repos/" + repo + "/releases/latest", "application/vnd.github+json"));
                    try { latest = Integer.parseInt(rel.optString("tag_name", "").replaceAll("[^0-9]", "")); } catch (Exception ignored) { }
                    JSONArray as = rel.optJSONArray("assets");
                    for (int i = 0; as != null && i < as.length(); i++) {
                        String u = as.getJSONObject(i).optString("browser_download_url", "");
                        if (u.endsWith(".apk")) { apk = u; break; }
                    }
                    Matcher m = Pattern.compile("(\\d+(?:\\.\\d+)+)").matcher(rel.optString("name", ""));
                    if (m.find()) shown = m.group(1);
                }
                int mine = a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionCode;
                if (apk == null || latest <= mine) {
                    busy = false;
                    if (userAsked) a.runOnUiThread(() -> Toast.makeText(a, "PRIMO TV is up to date (" + BuildConfig.VERSION_NAME + ")", Toast.LENGTH_LONG).show());
                    return;
                }
                final String url = apk;
                final String ver = (shown == null || shown.isEmpty()) ? "build " + latest : shown;
                a.runOnUiThread(() -> {
                    if (a.isFinishing()) { busy = false; return; }
                    new AlertDialog.Builder(a)
                            .setTitle("Update available")
                            .setMessage("PRIMO TV " + ver + " is ready. You have " + BuildConfig.VERSION_NAME + ".")
                            .setPositiveButton("Update now", (d, w) -> download(a, url))
                            .setNegativeButton("Later", (d, w) -> busy = false)
                            .setOnCancelListener(d -> busy = false)
                            .show();
                });
            } catch (Exception e) {
                busy = false;
                if (userAsked) a.runOnUiThread(() -> Toast.makeText(a, "Couldn't check for updates", Toast.LENGTH_LONG).show());
            }
        }).start();
    }

    private static void download(Activity a, String url) {
        if (Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) {
            busy = false;
            Toast.makeText(a, "Allow PRIMO TV to install apps, then press Back and choose Check for updates", Toast.LENGTH_LONG).show();
            try {
                a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName())));
            } catch (Exception ignored) { }
            return;
        }
        Toast.makeText(a, "Downloading the update…", Toast.LENGTH_LONG).show();
        register(a);
        new Thread(() -> {
            try {
                File f = new File(a.getCacheDir(), "update.apk");
                HttpURLConnection d = (HttpURLConnection) new URL(url).openConnection();
                d.setInstanceFollowRedirects(true);
                d.setConnectTimeout(20000); d.setReadTimeout(60000);
                d.setRequestProperty("User-Agent", "PRIMO TV");
                InputStream in = d.getInputStream();
                OutputStream out = new FileOutputStream(f);
                byte[] buf = new byte[65536]; int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                out.close(); in.close(); d.disconnect();
                PackageInstaller pi = a.getPackageManager().getPackageInstaller();
                int sid = pi.createSession(new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL));
                PackageInstaller.Session ses = pi.openSession(sid);
                OutputStream so = ses.openWrite("base.apk", 0, f.length());
                InputStream fi = new FileInputStream(f);
                while ((n = fi.read(buf)) > 0) so.write(buf, 0, n);
                fi.close(); ses.fsync(so); so.close();
                int fl = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= 31) fl |= PendingIntent.FLAG_MUTABLE;
                PendingIntent pend = PendingIntent.getBroadcast(a, sid, new Intent(INSTALL_ACTION).setPackage(a.getPackageName()), fl);
                ses.commit(pend.getIntentSender());
                ses.close();
            } catch (Exception e) {
                a.runOnUiThread(() -> Toast.makeText(a, "Update failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
            } finally {
                busy = false;
            }
        }).start();
    }

    private static void register(Activity a) {
        if (receiver != null) return;
        Context app = a.getApplicationContext();
        receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context ctx, Intent it) {
                int st = it.getIntExtra(PackageInstaller.EXTRA_STATUS, -999);
                if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                    Intent confirm = it.getParcelableExtra(Intent.EXTRA_INTENT);
                    if (confirm != null) {
                        confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        try { ctx.startActivity(confirm); } catch (Exception ignored) { }
                    }
                } else if (st != PackageInstaller.STATUS_SUCCESS) {
                    String m = it.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
                    Toast.makeText(ctx, "Update not installed" + (m == null ? "" : ": " + m), Toast.LENGTH_LONG).show();
                }
            }
        };
        IntentFilter flt = new IntentFilter(INSTALL_ACTION);
        if (Build.VERSION.SDK_INT >= 33) app.registerReceiver(receiver, flt, Context.RECEIVER_NOT_EXPORTED);
        else app.registerReceiver(receiver, flt);
    }

    private static String get(String url, String accept) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(10000); c.setReadTimeout(15000);
        c.setRequestProperty("User-Agent", "PRIMO TV");
        if (accept != null) c.setRequestProperty("Accept", accept);
        try {
            if (c.getResponseCode() != 200) throw new java.io.IOException("HTTP " + c.getResponseCode());
            InputStream in = c.getInputStream();
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] b = new byte[16384]; int k;
            while ((k = in.read(b)) > 0) bo.write(b, 0, k);
            in.close();
            return new String(bo.toByteArray(), "UTF-8");
        } finally { c.disconnect(); }
    }
}
