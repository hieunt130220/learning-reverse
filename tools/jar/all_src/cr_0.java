/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from cr
 * Duplicate member names - consider using --renamedupmembers true
 */
final class cr_0
extends fn_0 {
    private final fz do;
    private static int[] do;

    cr_0(String string, dh_0 dh_02, fz fz2) {
        super(string, dh_02);
        this.do = fz2;
    }

    private static void for() {
        do = new int[1];
        cr_0.do[0] = "   ".length();
    }

    static {
        cr_0.for();
    }

    public final void do(Graphics graphics, int n, int n2) {
        ac_0.do(graphics, this.do.do, n, n2, do[0]);
    }
}

