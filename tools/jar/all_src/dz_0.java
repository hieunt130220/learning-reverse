/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from dz
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class dz_0
extends fn_0 {
    private final int do;
    private static final int[] do;

    public dz_0(String string, dh_0 dh_02, int n) {
        super(string, dh_02);
        this.do = n;
    }

    static {
        dz_0.for();
    }

    public final void do(Graphics graphics, int n, int n2) {
        dT.if.do(this.do, n, n2, do[0], do[1], graphics);
    }

    private static void for() {
        do = new int[2];
        dz_0.do[0] = (0x79 ^ 0x67 ^ (0x45 ^ 0x5E)) & (0xA4 ^ 0xC5 ^ (0x48 ^ 0x2C) ^ -" ".length());
        dz_0.do[1] = "   ".length();
    }
}

