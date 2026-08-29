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
final class dj
extends fn_0 {
    private static int[] do;

    static {
        dj.for();
    }

    private static void for() {
        do = new int[2];
        dj.do[0] = "  ".length();
        dj.do[1] = "   ".length();
    }

    public final void do(Graphics graphics, int n, int n2) {
        graphics.drawImage(dT.for, n, n2, do[1]);
    }

    dj(String string) {
        super(string, do[0]);
    }
}

