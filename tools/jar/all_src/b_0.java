/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from b
 * Duplicate member names - consider using --renamedupmembers true
 */
final class b_0
extends fn_0 {
    private static final int[] do;
    private final dI do;
    private final int do;

    static {
        b_0.for();
    }

    b_0(String string, int n, dI dI2, int n2) {
        super(string, do[0], n);
        this.do = dI2;
        this.do = n2;
    }

    public final void do() {
        if (b_0.do(this.do, fs.try)) {
            fs.else();
            fs.do("ID: " + this.do.if);
            fs.do(this.do.do);
            fs.do(bT.bD + bx.do(this.do.do, this.do.if, do[2]));
        }
    }

    public final void do(Graphics graphics, int n, int n2) {
        this.do.do(graphics, n + fs.if / do[1], n2 + fs.if / do[1]);
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static void for() {
        do = new int[3];
        b_0.do[0] = 0x4F ^ 0x46;
        b_0.do[1] = "  ".length();
        b_0.do[2] = (120 + 102 - 114 + 132 ^ 107 + 22 - -21 + 47) & (0x1C ^ 0xB ^ (0x9D ^ 0xBF) ^ -" ".length());
    }
}

