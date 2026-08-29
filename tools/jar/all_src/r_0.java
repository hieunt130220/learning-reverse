/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from r
 * Duplicate member names - consider using --renamedupmembers true
 */
final class r_0
extends fn_0 {
    private static int[] do;
    private final fz do;

    private static void for() {
        do = new int[2];
        r_0.do[0] = "  ".length() ^ (0xAC ^ 0xBE);
        r_0.do[1] = "   ".length();
    }

    public final void do(Graphics graphics, int n, int n2) {
        ac_0.do(graphics, this.do.do, n, n2, do[1]);
    }

    static {
        r_0.for();
    }

    r_0(String string, int n, fz fz2) {
        super(string, do[0], n);
        this.do = fz2;
    }
}

