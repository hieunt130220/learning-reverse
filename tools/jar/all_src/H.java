/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class H
extends gM {
    private Vector do;
    private static final int[] do;

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    static {
        H.if();
    }

    private static void if() {
        do = new int[3];
        H.do[0] = "   ".length() & ~"   ".length();
        H.do[1] = 0x1C ^ 0x17 ^ (0x5E ^ 0x4B);
        H.do[2] = 0x6C ^ 0x36 ^ (4 ^ 0x76);
    }

    private void do(Vector vector) {
        Vector<cj> vector2 = new Vector<cj>();
        int n = do[0];
        while (H.if(n, this.do.size())) {
            cj cj2 = (cj)this.do.elementAt(n);
            ao_0 ao_02 = ac_0.do(cj2.do);
            if (H.do(ao_02) && H.do(ao_02.do, do[1]) && H.do(ao_02.do, do[2])) {
                vector2.addElement(cj2);
            }
            ++n;
            "".length();
            if ("  ".length() > ((6 ^ 0x4F ^ (0xED ^ 0xA8)) & (82 + 113 - 110 + 46 ^ 46 + 96 - 32 + 33 ^ -" ".length()))) continue;
            return;
        }
        if (H.if(fs.try, vector2.size())) {
            cj cj3 = (cj)vector2.elementAt(fs.try);
            if (H.if(dy_0.if(cj3.do) ? 1 : 0) && H.if(dy_0.do(cj3.do) ? 1 : 0)) {
                vector.addElement(new fn_0("Th\u00eam v\u00e0o d.s t\u1ef1 d\u00f9ng", new ek(cj3.do)));
                "".length();
                if (-" ".length() > " ".length()) {
                    return;
                }
            } else if (H.do(dy_0.if(cj3.do) ? 1 : 0)) {
                vector.addElement(new fn_0("X\u00f3a kh\u1ecfi d.s t\u1ef1 d\u00f9ng", new ek(cj3.do)));
            }
            if (H.if(dy_0.do(cj3.do) ? 1 : 0) && H.if(dy_0.if(cj3.do) ? 1 : 0)) {
                vector.addElement(new fn_0("Th\u00eam v\u00e0o d.s t\u1ef1 b\u1ecf", new ak(cj3.do)));
                return;
            }
            if (H.do(dy_0.do(cj3.do) ? 1 : 0)) {
                vector.addElement(new fn_0("X\u00f3a kh\u1ecfi d.s t\u1ef1 b\u1ecf", new ak(cj3.do)));
            }
        }
    }

    public H(fn_0 fn_02, Vector vector) {
        super(fn_02);
        this.do = vector;
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    public final void do() {
        Vector<Object> vector = new Vector<Object>();
        vector.addElement(this.do);
        this.do(vector);
        vector.addElement(new fn_0(bT.continue, new gl_0()));
        as.do().do(vector, do[0]);
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private static boolean do(Object object) {
        return object != null;
    }
}

