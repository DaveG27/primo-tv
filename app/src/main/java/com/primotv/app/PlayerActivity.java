package com.primotv.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.graphics.Color;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;
import android.content.SharedPreferences;
import java.util.Locale;
import androidx.media3.common.TrackSelectionParameters;

import androidx.media3.datasource.HttpDataSource;

import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.PlayerView;

/**
 * Native full-screen player. Plays HLS (.m3u8), MPEG-TS (.ts), MKV, MP4 etc.
 * Dolby audio is passed through to the TV/soundbar when the device supports it.
 */
public class PlayerActivity extends Activity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_LIST = "channels";   // JSON [{name,url},...] for channel up/down
    public static final String EXTRA_INDEX = "index";
    public static final String EXTRA_EPG = "epg";       // provider guide address, stream id added at the end

    private org.json.JSONArray channels;
    private int chIndex = -1;
    private int prevIndex = -1;
    private String epgBase;
    private android.widget.LinearLayout banner;
    private TextView bTitle, bNow, bNext, bTech;
    /** Bytes downloaded so far, and the measured rate (bits per second, smoothed). */
    private final java.util.concurrent.atomic.AtomicLong bytesIn = new java.util.concurrent.atomic.AtomicLong();
    private long lastBytes = 0, lastAt = 0;
    private double rateBps = 0;
    private android.widget.ProgressBar bBar;
    private final java.util.Map<String, org.json.JSONArray> epgCache = new java.util.HashMap<>();
    private final java.util.Map<String, Long> epgAt = new java.util.HashMap<>();
    private View errorView;

    private ExoPlayer player;
    private PlayerView view;
    private String url;
    private int retries = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        url = getIntent().getStringExtra(EXTRA_URL);
        if (url == null) { finish(); return; }
        try {
            String list = getIntent().getStringExtra(EXTRA_LIST);
            if (list != null) channels = new org.json.JSONArray(list);
            chIndex = getIntent().getIntExtra(EXTRA_INDEX, -1);
            epgBase = getIntent().getStringExtra(EXTRA_EPG);
        } catch (Exception e) {
            channels = null;
        }

        view = new PlayerView(this);
        view.setKeepScreenOn(true);
        view.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        view.setControllerShowTimeoutMs(3000);
        view.setControllerAutoShow(false);
        view.setShowSubtitleButton(true);
        setContentView(view);

        // Channel banner (bottom): number + name, now with progress, and next. Shown briefly after switching.
        banner = new android.widget.LinearLayout(this);
        banner.setOrientation(android.widget.LinearLayout.VERTICAL);
        banner.setPadding(36, 22, 36, 24);
        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setColor(Color.parseColor("#E60E1124"));
        bg.setCornerRadius(24);
        banner.setBackground(bg);
        bTitle = new TextView(this);
        bTitle.setTextColor(Color.WHITE);
        bTitle.setTextSize(24);
        bTitle.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        bNow = new TextView(this);
        bNow.setTextColor(Color.parseColor("#E6E9F2"));
        bNow.setTextSize(18);
        bNow.setPadding(0, 10, 0, 6);
        bBar = new android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bBar.setMax(1000);
        bNext = new TextView(this);
        bNext.setTextColor(Color.parseColor("#A9B0C6"));
        bNext.setTextSize(16);
        bNext.setPadding(0, 8, 0, 0);
        bTech = new TextView(this);
        bTech.setTextColor(Color.parseColor("#55B2F2"));
        bTech.setTextSize(15);
        bTech.setPadding(0, 10, 0, 0);
        banner.addView(bTitle);
        banner.addView(bNow);
        banner.addView(bBar, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 10));
        banner.addView(bNext);
        banner.addView(bTech);
        banner.setVisibility(View.GONE);
        android.widget.FrameLayout.LayoutParams bp = new android.widget.FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM);
        bp.setMargins(64, 0, 64, 48);
        ((ViewGroup) view.getParent()).addView(banner, bp);

        hideSystemUi();
        hideHandler.post(meter);
        start();
        if (channels != null && chIndex >= 0) showBanner();
    }

    private void start() {
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(ProviderProxy.UA)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(20000)
                .setTransferListener(new androidx.media3.datasource.TransferListener() {
                    @Override public void onTransferInitializing(androidx.media3.datasource.DataSource s, androidx.media3.datasource.DataSpec d, boolean net) { }
                    @Override public void onTransferStart(androidx.media3.datasource.DataSource s, androidx.media3.datasource.DataSpec d, boolean net) { }
                    @Override public void onBytesTransferred(androidx.media3.datasource.DataSource s, androidx.media3.datasource.DataSpec d, boolean net, int n) { if (net) bytesIn.addAndGet(n); }
                    @Override public void onTransferEnd(androidx.media3.datasource.DataSource s, androidx.media3.datasource.DataSpec d, boolean net) { }
                });

        DefaultRenderersFactory renderers = new DefaultRenderersFactory(this)
                .setEnableDecoderFallback(true)
                .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER);

        player = new ExoPlayer.Builder(this, renderers)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(this).setDataSourceFactory(http))
                .build();
        player.setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT);
        applySubtitles(subsOn());
        view.setPlayer(player);

        MediaItem.Builder item = new MediaItem.Builder().setUri(Uri.parse(url));
        String lower = url.toLowerCase();
        if (lower.contains(".m3u8") || lower.contains("output=m3u8") || lower.contains("output=hls")) {
            item.setMimeType(MimeTypes.APPLICATION_M3U8);
        }
        player.setMediaItem(item.build());

        player.addListener(new Player.Listener() {
            @Override
            public void onPlayerError(PlaybackException error) {
                // Live streams drop now and then – retry a few times before giving up.
                if (retries < 3) {
                    retries++;
                    player.seekToDefaultPosition();
                    player.prepare();
                    return;
                }
                // Live channel failed as .m3u8: many providers only serve .ts – try that once.
                String alt = fallbackUrl(url);
                if (alt != null) {
                    url = alt;
                    retries = 0;
                    player.release();
                    start();
                    return;
                }
                showError(error);
            }

            // Remember if subtitles were switched on/off with the on-screen CC button.
            @Override
            public void onTrackSelectionParametersChanged(TrackSelectionParameters p) {
                boolean on = !p.disabledTrackTypes.contains(C.TRACK_TYPE_TEXT);
                if (on != subsOn()) prefs().edit().putBoolean("subs_on", on).apply();
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (isPlaying) scheduleHide();
                else view.showController();
            }

            @Override
            public void onVideoSizeChanged(androidx.media3.common.VideoSize vs) {
                // The real picture size is known now: refresh the quality shown in the banner.
                if (banner.getVisibility() == View.VISIBLE && channels != null && chIndex >= 0) {
                    try {
                        org.json.JSONObject ch = channels.getJSONObject(chIndex);
                        bTech.setText(techLine());
                    } catch (Exception ignored) { }
                }
            }

            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) retries = 0;
                if (state == Player.STATE_ENDED) finish();
            }
        });

        player.setPlayWhenReady(true);
        player.prepare();
    }

    private final android.os.Handler hideHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable hideRunnable = () -> {
        if (player != null && player.isPlaying() && view != null) view.hideController();
    };

    /** Hide the on-screen controls a few seconds after the last button press while playing. */
    private void scheduleHide() {
        hideHandler.removeCallbacks(hideRunnable);
        hideHandler.postDelayed(hideRunnable, 3500);
    }

    // ---------- Subtitles ----------

    private SharedPreferences prefs() {
        return getSharedPreferences("player", MODE_PRIVATE);
    }

    private boolean subsOn() {
        return prefs().getBoolean("subs_on", false);
    }

    private void applySubtitles(boolean on) {
        String lang = Locale.getDefault().getLanguage();
        player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon()
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, !on)
                .setPreferredTextLanguages(lang, "en")
                .setSelectUndeterminedTextLanguage(true)
                .setIgnoredTextSelectionFlags(0)
                .build());
    }

    private void toggleSubtitles() {
        if (!player.getCurrentTracks().containsType(C.TRACK_TYPE_TEXT)) {
            Toast.makeText(this, "No subtitles available for this", Toast.LENGTH_SHORT).show();
            return;
        }
        boolean on = !subsOn();
        prefs().edit().putBoolean("subs_on", on).apply();
        applySubtitles(on);
        Toast.makeText(this, on ? "Subtitles on" : "Subtitles off", Toast.LENGTH_SHORT).show();
    }

    /** Stays on screen with the exact reason so it can be read from the sofa. Back closes it. */
    private void showError(PlaybackException error) {
        String detail = error.getErrorCodeName();
        Throwable c = error.getCause();
        while (c != null) {
            if (c instanceof HttpDataSource.InvalidResponseCodeException) {
                int code = ((HttpDataSource.InvalidResponseCodeException) c).responseCode;
                detail = "Provider refused the stream (HTTP " + code + ")";
                break;
            }
            if (c instanceof HttpDataSource.HttpDataSourceException && c.getCause() != null) {
                detail = "Network: " + c.getCause().getClass().getSimpleName() + " " + c.getCause().getMessage();
            }
            c = c.getCause();
        }
        String host = Uri.parse(url).getHost();
        String type = url.contains(".m3u8") ? "m3u8" : url.contains(".ts") ? "ts" : "file";

        TextView t = new TextView(this);
        t.setText("Couldn't play this stream\n\n" + detail + "\n\nServer: " + host + "   Type: " + type
                + "\n\nPress Back to return");
        t.setTextColor(Color.WHITE);
        t.setTextSize(24);
        t.setGravity(Gravity.CENTER);
        t.setBackgroundColor(Color.parseColor("#E6000000"));
        if (errorView != null) ((ViewGroup) errorView.getParent()).removeView(errorView);
        errorView = t;
        if (channels != null) t.setText(t.getText() + "\n\nUp/Down to change channel");
        ((ViewGroup) view.getParent()).addView(t, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (player != null) player.stop();
    }

    // ---------- Channel up/down ----------

    private final Runnable hideBanner = () -> banner.setVisibility(View.GONE);

    private void showBanner() {
        try {
            org.json.JSONObject ch = channels.getJSONObject(chIndex);
            bTitle.setText(ch.optInt("num", chIndex + 1) + "   " + ch.optString("name", ""));
            bTech.setText(techLine());
            String id = ch.optString("id", "");
            fillGuide(id);
            banner.setVisibility(View.VISIBLE);
            hideHandler.removeCallbacks(hideBanner);
            hideHandler.postDelayed(hideBanner, 5000);
            if (!id.isEmpty() && epgBase != null) {
                Long at = epgAt.get(id);
                if (at == null || System.currentTimeMillis() - at > 10 * 60000) loadGuide(id);
            }
        } catch (Exception ignored) { }
    }

    /** "  ·  1080p 50fps" from the stream actually playing, once it's known. */
    private String resLabel() {
        try {
            androidx.media3.common.Format f = player == null ? null : player.getVideoFormat();
            if (f == null || f.height <= 0) return "";
            String q = f.height >= 2000 ? "4K" : f.height >= 1000 ? "FHD" : f.height >= 700 ? "HD" : "SD";
            String fps = f.frameRate > 0 ? " " + Math.round(f.frameRate) + "fps" : "";
            return "    [" + q + " · " + f.height + "p" + fps + "]";
        } catch (Exception e) { return ""; }
    }

    private final Runnable meter = new Runnable() {
        @Override public void run() {
            long now = System.currentTimeMillis(), b = bytesIn.get();
            if (lastAt > 0 && now > lastAt) {
                double r = (b - lastBytes) * 8000.0 / (now - lastAt);
                rateBps = rateBps <= 0 ? r : rateBps * 0.6 + r * 0.4;
            }
            lastBytes = b; lastAt = now;
            if (banner != null && banner.getVisibility() == View.VISIBLE) bTech.setText(techLine());
            hideHandler.postDelayed(this, 1000);
        }
    };

    /** "Full HD · 1920×1080 · 50 fps · using 6.2 Mbps" */
    private String techLine() {
        StringBuilder sb = new StringBuilder();
        try {
            androidx.media3.common.Format f = player == null ? null : player.getVideoFormat();
            if (f != null && f.height > 0) {
                String q = f.height >= 2000 ? "4K" : f.height >= 1000 ? "Full HD" : f.height >= 700 ? "HD" : "SD";
                sb.append(q).append("  ·  ").append(f.width).append("×").append(f.height);
                if (f.frameRate > 0) sb.append("  ·  ").append(Math.round(f.frameRate)).append(" fps");
            } else sb.append("Picture quality: checking…");
        } catch (Exception ignored) { }
        if (rateBps > 0) sb.append(String.format(Locale.UK, "  ·  using %.1f Mbps", rateBps / 1e6));
        return sb.toString();
    }

    private static final java.text.SimpleDateFormat HM = new java.text.SimpleDateFormat("HH:mm", Locale.UK);

    /** Now / next lines from the cached guide for this channel. */
    private void fillGuide(String id) {
        org.json.JSONArray L = epgCache.get(id);
        long now = System.currentTimeMillis();
        org.json.JSONObject cur = null, nxt = null;
        for (int i = 0; L != null && i < L.length(); i++) {
            org.json.JSONObject it = L.optJSONObject(i);
            if (it == null) continue;
            long s = it.optLong("s"), e = it.optLong("e");
            if (s <= now && now < e) cur = it;
            else if (s > now && (nxt == null || s < nxt.optLong("s"))) nxt = it;
        }
        if (cur != null) {
            long s = cur.optLong("s"), e = cur.optLong("e");
            bNow.setText("Now   " + HM.format(new java.util.Date(s)) + " – " + HM.format(new java.util.Date(e)) + "   " + cur.optString("t"));
            bBar.setProgress((int) Math.max(0, Math.min(1000, (now - s) * 1000 / Math.max(1, e - s))));
            bBar.setVisibility(View.VISIBLE);
        } else {
            bNow.setText(L == null && epgBase != null ? "Loading guide…" : "No guide information");
            bBar.setVisibility(View.GONE);
        }
        if (nxt != null) {
            bNext.setText("Next  " + HM.format(new java.util.Date(nxt.optLong("s"))) + "   " + nxt.optString("t"));
            bNext.setVisibility(View.VISIBLE);
        } else bNext.setVisibility(View.GONE);
    }

    private static String b64(String s) {
        try {
            String t = new String(android.util.Base64.decode(s, android.util.Base64.DEFAULT), "UTF-8");
            return t.isEmpty() ? s : t;
        } catch (Exception e) { return s; }
    }

    private void loadGuide(final String id) {
        epgAt.put(id, System.currentTimeMillis());
        new Thread(() -> {
            try {
                java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(epgBase + id).openConnection();
                c.setConnectTimeout(8000); c.setReadTimeout(10000);
                c.setRequestProperty("User-Agent", ProviderProxy.UA);
                java.io.InputStream in = c.getInputStream();
                java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                byte[] b = new byte[16384]; int k;
                while ((k = in.read(b)) > 0) bo.write(b, 0, k);
                in.close(); c.disconnect();
                org.json.JSONArray src = new org.json.JSONObject(bo.toString("UTF-8")).optJSONArray("epg_listings");
                org.json.JSONArray out = new org.json.JSONArray();
                for (int i = 0; src != null && i < src.length(); i++) {
                    org.json.JSONObject it = src.getJSONObject(i);
                    org.json.JSONObject o = new org.json.JSONObject();
                    o.put("s", it.optLong("start_timestamp") * 1000);
                    o.put("e", it.optLong("stop_timestamp") * 1000);
                    o.put("t", b64(it.optString("title", "")));
                    out.put(o);
                }
                runOnUiThread(() -> {
                    epgCache.put(id, out);
                    try {
                        if (channels != null && id.equals(channels.getJSONObject(chIndex).optString("id"))) fillGuide(id);
                    } catch (Exception ignored) { }
                });
            } catch (Exception ignored) {
                runOnUiThread(() -> { if (!epgCache.containsKey(id)) epgCache.put(id, new org.json.JSONArray()); });
            }
        }).start();
    }

    /** The banner, also for a single channel (e.g. from a reminder or Multiview). */
    private void showInfo() {
        if (channels != null && chIndex >= 0) { showBanner(); return; }
        bTitle.setText(getIntent().getStringExtra("title") != null ? getIntent().getStringExtra("title") : "Live TV");
        bNow.setText("");
        bBar.setVisibility(View.GONE);
        bNext.setVisibility(View.GONE);
        bTech.setText(techLine());
        banner.setVisibility(View.VISIBLE);
        hideHandler.removeCallbacks(hideBanner);
        hideHandler.postDelayed(hideBanner, 6000);
    }

    private boolean zap(int step) {
        if (channels == null || channels.length() < 2 || chIndex < 0) return false;
        int n = channels.length();
        return zapTo(((chIndex + step) % n + n) % n);
    }

    /** Back to the channel you were on before (like Sky's back-and-forth). */
    private boolean previous() {
        if (channels == null || prevIndex < 0 || prevIndex >= channels.length() || prevIndex == chIndex) {
            Toast.makeText(this, "No previous channel yet", Toast.LENGTH_SHORT).show();
            return true;
        }
        return zapTo(prevIndex);
    }

    private boolean zapTo(int index) {
        if (channels == null || index < 0 || index >= channels.length()) return false;
        if (index != chIndex) prevIndex = chIndex;
        rateBps = 0;
        chIndex = index;
        try {
            url = channels.getJSONObject(chIndex).getString("url");
        } catch (Exception e) {
            return false;
        }
        if (errorView != null) {
            ((ViewGroup) errorView.getParent()).removeView(errorView);
            errorView = null;
        }
        retries = 0;
        if (player != null) player.release();
        start();
        showBanner();
        return true;
    }

    /** Next format to try after a stream fails, or null when there's nothing left. */
    private static String fallbackUrl(String u) {
        if (u.contains("/live/") && u.contains(".m3u8")) return u.replace(".m3u8", ".ts");
        if ((u.contains("/movie/") || u.contains("/series/")) && u.matches(".*\\.m3u8(\\?.*)?$")) {
            return u.replaceAll("\\.m3u8", ".mp4");
        }
        return null;
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN && player != null) {
            scheduleHide();
            switch (event.getKeyCode()) {
                case KeyEvent.KEYCODE_CHANNEL_UP:
                case KeyEvent.KEYCODE_PAGE_UP:
                    if (zap(+1)) return true;
                    break;
                case KeyEvent.KEYCODE_CHANNEL_DOWN:
                case KeyEvent.KEYCODE_PAGE_DOWN:
                    if (zap(-1)) return true;
                    break;
                case KeyEvent.KEYCODE_DPAD_UP:
                    // Up = channel above in the list, like moving up the channel list
                    if ((errorView != null || !view.isControllerFullyVisible()) && zap(-1)) return true;
                    break;
                case KeyEvent.KEYCODE_DPAD_DOWN:
                    if ((errorView != null || !view.isControllerFullyVisible()) && zap(+1)) return true;
                    break;
                case KeyEvent.KEYCODE_MENU:
                case KeyEvent.KEYCODE_CAPTIONS:
                    toggleSubtitles();
                    return true;
                case KeyEvent.KEYCODE_DPAD_CENTER:
                case KeyEvent.KEYCODE_ENTER:
                    // Live TV: OK shows what's on, the picture quality and the data being used.
                    if (!player.isCurrentMediaItemSeekable() && !view.isControllerFullyVisible()) {
                        showInfo();
                        return true;
                    }
                    if (!view.isControllerFullyVisible()) {
                        player.setPlayWhenReady(!player.getPlayWhenReady());
                        view.showController();
                        return true;
                    }
                    break;
                case KeyEvent.KEYCODE_LAST_CHANNEL:
                    if (channels != null) return previous();
                    break;
                case KeyEvent.KEYCODE_INFO:
                    if (channels != null) { showBanner(); return true; }
                    break;
                case KeyEvent.KEYCODE_DPAD_LEFT:
                    // Live TV can't rewind, so Left flips back to the previous channel.
                    if (channels != null && !view.isControllerFullyVisible() && !player.isCurrentMediaItemSeekable()) return previous();
                    if (!view.isControllerFullyVisible() && player.isCurrentMediaItemSeekable()) {
                        player.seekTo(Math.max(0, player.getCurrentPosition() - 10000));
                        view.showController();
                        return true;
                    }
                    break;
                case KeyEvent.KEYCODE_DPAD_RIGHT:
                    if (!view.isControllerFullyVisible() && player.isCurrentMediaItemSeekable()) {
                        player.seekTo(player.getCurrentPosition() + 10000);
                        view.showController();
                        return true;
                    }
                    break;
            }
        }
        return view.dispatchKeyEvent(event) || super.dispatchKeyEvent(event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        Reminders.top = new java.lang.ref.WeakReference<>(this);
    }

    @Override
    public void onBackPressed() {
        finish();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) player.pause();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (player != null) player.play();
        hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        hideHandler.removeCallbacks(hideRunnable);
        hideHandler.removeCallbacks(hideBanner);
        hideHandler.removeCallbacks(meter);
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
}
