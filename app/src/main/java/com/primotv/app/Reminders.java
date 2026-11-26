package com.primotv.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.util.Iterator;

/** "Remind me" for programmes: stored here and woken up by AlarmManager a minute before they start. */
final class Reminders {
    static final String CHANNEL = "reminders";
    private static final String PREFS = "reminders";
    /** The PRIMO TV screen in front right now (main screen or player), so a reminder can pop up over it. */
    static WeakReference<Activity> top = new WeakReference<>(null);

    private Reminders() {}

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static JSONObject all(Context c) {
        try { return new JSONObject(prefs(c).getString("all", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    private static void save(Context c, JSONObject o) { prefs(c).edit().putString("all", o.toString()).apply(); }

    static void set(Context c, String id, long at, String title, String text, String url) {
        try {
            JSONObject o = all(c);
            JSONObject r = new JSONObject();
            r.put("at", at); r.put("title", title); r.put("text", text); r.put("url", url);
            o.put(id, r);
            save(c, o);
            schedule(c, id, at);
        } catch (Exception ignored) {}
    }

    static void cancel(Context c, String id) {
        JSONObject o = all(c);
        o.remove(id);
        save(c, o);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(c, id));
    }

    static JSONObject take(Context c, String id) {
        JSONObject o = all(c);
        JSONObject r = o.optJSONObject(id);
        o.remove(id);
        save(c, o);
        return r;
    }

    static void rescheduleAll(Context c) {
        JSONObject o = all(c);
        long now = System.currentTimeMillis();
        JSONObject keep = new JSONObject();
        Iterator<String> keys = o.keys();
        while (keys.hasNext()) {
            String id = keys.next();
            JSONObject r = o.optJSONObject(id);
            if (r == null || r.optLong("at") + 30 * 60000 <= now) continue;
            try { keep.put(id, r); } catch (Exception ignored) {}
            schedule(c, id, r.optLong("at"));
        }
        save(c, keep);
    }

    private static PendingIntent pending(Context c, String id) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.setAction("com.primotv.app.REMIND." + id.hashCode());
        i.putExtra("id", id);
        return PendingIntent.getBroadcast(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void schedule(Context c, String id, long at) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long when = Math.max(System.currentTimeMillis() + 2000, at - 60000);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pending(c, id));
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
                nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Programme reminders", NotificationManager.IMPORTANCE_HIGH));
            }
        }
    }
}
