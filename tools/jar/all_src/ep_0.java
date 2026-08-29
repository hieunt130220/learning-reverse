/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from eP
 * Duplicate member names - consider using --renamedupmembers true
 */
final class ep_0
extends fn_0 {
    private static int[] do;
    private final fz do;

    private static void for() {
        do = new int[2];
        ep_0.do[0] = 0x4D ^ 0x5F;
        ep_0.do[1] = "   ".length();
    }

    static {
        ep_0.for();
    }

    ep_0(String string, int n, fz fz2) {
        super(string, do[0], n);
        this.do = fz2;
    }

    public final void do(Graphics graphics, int n, int n2) {
        ac_0.do(graphics, this.do.do, n, n2, do[1]);
    }
}

