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
final class dm
extends fn_0 {
    private final int do;
    private static final int[] do;
    private final go_0 do;

    public final void do() {
        if (dm.do(this.do, fs.try - bC.do.length) && dm.do(fs.do ? 1 : 0)) {
            fs.else();
            fs.do("ID: " + this.do.if);
            fs.do(this.do.if + " (" + this.do.do + bT.bV + ")");
            fs.do(bT.bD + bx.do(this.do.do[do[3]], this.do.do[do[4]], do[3]));
            fs.do(this.do.do);
            fs.do(gs_0.do());
        }
    }

    public final void do(Graphics graphics, int n, int n2) {
        ac_0.do(graphics, this.do.int, n + fs.if / do[1], n2 + fs.if / do[1], do[2]);
    }

    static {
        dm.for();
    }

    private static void for() {
        do = new int[5];
        dm.do[0] = 0x7B ^ 0x5D ^ (0xAC ^ 0x82);
        dm.do[1] = "  ".length();
        dm.do[2] = "   ".length();
        dm.do[3] = (0x2F ^ 0x4F) & ~(0x79 ^ 0x19);
        dm.do[4] = " ".length();
    }

    dm(String string, int n, go_0 go_02, int n2) {
        super(string, do[0], n);
        this.do = go_02;
        this.do = n2;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }
}

