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
final class hq
extends fn_0 {
    private static int[] do;

    public final void do(Graphics graphics, int n, int n2) {
        bC.do(graphics, do[1], n, n2, do[2]);
    }

    private static void for() {
        do = new int[3];
        hq.do[0] = 0x19 ^ 0x17;
        hq.do[1] = 0xF8 ^ 0xC5;
        hq.do[2] = "   ".length();
    }

    hq(String string) {
        super(string, do[0]);
    }

    static {
        hq.for();
    }
}

