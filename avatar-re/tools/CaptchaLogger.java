import java.io.OutputStream;
import javax.microedition.io.Connector;
import javax.microedition.io.HttpConnection;
import javax.microedition.io.file.FileConnection;

/**
 * Helper injected into avatar-auto.jar to log captcha images.
 * Called from fJ.for(bm) after reading imageBytes (cmd -60).
 * Uploads to local avatar-web server and also saves to FileConnection.
 */
public class CaptchaLogger {
    // Primary upload URL - avatar-web default port 8787
    private static final String[] UPLOAD_URLS = {
        "http://127.0.0.1:8787/api/captcha/j2me-upload",
        "http://127.0.0.1:3000/api/captcha/j2me-upload",
        "http://127.0.0.1:8080/api/captcha/j2me-upload",
        "http://localhost:8787/api/captcha/j2me-upload"
    };

    public static void log(final byte[] data) {
        if (data == null || data.length == 0) {
            System.out.println("[CaptchaLogger] no data");
            return;
        }
        System.out.println("[CaptchaLogger] captcha bytes=" + data.length + " sha? first=" + toHex(data, 16));
        // Run in background thread to not block game
        try {
            new Thread(new Runnable() {
                public void run() {
                    doUpload(data);
                    doFileSave(data);
                }
            }).start();
        } catch (Throwable t) {
            // Fallback sync
            doUpload(data);
            doFileSave(data);
        }
    }

    private static void doUpload(byte[] data) {
        for (int i = 0; i < UPLOAD_URLS.length; i++) {
            String url = UPLOAD_URLS[i];
            HttpConnection hc = null;
            OutputStream os = null;
            try {
                hc = (HttpConnection) Connector.open(url);
                hc.setRequestMethod(HttpConnection.POST);
                hc.setRequestProperty("Content-Type", "image/png");
                hc.setRequestProperty("Content-Length", String.valueOf(data.length));
                // Some implementations require User-Agent
                // hc.setRequestProperty("User-Agent", "MicroEmulator");
                os = hc.openOutputStream();
                os.write(data);
                os.close();
                os = null;
                int rc = hc.getResponseCode();
                String msg = hc.getResponseMessage();
                System.out.println("[CaptchaLogger] upload to " + url + " rc=" + rc + " " + msg);
                if (rc >= 200 && rc < 300) {
                    // success, break
                    try { hc.close(); } catch (Exception e) {}
                    return;
                }
                hc.close();
            } catch (Throwable e) {
                System.out.println("[CaptchaLogger] upload fail " + url + ": " + e);
                if (e instanceof Exception) ((Exception)e).printStackTrace();
                try { if (os != null) os.close(); } catch (Exception ex) {}
                try { if (hc != null) hc.close(); } catch (Exception ex) {}
            }
        }
        System.out.println("[CaptchaLogger] all upload urls failed");
    }

    private static void doFileSave(byte[] data) {
        // Try multiple roots
        String[] roots = getRoots();
        for (int r = 0; r < roots.length; r++) {
            String base = roots[r];
            // Ensure base ends with /
            if (!base.endsWith("/")) base = base + "/";
            String path = base + "captcha-" + System.currentTimeMillis() + ".png";
            // Also try AngelChip subdir
            String[] candidates = new String[] {
                path,
                base + "AngelChip/captcha-" + System.currentTimeMillis() + ".png"
            };
            for (int c = 0; c < candidates.length; c++) {
                String url = candidates[c];
                // Must be file:///
                if (!url.startsWith("file:///")) {
                    if (url.startsWith("/")) url = "file://" + url;
                    else url = "file:///" + url;
                }
                FileConnection fc = null;
                OutputStream out = null;
                try {
                    fc = (FileConnection) Connector.open(url, Connector.WRITE);
                    if (!fc.exists()) fc.create();
                    // For some impl, need to truncate
                    out = fc.openOutputStream();
                    out.write(data);
                    out.close();
                    fc.close();
                    System.out.println("[CaptchaLogger] file saved: " + url);
                    return;
                } catch (Throwable e) {
                    System.out.println("[CaptchaLogger] file fail " + url + ": " + e);
                    try { if (out != null) out.close(); } catch (Exception ex) {}
                    try { if (fc != null) fc.close(); } catch (Exception ex) {}
                }
            }
        }
        System.out.println("[CaptchaLogger] all file saves failed");
    }

    private static String[] getRoots() {
        try {
            // Try FileSystemRegistry.listRoots()
            java.util.Enumeration e = javax.microedition.io.file.FileSystemRegistry.listRoots();
            java.util.Vector v = new java.util.Vector();
            while (e.hasMoreElements()) {
                String root = (String) e.nextElement();
                // root like "C:/" or "E:/" or "root/"
                v.addElement("file:///" + root);
            }
            if (v.size() > 0) {
                String[] arr = new String[v.size()];
                for (int i = 0; i < v.size(); i++) arr[i] = (String) v.elementAt(i);
                return arr;
            }
        } catch (Throwable t) {
            System.out.println("[CaptchaLogger] listRoots fail: " + t);
        }
        // fallback
        return new String[] { "file:///root/", "file:///E:/", "file:///C:/", "file:///SDCard/" };
    }

    private static String toHex(byte[] data, int max) {
        StringBuffer sb = new StringBuffer();
        int n = Math.min(data.length, max);
        for (int i = 0; i < n; i++) {
            String h = Integer.toHexString(data[i] & 0xFF);
            if (h.length() == 1) sb.append('0');
            sb.append(h);
            sb.append(' ');
        }
        if (data.length > max) sb.append("...(" + data.length + ")");
        return sb.toString();
    }
}
