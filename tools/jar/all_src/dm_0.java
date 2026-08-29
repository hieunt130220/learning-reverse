/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from dM
 */
final class dm_0
extends fn_0 {
    private static int[] do;

    private static void for() {
        do = new int[3];
        dm_0.do[0] = 0x1D ^ 0x16;
        dm_0.do[1] = 0xA3 ^ 0x9E ^ (0x7B ^ 7);
        dm_0.do[2] = "   ".length();
    }

    static {
        dm_0.for();
    }

    dm_0(String string) {
        super(string, do[0]);
    }

    public final void do(Graphics graphics, int n, int n2) {
        bC.do(graphics, do[1], n, n2, do[2]);
    }
}

