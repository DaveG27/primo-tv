package com.primotv.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

/** A reminder is due: pop up over PRIMO TV if it's open, otherwise post a notification. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String id = intent.getStringExtra("id");
        if (id == null) return;
        JSONObject r = Reminders.take(c, id);
        if (r == null) return;
        final String title = r.optString("title", "Starting soon");
        final String text = r.optString("text", "");
        final String url = r.optString("url", "");

        Activity a = Reminders.top.get();
        if (a != null && !a.isFinishing()) {
            a.runOnUiThread(() -> {
                try {
                    new AlertDialog.Builder(a)
                            .setTitle(title)
                            .setMessage(text)
                            .setPositiveButton("Watch now", (d, w) -> watch(a, url))
                            .setNegativeButton("Not now", null)
                            .show();
                } catch (Exception ignored) { }
            });
            return;
        }

        Reminders.ensureChannel(c);
        Intent open = new Intent(c, MainActivity.class);
        open.putExtra("play", url);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(c, id.hashCode(), open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, Reminders.CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(text)
                .setAutoCancel(true)
                .setContentIntent(tap);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            try { nm.notify(id.hashCode(), b.build()); } catch (SecurityException ignored) { }
        }
    }

    static void watch(Activity a, String url) {
        if (url == null || url.isEmpty()) return;
        Intent i = new Intent(a, PlayerActivity.class);
        i.putExtra(PlayerActivity.EXTRA_URL, url);
        a.startActivity(i);
        if (a instanceof PlayerActivity) a.finish();
    }
}
