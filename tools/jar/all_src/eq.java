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
final class eq
extends fn_0 {
    private static int[] do;

    static {
        eq.for();
    }

    eq(String string, dh_0 dh_02) {
        super(string, dh_02);
    }

    public final void do(Graphics graphics, int n, int n2) {
        dT.if.do(do[0], n, n2, do[1], do[2], graphics);
    }

    private static void for() {
        do = new int[3];
        eq.do[0] = " ".length();
        eq.do[1] = (0x53 ^ 0x6D ^ (0x56 ^ 0x3C)) & (0x24 ^ 0x47 ^ (0xF2 ^ 0xC5) ^ -" ".length());
        eq.do[2] = "   ".length();
    }
}

