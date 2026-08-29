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
final class y
extends fn_0 {
    private static int[] do;
    private final fz do;

    private static void for() {
        do = new int[2];
        y.do[0] = 0x7A ^ 0x6B;
        y.do[1] = "   ".length();
    }

    y(String string, int n, fz fz2) {
        super(string, do[0], n);
        this.do = fz2;
    }

    static {
        y.for();
    }

    public final void do(Graphics graphics, int n, int n2) {
        ac_0.do(graphics, this.do.do, n, n2, do[1]);
    }
}

