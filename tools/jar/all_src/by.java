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
final class by
extends fn_0 {
    private int do;
    private static final int[] do;
    private ei_0 do = do[0];

    public final void do() {
        if (by.if(this.do, fs.try)) {
            fs.else();
            fs.do("ID: " + this.do.do);
            fs.do(this.do.do);
            fs.do(bT.l + this.do.do);
            fs.do(bT.cj + bx.do(this.do.do[do[0]] * this.do.do) + bT.aq);
            fs.do(gs_0.do());
        }
    }

    private static void for() {
        do = new int[5];
        by.do[0] = "  ".length() & ~"  ".length();
        by.do[1] = 0x33 ^ 0xE ^ (0x1F ^ 0x10);
        by.do[2] = 0xA4 ^ 0xB8 ^ (0x75 ^ 0x6E);
        by.do[3] = "  ".length();
        by.do[4] = "   ".length();
    }

    static {
        by.for();
    }

    public by(String string, dh_0 dh_02, int n, ei_0 ei_02) {
        super(string, dh_02);
        this.do = n;
        this.do = ei_02;
    }

    public final void do(Graphics graphics, int n, int n2) {
        if (by.do(this.do.do, do[1])) {
            bC.do((int)this.do.do).do(graphics, do[2], n + fs.if / do[3], n2 + fs.if / do[3], do[4]);
            return;
        }
        ac_0.do(graphics, bC.do((int)this.do.do).for, n += fs.if / do[3], n2 += fs.if / do[3], do[4]);
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }
}

