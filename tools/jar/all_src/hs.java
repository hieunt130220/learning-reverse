/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 */
final class hs
extends fn_0 {
    private static int[] do;

    static {
        hs.for();
    }

    public final void do(Graphics graphics, int n, int n2) {
        bC.do(graphics, do[1], n, n2, do[2]);
    }

    private static void for() {
        do = new int[3];
        hs.do[0] = 0x40 ^ 0x4C;
        hs.do[1] = 0x28 ^ 0x46 ^ (0x7E ^ 0x2E);
        hs.do[2] = "   ".length();
    }

    hs(String string) {
        super(string, do[0]);
    }
}

