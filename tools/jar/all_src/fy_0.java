/*
 * Decompiled with CFR 0.152.
 */
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from fY
 */
public final class fy_0
extends hc {
    private long if;
    private long for;
    public static long do;
    private long byte;
    private static final int[] do;

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean do(int n) {
        return n > 0;
    }

    public final String toString() {
        return "Ng\u1ed3i T\u00f9";
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private static boolean for(int n) {
        return n < 0;
    }

    private static boolean int(int n) {
        return n != 0;
    }

    private static void new() {
        do = new int[12];
        fy_0.do[0] = -" ".length();
        fy_0.do[1] = 0x85 ^ 0x83;
        fy_0.do[2] = 0x64 ^ 0x6D;
        fy_0.do[3] = -(0xFFFFF4F9 & 0x7FCF) & (0xFFFFF5FE & 0x7FDB);
        fy_0.do[4] = 0x5C ^ 0x38;
        fy_0.do[5] = "  ".length();
        fy_0.do[6] = "  ".length() & ("  ".length() ^ -" ".length());
        fy_0.do[7] = 0x66 ^ 0x56 ^ (0x3F ^ 0x1D);
        fy_0.do[8] = 0x2D ^ 0x65 ^ (0xF8 ^ 0x8C);
        fy_0.do[9] = 0xFFFF9E91 & 0x6F7E;
        fy_0.do[10] = 0x1D ^ 5;
        fy_0.do[11] = 0x65 ^ 0x6F;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    protected final void if() {
        long l;
        if (fy_0.do(fy_0.do(System.currentTimeMillis() - this.try, 180000L))) {
            aq_0.else();
            aq_0.do(16000L);
            return;
        }
        if (fy_0.int(bx.do instanceof fo_0)) {
            return;
        }
        if (fy_0.do(fj.new, do[0])) {
            l = System.currentTimeMillis() - this.new;
            if (fy_0.for(fy_0.do(l, 2000L))) {
                aq_0.if(2000L - l);
                return;
            }
            gQ.do().do = do[1];
            fv_0.do().int(do[2]);
            if (fy_0.if(aq_0.else(30000L) ? 1 : 0)) {
                aq_0.else();
                aq_0.do(16000L);
                return;
            }
            aq_0.if(1000L);
            AngelChip.do.do(do[3], do[4]);
            fp.do().do(do[3], do[4], do[5], do[6]);
            this.for = System.currentTimeMillis();
        }
        if (fy_0.if(fj.new, do[7])) {
            aq_0.else();
            aq_0.do(16000L);
            return;
        }
        if (fy_0.new(fy_0.do(do, 0L))) {
            bx_0.do();
            aq_0.else();
            aq_0.do(16000L);
            return;
        }
        l = System.currentTimeMillis();
        do -= l - this.for;
        this.for = l;
        if (fy_0.do(fy_0.do(l - this.byte, 15000L))) {
            this.byte = l;
            fp.do().for(aq_0.if());
        }
        if (fy_0.do(fy_0.do(l - this.if, 30000L))) {
            this.if = l;
            this.try = l;
            AngelChip.do.do((int)AngelChip.do.int, AngelChip.do.for ? 1 : 0);
            fp.do().do((int)AngelChip.do.int, AngelChip.do.for ? 1 : 0, do[5], do[6]);
        }
    }

    public fy_0() {
        fy_0 fy_02 = this;
        fy_02.byte = fy_02.if = System.currentTimeMillis();
        fy_02.for = fy_02.if;
    }

    private static boolean new(int n) {
        return n <= 0;
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    public static String if() {
        String string;
        String string2;
        String string3;
        int n = (int)(do / 1000L);
        int n2 = n % do[8];
        int n3 = n / do[8] % do[8];
        n = n / do[9] % do[10];
        StringBuffer stringBuffer = new StringBuffer();
        if (fy_0.for(n, do[11])) {
            string3 = "0";
            "".length();
            if (-" ".length() >= " ".length()) {
                return null;
            }
        } else {
            string3 = "";
        }
        String string4 = stringBuffer.append(string3).append(n).toString();
        StringBuffer stringBuffer2 = new StringBuffer();
        if (fy_0.for(n3, do[11])) {
            string2 = "0";
            "".length();
            if (((0xF ^ 0x10 ^ (0x67 ^ 0x6B)) & (198 + 174 - 332 + 171 ^ 121 + 168 - 192 + 95 ^ -" ".length())) < 0) {
                return null;
            }
        } else {
            string2 = "";
        }
        String string5 = stringBuffer2.append(string2).append(n3).toString();
        StringBuffer stringBuffer3 = new StringBuffer();
        if (fy_0.for(n2, do[11])) {
            string = "0";
            "".length();
            if (-(0x16 ^ 0x12) >= 0) {
                return null;
            }
        } else {
            string = "";
        }
        String string6 = stringBuffer3.append(string).append(n2).toString();
        return string4 + ":" + string5 + ":" + string6;
    }

    private static boolean for(int n, int n2) {
        return n < n2;
    }

    static {
        fy_0.new();
        do = 0L;
    }
}

