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
final class g
extends fn_0 {
    private final int do;
    private static int[] do;
    private final ei_0 do;

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    g(String string, int n, ei_0 ei_02, int n2) {
        super(string, do[0], n);
        this.do = ei_02;
        this.do = n2;
    }

    private static void for() {
        do = new int[4];
        g.do[0] = 0x4B ^ 0x77 ^ (0x64 ^ 0x54);
        g.do[1] = 0xF6 ^ 0xAF ^ (0xF0 ^ 0xAE);
        g.do[2] = "  ".length();
        g.do[3] = "   ".length();
    }

    static {
        g.for();
    }

    public final void do() {
        if (g.do(this.do, fs.try)) {
            fs.else();
            fs.do(this.do.do);
            fs.do(String.valueOf(bT.l) + this.do.do);
        }
    }

    public final void do(Graphics graphics, int n, int n2) {
        bC.do((int)this.do.do).do(graphics, do[1], n + fs.if / do[2], n2 + fs.if / do[2], do[3]);
    }
}

