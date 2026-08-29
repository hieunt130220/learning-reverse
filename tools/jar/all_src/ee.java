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
final class ee
extends fn_0 {
    private final ei_0 do;
    private static int[] do;

    ee(String string, int n, ei_0 ei_02) {
        super(string, do[0], n);
        this.do = ei_02;
    }

    public final void do(Graphics graphics, int n, int n2) {
        bC.do((int)this.do.do).do(graphics, do[1], n, n2, do[2]);
    }

    static {
        ee.for();
    }

    private static void for() {
        do = new int[3];
        ee.do[0] = 0x35 ^ 0x30;
        ee.do[1] = 7 ^ 0;
        ee.do[2] = "   ".length();
    }
}

