/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from cT
 * Duplicate member names - consider using --renamedupmembers true
 */
final class ct_0
extends fn_0 {
    private final byte if;
    private static int[] do;
    private final ao_0 do;

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    ct_0(String string, dh_0 dh_02, ao_0 ao_02, byte by2) {
        super(string, dh_02);
        this.do = ao_02;
        this.if = by2;
    }

    public final void do(Graphics graphics, int n, int n2) {
        this.do.do(graphics, n + fs.if / do[0], n2 + fs.if / do[0], do[1]);
    }

    public final void do() {
        if (ct_0.do(this.if, fs.try)) {
            gs_0.if(this.do);
            fs.else();
            String string = "";
            fs.do(String.valueOf(string) + ac_0.do(this.do));
            fs.do(String.valueOf(bT.bD) + bx.do(this.do.do[do[2]], this.do.do[do[3]], do[2]));
            fs.do(String.valueOf(bT.short) + ac_0.do(this.do));
            fs.do(String.valueOf(bT.long[do[2]]) + gs_0.do.catch);
        }
    }

    static {
        ct_0.for();
    }

    private static void for() {
        do = new int[4];
        ct_0.do[0] = "  ".length();
        ct_0.do[1] = "   ".length();
        ct_0.do[2] = (1 + 68 - -129 + 31 ^ 114 + 55 - 97 + 106) & (0xB3 ^ 0xC5 ^ (0x17 ^ 0x36) ^ -" ".length());
        ct_0.do[3] = " ".length();
    }
}

