package com.primotv.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.TextView;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.PlayerView;

import org.json.JSONArray;

/**
 * Multiview: 2 to 4 live channels on screen at once. Arrows pick a screen (its sound plays),
 * OK opens that channel full screen, Back leaves.
 */
public class MultiActivity extends Activity {
    public static final String EXTRA_LIST = "list";   // JSON [{name,url}]

    private ExoPlayer[] players;
    private FrameLayout[] tiles;
    private String[] urls, names;
    private int sel = 0, cols = 1;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        JSONArray list;
        try { list = new JSONArray(getIntent().getStringExtra(EXTRA_LIST)); } catch (Exception e) { finish(); return; }
        int n = Math.min(4, list.length());
        if (n < 1) { finish(); return; }
        urls = new String[n]; names = new String[n];
        for (int i = 0; i < n; i++) {
            urls[i] = list.optJSONObject(i).optString("url");
            names[i] = list.optJSONObject(i).optString("name");
        }
        cols = n == 1 ? 1 : 2;
        int rows = n <= 2 ? 1 : 2;

        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(cols);
        grid.setRowCount(rows);
        grid.setBackgroundColor(Color.BLACK);
        setContentView(grid);

        players = new ExoPlayer[n];
        tiles = new FrameLayout[n];
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(ProviderProxy.UA).setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000).setReadTimeoutMs(20000);
        for (int i = 0; i < n; i++) {
            FrameLayout tile = new FrameLayout(this);
            PlayerView pv = new PlayerView(this);
            pv.setUseController(false);
            pv.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
            tile.addView(pv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            TextView label = new TextView(this);
            label.setText(names[i]);
            label.setTextColor(Color.WHITE);
            label.setTextSize(15);
            label.setPadding(16, 8, 16, 8);
            label.setBackgroundColor(Color.parseColor("#AA000000"));
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.START);
            lp.setMargins(12, 12, 0, 0);
            tile.addView(label, lp);
            GridLayout.LayoutParams gp = new GridLayout.LayoutParams(
                    GridLayout.spec(i / cols, 1f), GridLayout.spec(i % cols, 1f));
            gp.width = 0; gp.height = 0;
            gp.setMargins(3, 3, 3, 3);
            grid.addView(tile, gp);
            tiles[i] = tile;

            // Small buffers: several streams at once is hard work for a TV stick.
            DefaultLoadControl load = new DefaultLoadControl.Builder().setBufferDurationsMs(4000, 15000, 1500, 2500).build();
            ExoPlayer p = new ExoPlayer.Builder(this).setLoadControl(load)
                    .setMediaSourceFactory(new DefaultMediaSourceFactory(this).setDataSourceFactory(http)).build();
            MediaItem.Builder mi = new MediaItem.Builder().setUri(Uri.parse(urls[i]));
            if (urls[i].contains(".m3u8")) mi.setMimeType(MimeTypes.APPLICATION_M3U8);
            p.setMediaItem(mi.build());
            p.prepare();
            p.setPlayWhenReady(true);
            pv.setPlayer(p);
            players[i] = p;
        }
        select(0);
        hideSystemUi();
    }

    private void select(int i) {
        sel = i;
        for (int k = 0; k < tiles.length; k++) {
            GradientDrawable fg = new GradientDrawable();
            fg.setColor(Color.TRANSPARENT);
            if (k == sel) fg.setStroke(8, Color.parseColor("#55B2F2"));
            tiles[k].setForeground(fg);
            players[k].setVolume(k == sel ? 1f : 0f);
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() != KeyEvent.ACTION_DOWN) return super.dispatchKeyEvent(e);
        int n = tiles.length;
        switch (e.getKeyCode()) {
            case KeyEvent.KEYCODE_DPAD_LEFT: if (sel % cols > 0) select(sel - 1); return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT: if (sel % cols < cols - 1 && sel + 1 < n) select(sel + 1); return true;
            case KeyEvent.KEYCODE_DPAD_UP: if (sel - cols >= 0) select(sel - cols); return true;
            case KeyEvent.KEYCODE_DPAD_DOWN: if (sel + cols < n) select(sel + cols); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER: {
                Intent i = new Intent(this, PlayerActivity.class);
                i.putExtra(PlayerActivity.EXTRA_URL, urls[sel]);
                startActivity(i);
                finish();
                return true;
            }
        }
        return super.dispatchKeyEvent(e);
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    protected void onResume() { super.onResume(); Reminders.top = new java.lang.ref.WeakReference<>(this); }

    @Override
    protected void onStop() {
        super.onStop();
        if (players != null) for (ExoPlayer p : players) if (p != null) p.release();
        players = null;
        finish();
    }
}
