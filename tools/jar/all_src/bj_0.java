/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 */
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from bJ
 * Duplicate member names - consider using --renamedupmembers true
 */
final class bj_0
extends fn_0 {
    private static final int[] do;
    private final Image do;

    public final void do(Graphics graphics, int n, int n2) {
        graphics.drawRegion(this.do, do[0], do[0], this.do.getWidth(), this.do.getHeight(), do[0], n, n2, do[1]);
    }

    static {
        bj_0.for();
    }

    private static void for() {
        do = new int[2];
        bj_0.do[0] = (0x55 ^ 0x77 ^ (0xA ^ 0x27)) & (0xDF ^ 0xC7 ^ (0x53 ^ 0x44) ^ -" ".length());
        bj_0.do[1] = "   ".length();
    }

    public bj_0(String string, String string2, dh_0 dh_02) {
        super(string2, dh_02);
        this.do = L.do(string);
    }
}

