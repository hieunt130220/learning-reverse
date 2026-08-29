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
final class hk
extends fn_0 {
    private final ez do;
    private static final int[] do;
    private final int do;

    hk(String string, dh_0 dh_02, ez ez2, int n) {
        super(string, dh_02);
        this.do = ez2;
        this.do = n;
    }

    public final void do(Graphics graphics, int n, int n2) {
        Object object = dT.do(this.do.for);
        bC.do(graphics, ((dI)object).do, n + fs.if / do[0], n2 + fs.if / do[0], do[1]);
        graphics.translate(do[2], cj_0.new);
        graphics.setClip(do[2], do[2], do[3] * fs.if, fs.do);
        if (hk.do(this.do, fs.try)) {
            n = do[2];
            while (hk.if(n, this.do.if.length)) {
                ei_0 ei_02;
                if (hk.if(this.do.if[n], do[4])) {
                    ei_02 = dT.do(this.do.if[n]);
                    bC.do((int)this.do.if[n]).do(graphics, do[5], fs.for / do[0] - this.do.if.length * do[6] * dH.this / do[0] + n * do[6] * dH.this + do[7] * (dH.this - do[8]), (fs.if << do[8]) + do[9] * dH.this + (dH.case << do[0]) + do[10] * (dH.this - do[8]), do[1]);
                    "".length();
                    if (((0xFD ^ 0xA1 ^ (0x69 ^ 0x75)) & (0x39 ^ 0x3E ^ (0x45 ^ 2) ^ -" ".length())) != 0) {
                        return;
                    }
                } else if (hk.if(this.do.if[n], do[11])) {
                    ei_02 = dT.do(this.do.if[n]);
                    object = bC.do((int)this.do.if[n]);
                    ac_0.do(graphics, ((go_0)object).for, fs.for / do[0] - this.do.if.length * do[6] * dH.this / do[0] + n * do[6] * dH.this + do[7] * (dH.this - do[8]), (fs.if << do[8]) + do[9] * dH.this + (dH.case << do[0]) + do[10] * (dH.this - do[8]), do[1]);
                    "".length();
                    if ("  ".length() == 0) {
                        return;
                    }
                } else {
                    ei_02 = dT.if(this.do.if[n]);
                    object = dT.do(this.do.if[n]);
                    bC.do(graphics, ((dI)object).do, fs.for / do[0] - this.do.if.length * do[6] * dH.this / do[0] + n * do[6] * dH.this + do[7] * (dH.this - do[8]), (fs.if << do[8]) + do[9] * dH.this + (dH.case << do[0]) + do[10] * (dH.this - do[8]), do[1]);
                }
                object = bx.for;
                if (!hk.do(ei_02) || hk.if(ei_02.do, this.do.do[n])) {
                    object = bx.do;
                }
                object.do(graphics, String.valueOf(this.do.do[n]), fs.for / do[0] - this.do.if.length * do[6] * dH.this / do[0] + n * do[6] * dH.this - do[8] + do[7] * (dH.this - do[8]), (fs.if << do[8]) + do[9] * dH.this + (dH.case << do[0]) + do[12] * dH.this + do[10] * (dH.this - do[8]), do[0]);
                if (hk.for(n, this.do.if.length - do[8])) {
                    bx.for.do(graphics, "+", fs.for / do[0] - this.do.if.length * do[6] * dH.this / do[0] + n * do[6] * dH.this + do[7] * dH.this + do[7] * (dH.this - do[8]), (fs.if << do[8]) + do[9] * dH.this + (dH.case << do[0]) + do[10] * (dH.this - do[8]), do[0]);
                }
                ++n;
                "".length();
                if ("   ".length() == "   ".length()) continue;
                return;
            }
        }
        graphics.setClip(do[2], do[2], do[3] * fs.if, fs.case * fs.if - fs.new);
        graphics.translate(do[2], -cj_0.new);
    }

    static {
        hk.for();
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    public final void do() {
        if (hk.do(this.do, fs.try)) {
            fs.else();
            fs.do("ID: " + this.do.if);
            fs.do(this.do.do);
            fs.do(bT.bi + this.do.do + "p");
            dI dI2 = dT.do(this.do.for);
            if (hk.do(dI2.do)) {
                fs.do(bT.ah + bx.do(dI2.do) + bT.aq);
                "".length();
                if (null != null) {
                    return;
                }
            } else if (hk.do(dI2.if)) {
                fs.do(bT.ah + bx.do(dI2.if) + bT.aq);
            }
            fs.do(bT.new);
        }
    }

    private static boolean do(int n) {
        return n > 0;
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    private static void for() {
        do = new int[13];
        hk.do[0] = "  ".length();
        hk.do[1] = "   ".length();
        hk.do[2] = (0x2A ^ 6) & ~(0x58 ^ 0x74);
        hk.do[3] = 40 + 138 - 91 + 75 ^ 153 + 106 - 99 + 7;
        hk.do[4] = 135 + 131 - 133 + 16 ^ 136 + 127 - 221 + 125;
        hk.do[5] = 0x53 ^ 0x4C ^ (0x81 ^ 0x99);
        hk.do[6] = 0xE6 ^ 0x93 ^ (0x7A ^ 0x11);
        hk.do[7] = 0x99 ^ 0x96;
        hk.do[8] = " ".length();
        hk.do[9] = 0x2C ^ 0x5A ^ (0x6B ^ 4);
        hk.do[10] = 0x3E ^ 0x34;
        hk.do[11] = 89 + 134 - 3 + 21 ^ 2 + 17 - 10 + 140;
        hk.do[12] = 0xA6 ^ 0xBE ^ (8 ^ 0x18);
    }
}

