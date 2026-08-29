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
final class ds
extends fn_0 {
    private final int do;
    private static final int[] do;

    private static boolean do(int n) {
        return n != 0;
    }

    ds(String string, int n, int n2) {
        super(string, do[0], n);
        this.do = n2;
    }

    public final void do() {
        if (ds.do(this.do, fs.try) && ds.do(fs.do ? 1 : 0)) {
            fs.else();
            fs.do("ID: " + bC.do[this.do].if);
            fs.do(bC.do[this.do].if + " (" + bC.do[this.do].try + bT.bV + ")");
            fs.do(bT.bD + bx.do((int)bC.do[this.do].if[do[3]], (int)bC.do[this.do].if[do[4]], do[3]));
            fs.do(bT.long[do[1]] + ": " + bC.do[this.do].do);
            if (ds.do(bC.do[this.do].do ? 1 : 0)) {
                dI dI2 = dT.do(bC.do[this.do].new);
                fs.do(bT.c + ": " + dI2.do);
            }
            fs.do(bT.package + ": " + bx.do(bC.do[this.do].do));
            fs.do(gs_0.do());
        }
    }

    static {
        ds.for();
    }

    public final void do(Graphics graphics, int n, int n2) {
        bC.do[this.do].do(graphics, do[0], n + fs.if / do[1], n2 + fs.if / do[1], do[2]);
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static void for() {
        do = new int[5];
        ds.do[0] = 108 + 15 - 105 + 120 ^ 65 + 102 - 57 + 31;
        ds.do[1] = "  ".length();
        ds.do[2] = "   ".length();
        ds.do[3] = "   ".length() & ~"   ".length();
        ds.do[4] = " ".length();
    }
}

