/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class cw
extends fn_0 {
    private static int[] do;
    private final dj_0 do;
    private final eh do;
    private final fz do;

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(int n) {
        return n >= 0;
    }

    private static void for() {
        do = new int[9];
        cw.do[0] = "  ".length();
        cw.do[1] = 0x66 ^ 0x38 ^ (0x6C ^ 0x17);
        cw.do[2] = " ".length();
        cw.do[3] = 0x7D ^ 0x72;
        cw.do[4] = 0x72 ^ 0x5A;
        cw.do[5] = (0xCA ^ 0x80) & ~(0x59 ^ 0x13);
        cw.do[6] = 0xD6 ^ 0xAE ^ (0x77 ^ 0x72);
        cw.do[7] = 5 ^ 0x61;
        cw.do[8] = "   ".length();
    }

    private static boolean if(int n) {
        return n <= 0;
    }

    private static boolean if(int n, int n2) {
        return n > n2;
    }

    private static boolean for(int n) {
        return n > 0;
    }

    static {
        cw.for();
    }

    public final void do(Graphics graphics, int n, int n2) {
        block16: {
            String string;
            StringBuffer stringBuffer;
            Graphics graphics2;
            gb gb2;
            block17: {
                block15: {
                    this.do.do(graphics, fs.for / do[0], do[1] * dH.this, do[2]);
                    if (cw.do(this.do)) {
                        this.do.do(graphics, fs.for / do[0] + do[3] * dH.this, do[1] * dH.this, this.do.do);
                    }
                    n = do[4] * dH.this;
                    n2 = do[3] * dH.this;
                    bx.for.do(graphics, String.valueOf(bT.ay) + ((dF)this.do).do, do[5], n, do[5]);
                    if (!cw.do(((dF)this.do).char, ((dF)AngelChip.do).char)) break block15;
                    if (cw.if(AngelChip.do.do) && !cw.for(AngelChip.do.do)) break block16;
                    gb2 = bx.for;
                    graphics2 = graphics;
                    stringBuffer = new StringBuffer(String.valueOf(bT.long[do[5]])).append(AngelChip.do.do).append(" + ").append(AngelChip.do.do);
                    string = "%";
                    "".length();
                    if (null != null) {
                        return;
                    }
                    break block17;
                }
                if (cw.if(this.do.catch) && !cw.for(this.do.char)) break block16;
                gb2 = bx.for;
                graphics2 = graphics;
                stringBuffer = new StringBuffer(String.valueOf(bT.long[do[5]])).append(this.do.catch).append(" + ");
                if (cw.for(this.do.char)) {
                    string = String.valueOf(this.do.char) + "%";
                    "".length();
                    if (null != null) {
                        return;
                    }
                } else {
                    string = "";
                }
            }
            gb2.do(graphics2, stringBuffer.append(string).toString(), do[5], n += n2, do[5]);
        }
        if (!cw.if(this.do.char) || cw.for(this.do.do)) {
            String string;
            StringBuffer stringBuffer = new StringBuffer(String.valueOf(bT.long[do[2]])).append(this.do.char).append(" + ");
            if (cw.for(this.do.do)) {
                string = String.valueOf(this.do.do) + "%";
                "".length();
                if (((0x71 ^ 0x4C) & ~(0x33 ^ 0xE)) != 0) {
                    return;
                }
            } else {
                string = "";
            }
            bx.for.do(graphics, stringBuffer.append(string).toString(), do[5], n += n2, do[5]);
        }
        int n3 = do[5];
        if (cw.if(this.do.try, do[6] * dH.this)) {
            this.do.do(do[7] * dH.this);
            if (cw.do(this.do.do)) {
                n3 = this.do.do;
            }
        }
        bx.for.do(graphics, this.do.do, do[5] - n3, n += n2, do[5]);
        if (cw.int(gs_0.do ? 1 : 0)) {
            bx.for.do(graphics, String.valueOf(bT.au) + this.do.do[do[8]] + bT.for(), do[5], n + n2, do[5]);
        }
    }

    private static boolean int(int n) {
        return n != 0;
    }

    cw(eh eh2, dj_0 dj_02, fz fz2) {
        super(null, null);
        this.do = eh2;
        this.do = dj_02;
        this.do = fz2;
    }

    private static boolean do(Object object) {
        return object != null;
    }
}

