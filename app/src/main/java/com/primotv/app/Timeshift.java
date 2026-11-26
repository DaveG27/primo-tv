package com.primotv.app;

import android.net.Uri;

import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.datasource.BaseDataSource;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DataSpec;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Pause for live TV.
 *
 * The live channel is downloaded into a file on the box by a background thread, and the player
 * plays from that file. Pausing just stops the player reading - the download carries on - so
 * pressing Play continues exactly where you stopped instead of jumping to "now".
 * One connection to the provider, same as before. "Back to live" starts a fresh recording.
 */
public final class Timeshift {
    private final String url;
    private final File file;
    private final long maxBytes;
    private volatile long written = 0;
    private volatile boolean stop = false;
    private volatile boolean failed = false;
    private volatile int httpCode = 0;
    private volatile long startedAt = 0;
    private final Object lock = new Object();
    private Thread thread;
    private RandomAccessFile out;

    private final java.util.concurrent.atomic.AtomicLong counter;

    public Timeshift(String url, File dir, long maxBytes, java.util.concurrent.atomic.AtomicLong counter) {
        this.url = url;
        this.counter = counter;
        this.file = new File(dir, "timeshift.ts");
        this.maxBytes = maxBytes;
    }

    public void start() throws IOException {
        if (file.exists()) file.delete();
        out = new RandomAccessFile(file, "rw");
        startedAt = System.currentTimeMillis();
        thread = new Thread(this::run, "timeshift");
        thread.start();
    }

    private void run() {
        int attempts = 0;
        byte[] buf = new byte[64 * 1024];
        while (!stop) {
            HttpURLConnection c = null;
            long before = written;
            try {
                // Follow redirects ourselves: providers often bounce http -> https or to another server,
                // which Android won't follow on its own
                String u = url;
                for (int hop = 0; ; hop++) {
                    c = (HttpURLConnection) new URL(u).openConnection();
                    c.setRequestProperty("User-Agent", ProviderProxy.UA);
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    c.setInstanceFollowRedirects(false);
                    httpCode = c.getResponseCode();
                    if (httpCode >= 300 && httpCode < 400 && hop < 6) {
                        String loc = c.getHeaderField("Location");
                        c.disconnect();
                        if (loc == null) throw new IOException("Redirect without address");
                        u = new URL(new URL(u), loc).toString();
                        continue;
                    }
                    break;
                }
                if (httpCode >= 400) throw new IOException("HTTP " + httpCode);
                try (InputStream in = c.getInputStream()) {
                    int n;
                    while (!stop && (n = in.read(buf)) > 0) {
                        if (written == before) attempts = 0; // it's flowing
                        synchronized (lock) {
                            out.seek(written);
                            out.write(buf, 0, n);
                            written += n;
                            lock.notifyAll();
                        }
                        if (counter != null) counter.addAndGet(n);
                        {
                        }
                        if (written >= maxBytes) { // storage limit reached: stop recording
                            stop = true;
                            break;
                        }
                    }
                }
                if (written == before && !stop) throw new IOException("No data"); // connected but nothing came
            } catch (Exception e) {
                // dropped: reconnect (the stream picks up from "now"); a refusal is retried briefly too,
                // since the provider may still be closing the preview window's connection
                if (++attempts >= (written == 0 ? 3 : 6)) {
                    failed = true;
                    break;
                }
                try { Thread.sleep(1000L * attempts); } catch (InterruptedException ie) { break; }
            } finally {
                if (c != null) c.disconnect();
            }
        }
        synchronized (lock) {
            stop = true;
            lock.notifyAll();
        }
    }

    public void release() {
        stop = true;
        if (thread != null) thread.interrupt();
        synchronized (lock) {
            try { if (out != null) out.close(); } catch (IOException ignored) { }
            lock.notifyAll();
        }
        file.delete();
    }

    public long written() { return written; }
    public boolean failed() { return failed; }
    public int httpCode() { return httpCode; }
    public boolean recording() { return !stop; }

    /** Average bytes per second since the recording started (for "x minutes behind live"). */
    public double bytesPerSecond() {
        long ms = System.currentTimeMillis() - startedAt;
        return ms < 2000 ? 0 : written * 1000.0 / ms;
    }

    /** How far behind live the given read position is, in seconds (approximate). */
    public long secondsBehind(long readPos) {
        double r = bytesPerSecond();
        return r <= 0 ? 0 : (long) ((written - readPos) / r);
    }

    // ---------- the player reads the recording through this ----------

    volatile long lastReadPos = 0;

    public DataSource.Factory factory() {
        return () -> new Reader();
    }

    private final class Reader extends BaseDataSource {
        private RandomAccessFile in;
        private long pos;
        private Uri uri;

        Reader() { super(false); }

        @Override
        public long open(DataSpec spec) throws IOException {
            uri = spec.uri;
            pos = spec.position;
            in = new RandomAccessFile(file, "r");
            transferInitializing(spec);
            transferStarted(spec);
            return C.LENGTH_UNSET; // keeps growing
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            if (length == 0) return 0;
            long deadline = System.currentTimeMillis() + 15000;
            synchronized (lock) {
                while (written <= pos) {
                    if (failed) throw new IOException("The channel couldn't be recorded");
                    if (stop) return C.RESULT_END_OF_INPUT; // recording finished
                    long wait = deadline - System.currentTimeMillis();
                    if (wait <= 0) throw new IOException("No data from the channel");
                    try { lock.wait(Math.min(wait, 500)); } catch (InterruptedException e) { throw new IOException(e); }
                }
            }
            int n = (int) Math.min(length, written - pos);
            in.seek(pos);
            int r = in.read(buffer, offset, n);
            if (r > 0) {
                pos += r;
                lastReadPos = pos;
                bytesTransferred(r);
            }
            return r;
        }

        @Nullable
        @Override
        public Uri getUri() { return uri; }

        @Override
        public void close() throws IOException {
            if (in != null) { in.close(); in = null; }
            transferEnded();
        }
    }
}
