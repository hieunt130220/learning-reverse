// Bypass tổng quát tầng Java: SSL pinning + root detection
// Chạy: frida -U -f com.TeaM.Avatar -l bypass.js
Java.perform(function () {
    // --- SSL pinning: ép TrustManager chấp nhận mọi cert ---
    try {
        var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
        var SSLContext = Java.use('javax.net.ssl.SSLContext');
        var TM = Java.registerClass({
            name: 'org.re.TrustAll',
            implements: [X509TrustManager],
            methods: {
                checkClientTrusted: function () {},
                checkServerTrusted: function () {},
                getAcceptedIssuers: function () { return []; }
            }
        });
        var init = SSLContext.init.overload(
            '[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom');
        init.implementation = function (km, tm, sr) {
            console.log('[bypass] SSLContext.init -> TrustAll');
            init.call(this, km, [TM.$new()], sr);
        };
        console.log('[bypass] SSL pinning hook đã cài');
    } catch (e) { console.log('[bypass] SSL hook lỗi:', e); }

    // --- Root detection: che các file su/magisk phổ biến ---
    try {
        var File = Java.use('java.io.File');
        var suPaths = ['su', 'magisk', 'busybox', 'superuser'];
        File.exists.implementation = function () {
            var p = this.getAbsolutePath();
            for (var i = 0; i < suPaths.length; i++)
                if (p.toLowerCase().indexOf(suPaths[i]) !== -1) {
                    console.log('[bypass] ẩn file root:', p);
                    return false;
                }
            return this.exists();
        };
        console.log('[bypass] root-file hook đã cài');
    } catch (e) { console.log('[bypass] root hook lỗi:', e); }
});
