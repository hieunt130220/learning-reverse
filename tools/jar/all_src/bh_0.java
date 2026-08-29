/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from bh
 * Duplicate member names - consider using --renamedupmembers true
 */
final class bh_0
extends fn_0 {
    private static int[] do;
    private final int do;

    public final void do(Graphics graphics, int n, int n2) {
        fj.do.do(this.do, n + do[1], n2 + do[1], do[2], do[3], graphics);
    }

    private static void for() {
        do = new int[4];
        bh_0.do[0] = 0x44 ^ 0x55;
        bh_0.do[1] = " ".length();
        bh_0.do[2] = (0xD3 ^ 0x83 ^ (0xF5 ^ 0xC4)) & (82 + 10 - -63 + 7 ^ 180 + 186 - 272 + 101 ^ -" ".length());
        bh_0.do[3] = "   ".length();
    }

    bh_0(String string, int n, int n2) {
        super(string, do[0], n);
        this.do = n2;
    }

    static {
        bh_0.for();
    }
}

