/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from v
 * Duplicate member names - consider using --renamedupmembers true
 */
final class v_0
extends fn_0 {
    private final int do;
    private static int[] do;
    private final byte[] do;

    v_0(String string, int n, byte[] byArray, int n2) {
        super(string, do[0], n);
        this.do = byArray;
        this.do = n2;
    }

    private static void for() {
        do = new int[6];
        v_0.do[0] = 145 + 53 - 45 + 15 ^ 41 + 155 - 20 + 11;
        v_0.do[1] = (0x25 ^ 0x6F) & ~(0x19 ^ 0x53);
        v_0.do[2] = "  ".length();
        v_0.do[3] = 0x2C ^ 0x60 ^ (0x21 ^ 0x78);
        v_0.do[4] = 0x90 ^ 0x84;
        v_0.do[5] = " ".length();
    }

    public final void do(Graphics graphics, int n, int n2) {
        da da2 = (da)ac_0.do(do[1]);
        da2.if(graphics, n + do[2] + da2.if[do[1]] * dH.this, n2 + do[3] + do[4] * (dH.this - do[5]) + da2.do[do[1]] * dH.this, do[1]);
        da2 = (da)ac_0.do(this.do[this.do]);
        da2.if(graphics, n + do[2] + da2.if[do[1]] * dH.this, n2 + do[3] + do[4] * (dH.this - do[5]) + da2.do[do[1]] * dH.this, do[1]);
    }

    static {
        v_0.for();
    }
}

