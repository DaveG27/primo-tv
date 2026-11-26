package com.primotv.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;

import androidx.tvprovider.media.tv.PreviewChannel;
import androidx.tvprovider.media.tv.PreviewChannelHelper;
import androidx.tvprovider.media.tv.PreviewProgram;
import androidx.tvprovider.media.tv.TvContractCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Android TV / Google TV home screen: a "PRIMO TV · Favourites" row with your favourite channels.
 * Fire TV doesn't support these rows, so this quietly does nothing there.
 */
final class TvRow {
    private TvRow() {}

    static boolean supported(Context c) {
        return Build.VERSION.SDK_INT >= 26 && c.getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK)
                && !"Amazon".equalsIgnoreCase(Build.MANUFACTURER);
    }

    static void update(Context c, String favsJson) {
        if (!supported(c)) return;
        try {
            SharedPreferences prefs = c.getSharedPreferences("tvrow", Context.MODE_PRIVATE);
            PreviewChannelHelper helper = new PreviewChannelHelper(c);
            long channelId = prefs.getLong("channel", -1);
            if (channelId == -1 || helper.getPreviewChannel(channelId) == null) {
                Bitmap logo = BitmapFactory.decodeResource(c.getResources(), R.mipmap.ic_launcher);
                PreviewChannel channel = new PreviewChannel.Builder()
                        .setDisplayName("PRIMO TV · Favourites")
                        .setAppLinkIntentUri(Uri.parse("primotv://open"))
                        .setLogo(logo)
                        .build();
                channelId = helper.publishChannel(channel);
                TvContractCompat.requestChannelBrowsable(c, channelId);
                prefs.edit().putLong("channel", channelId).putString("programs", "[]").apply();
            }
            JSONArray old = new JSONArray(prefs.getString("programs", "[]"));
            for (int i = 0; i < old.length(); i++) {
                try { helper.deletePreviewProgram(old.getLong(i)); } catch (Exception ignored) { }
            }
            Uri fallback = Uri.parse("android.resource://" + c.getPackageName() + "/drawable/banner");
            JSONArray favs = new JSONArray(favsJson == null ? "[]" : favsJson);
            JSONArray ids = new JSONArray();
            for (int i = 0; i < favs.length() && ids.length() < 20; i++) {
                JSONObject f = favs.getJSONObject(i);
                String logo = f.optString("logo", "");
                PreviewProgram p = new PreviewProgram.Builder()
                        .setChannelId(channelId)
                        .setType(TvContractCompat.PreviewPrograms.TYPE_CHANNEL)
                        .setTitle(f.optString("name"))
                        .setDescription(f.optString("now", "Live"))
                        .setPosterArtUri(logo.startsWith("http") ? Uri.parse(logo) : fallback)
                        .setPosterArtAspectRatio(TvContractCompat.PreviewPrograms.ASPECT_RATIO_16_9)
                        .setLive(true)
                        .setIntentUri(Uri.parse("primotv://play?id=" + Uri.encode(f.optString("id"))))
                        .build();
                ids.put(helper.publishPreviewProgram(p));
            }
            prefs.edit().putString("programs", ids.toString()).apply();
        } catch (Exception ignored) {
            // The TV launcher may not support preview channels; the app works without them.
        }
    }
}
