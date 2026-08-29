/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from aN
 * Duplicate member names - consider using --renamedupmembers true
 */
final class an_0
extends bs {
    private final gd_0 do;
    private static int[] do;

    static {
        an_0.if();
    }

    private static void if() {
        do = new int[3];
        an_0.do[0] = -(0xFFFFAFBA & 0x70E7) & (0xFFFFFFB7 & 0x5A7BEF);
        an_0.do[1] = " ".length();
        an_0.do[2] = (0xEF ^ 0x94 ^ (0x54 ^ 0x36)) & (17 + 80 - 1 + 49 ^ 63 + 76 - 36 + 33 ^ -" ".length());
    }

    public final void do(Graphics graphics) {
        w.do(((bp)this.do).int * dH.this, ((bp)this.do).for * dH.this, this.do.else, this.do.case, do[0], graphics);
    }

    public final void do() {
        if (an_0.do(((bp)this.do).for, this.do.byte)) {
            ((bp)this.do).int += this.do.try;
            ((bp)this.do).for += this.do.char;
            this.do.char += do[1];
            return;
        }
        this.do.try = do[2];
        this.do.char = do[2];
    }

    an_0(gd_0 gd_02) {
        this.do = gd_02;
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }
}

