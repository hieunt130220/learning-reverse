/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from fS
 */
final class fs_0
extends fn_0 {
    private static int[] do;

    private static void for() {
        do = new int[3];
        fs_0.do[0] = " ".length();
        fs_0.do[1] = (0x65 ^ 0x5B ^ (0x9B ^ 0xB1)) & (133 + 62 - 67 + 19 ^ 33 + 13 - 16 + 105 ^ -" ".length());
        fs_0.do[2] = "   ".length();
    }

    static {
        fs_0.for();
    }

    fs_0(String string) {
        super(string, do[0]);
    }

    public final void do(Graphics graphics, int n, int n2) {
        dT.if.do(do[1], n, n2, do[1], do[2], graphics);
    }
}

