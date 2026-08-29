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
final class ei
extends fn_0 {
    private static int[] do;

    static {
        ei.for();
    }

    public final void do(Graphics graphics, int n, int n2) {
        bC.do(graphics, do[1], n, n2, do[2]);
    }

    private static void for() {
        do = new int[3];
        ei.do[0] = 0xB ^ 0;
        ei.do[1] = 0x72 ^ 0x38 ^ (0xBC ^ 0xB7);
        ei.do[2] = "   ".length();
    }

    ei(String string) {
        super(string, do[0]);
    }
}

