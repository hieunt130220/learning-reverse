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
final class ej
extends fn_0 {
    private dI do;
    private static int[] do;

    public ej(String string, int n, dI dI2) {
        super(string, do[0], n);
        this.do = dI2;
    }

    private static void for() {
        do = new int[1];
        ej.do[0] = 0x16 ^ 0x10;
    }

    public final void do(Graphics graphics, int n, int n2) {
        this.do.do(graphics, n, n2);
    }

    public ej(String string, dh_0 dh_02, dI dI2) {
        super(string, dh_02);
        this.do = dI2;
    }

    static {
        ej.for();
    }
}

