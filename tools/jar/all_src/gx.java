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
final class gx
extends fn_0 {
    private final ei_0 do;
    private static final int[] do;

    public gx(String string, dh_0 dh_02, ei_0 ei_02) {
        super(string, dh_02);
        this.do = ei_02;
    }

    static {
        gx.for();
    }

    public final void do(Graphics graphics, int n, int n2) {
        bC.do((int)this.do.do).do(graphics, do[0], n, n2, do[1]);
    }

    private static void for() {
        do = new int[2];
        gx.do[0] = 0xF2 ^ 0x8C ^ (0x22 ^ 0x5B);
        gx.do[1] = "   ".length();
    }
}

