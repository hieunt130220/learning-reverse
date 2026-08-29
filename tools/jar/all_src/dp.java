/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class dp
extends fn_0 {
    private final int do;
    private final int if;
    private final cj do;
    private static final int[] do;

    static {
        dp.for();
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public final void do() {
        if (dp.do(fs.do ? 1 : 0) && dp.if(this.do, fs.try)) {
            ao_0 ao_02 = ac_0.do(this.do.do);
            fs.else();
            fs.do("ID: " + this.do.do);
            fs.do(bT.cz + (do[4] - this.do.do) + "%");
            String string = "";
            if (dp.if(ao_02.do, do[6])) {
                string = bT.bS;
                "".length();
                if (null != null) {
                    return;
                }
            } else if (dp.if(ao_02.do, do[7])) {
                string = bT.aR;
            }
            fs.do(string + ac_0.do(ao_02));
            if (dp.do(this.do.do) && dp.if(this.do.do.equals("") ? 1 : 0)) {
                fs.do(this.do.do);
            }
            if (dp.if(this.if)) {
                fs.do(bT.long[do[0]] + ": " + ac_0.do(ao_02));
                return;
            }
            if (dp.do(ao_02.int, do[8])) {
                byte by2;
                if (dp.for(ao_02.int)) {
                    by2 = ((da)ac_0.do((short)ao_02.int)).for;
                    "".length();
                    if ((0x48 ^ 0x15 ^ (0x11 ^ 0x49)) == 0) {
                        return;
                    }
                } else {
                    by2 = ((da)ao_02).for;
                }
                fs.do(bT.long[do[0]] + ": " + by2);
            }
        }
    }

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private static boolean for(int n) {
        return n >= 0;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    dp(String string, dh_0 dh_02, cj cj2, int n, int n2) {
        super(string, dh_02);
        this.do = cj2;
        this.do = n;
        this.if = n2;
    }

    private static void for() {
        do = new int[9];
        dp.do[0] = "  ".length();
        dp.do[1] = "   ".length();
        dp.do[2] = 0x17 ^ 0x4E ^ (0x13 ^ 0x4F);
        dp.do[3] = " ".length();
        dp.do[4] = 0xFD ^ 0x99;
        dp.do[5] = -(0xFFFF9BB9 & 0x6E77) & (0xFFFFBA3F & 0xB5FFFD);
        dp.do[6] = 0x7B ^ 0x40 ^ (0xA0 ^ 0x8F);
        dp.do[7] = 8 ^ 0x1A ^ (0x67 ^ 0x7F);
        dp.do[8] = -"  ".length();
    }

    public final void do(Graphics graphics, int n, int n2) {
        ac_0.do(this.do.do).if(graphics, n + fs.if / do[0], n2 + fs.if / do[0], do[1]);
        w.do(n + do[1], n2 + fs.if - do[1] * dH.this, fs.if - do[2], do[0] * dH.this, do[3], graphics);
        w.do(n + do[1], n2 + fs.if - do[1] * dH.this, fs.if - do[2] - this.do.do * (fs.if - do[2]) / do[4], do[0] * dH.this, do[5], graphics);
    }
}

