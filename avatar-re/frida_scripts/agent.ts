// frida-il2cpp-bridge — hook logic game com.TeaM.Avatar (Unity IL2CPP)
// Build:  npm run build     → _agent.js
// Run:    frida -U -f com.TeaM.Avatar -l _agent.js
import "frida-il2cpp-bridge";

Il2Cpp.perform(() => {
    console.log("[+] Il2Cpp attached, unityVersion =", Il2Cpp.unityVersion);
    const img = Il2Cpp.domain.assembly("Assembly-CSharp").image;

    // ---------- 1) Giao thức: bắt byte trước/sau khi mã hóa ----------
    try {
        const Session = img.class("Session_ME");
        Session.method("writeKey").implementation = function (b: any) {
            const enc = this.method("writeKey").invoke(b);
            console.log(`[TX] plain=${b} -> enc=${enc}`);
            return enc;
        };
        Session.method("readKey").implementation = function (b: any) {
            const dec = this.method("readKey").invoke(b);
            console.log(`[RX] enc=${b} -> plain=${dec}`);
            return dec;
        };
        // Xem command của mỗi gói gửi đi
        Session.method("doSendMessage").implementation = function (m: any) {
            try { console.log("[SEND] command =", m.field("command").value); } catch (e) {}
            return this.method("doSendMessage").invoke(m);
        };
        console.log("[+] hooked Session_ME.writeKey/readKey/doSendMessage");
    } catch (e) { console.log("[!] Session_ME hook:", e); }

    // ---------- 2) Bắt credential đăng nhập ----------
    try {
        const Login = img.class("LoginScr");
        ["doLogin", "login"].forEach((name) => {
            try {
                Login.method(name).implementation = function (...a: any[]) {
                    try {
                        const u = this.field("tfUser").value;
                        const p = this.field("tfPass").value;
                        console.log(`[LOGIN] ${name}  user=${u}  pass=${p}`);
                    } catch (e) {}
                    return this.method(name).invoke(...a);
                };
            } catch (e) {}
        });
        console.log("[+] hooked LoginScr.doLogin/login");
    } catch (e) { console.log("[!] LoginScr hook:", e); }

    // ---------- 3) Bypass anti-cheat (client-side) ----------
    try {
        const AC = img.class("AntiCheat");
        AC.method("HackDetected").implementation = function (type: any) {
            console.log("[AntiCheat] HackDetected type=", type, "-> nuốt");
            // no-op: không báo cáo, không xử lý
        };
        // ép cờ detected = false nếu cần
        try { AC.field("detected").value = false; } catch (e) {}
        console.log("[+] AntiCheat.HackDetected -> no-op");
    } catch (e) { console.log("[!] AntiCheat hook:", e); }
});
