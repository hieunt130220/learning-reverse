/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from gZ
 */
final class gz_0
extends fn_0 {
    private static int[] do;

    private static void for() {
        do = new int[3];
        gz_0.do[0] = " ".length();
        gz_0.do[1] = (0x23 ^ 0x3F ^ (0xAC ^ 0xA4)) & (51 + 51 - 89 + 127 ^ 71 + 98 - 92 + 75 ^ -" ".length());
        gz_0.do[2] = "   ".length();
    }

    public final void do(Graphics graphics, int n, int n2) {
        dT.if.do(do[0], n, n2, do[1], do[2], graphics);
    }

    gz_0(String string, dh_0 dh_02) {
        super(string, dh_02);
    }

    static {
        gz_0.for();
    }
}

