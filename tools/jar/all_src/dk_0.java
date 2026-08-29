/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from dK
 */
final class dk_0
extends fn_0 {
    private static int[] do;
    private final short if;

    private static void for() {
        do = new int[1];
        dk_0.do[0] = "   ".length();
    }

    static {
        dk_0.for();
    }

    public final void do(Graphics graphics, int n, int n2) {
        ac_0.do(graphics, this.if, n, n2, do[0]);
    }

    dk_0(String string, dh_0 dh_02, short s2) {
        super(string, dh_02);
        this.if = s2;
    }
}

