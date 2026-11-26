package com.primotv.app;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

/**
 * Posters and logos fetched by the app itself with the PRIMO user agent.
 * Some providers refuse browser requests, which left film posters blank.
 */
final class ImageProxy {
    private ImageProxy() {}

    /** Recently shown posters kept in memory (about 48 MB) so scrolling back doesn't download again. */
    private static final android.util.LruCache<String, Object[]> CACHE = new android.util.LruCache<String, Object[]>(48 * 1024 * 1024) {
        @Override protected int sizeOf(String k, Object[] v) { return ((byte[]) v[1]).length + 64; }
    };

    private static WebResourceResponse respond(String type, byte[] data) {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "max-age=86400");
        return new WebResourceResponse(type, null, 200, "OK", h, new ByteArrayInputStream(data));
    }

    static WebResourceResponse handle(WebResourceRequest req, String appHost) {
        if (!"GET".equalsIgnoreCase(req.getMethod())) return null;
        Uri u = req.getUrl();
        if (u == null || u.getHost() == null || u.getHost().equalsIgnoreCase(appHost)) return null;
        String scheme = u.getScheme();
        if (!"http".equals(scheme) && !"https".equals(scheme)) return null;
        String path = u.getPath() == null ? "" : u.getPath().toLowerCase();
        String accept = req.getRequestHeaders() == null ? null : req.getRequestHeaders().get("Accept");
        boolean image = path.matches(".*\\.(jpe?g|png|webp|gif|bmp)$") || (accept != null && accept.startsWith("image/"));
        if (!image) return null;
        Object[] hit = CACHE.get(u.toString());
        if (hit != null) return respond((String) hit[0], (byte[]) hit[1]);
        try {
            String url = u.toString();
            HttpURLConnection c = null;
            for (int hop = 0; hop < 4; hop++) {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(8000);
                c.setReadTimeout(12000);
                c.setRequestProperty("User-Agent", ProviderProxy.UA);
                int code = c.getResponseCode();
                if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                    url = new URL(new URL(url), c.getHeaderField("Location")).toString();
                    c.disconnect();
                    continue;
                }
                break;
            }
            if (c == null || c.getResponseCode() != 200) { if (c != null) c.disconnect(); return null; }
            String type = c.getContentType();
            if (type == null || !type.startsWith("image/")) type = "image/jpeg";
            InputStream in = c.getInputStream();
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] b = new byte[32768];
            int k;
            while ((k = in.read(b)) > 0) {
                bo.write(b, 0, k);
                if (bo.size() > 8 * 1024 * 1024) break;
            }
            in.close();
            c.disconnect();
            int semi = type.indexOf(';');
            String t = semi > 0 ? type.substring(0, semi) : type;
            byte[] data = bo.toByteArray();
            CACHE.put(u.toString(), new Object[] { t, data });
            return respond(t, data);
        } catch (Exception e) {
            return null;
        }
    }
}
