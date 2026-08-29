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
final class bj
extends fn_0 {
    private static int[] do;
    private final byte if;
    private final int do;
    private final eh do;
    private final short if;
    private final byte for;

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    bj(eh eh2, byte by2, byte by3, int n, short s2) {
        super(null, do[0]);
        this.do = eh2;
        this.if = by2;
        this.for = by3;
        this.do = n;
        this.if = s2;
    }

    private static void for() {
        do = new int[8];
        bj.do[0] = (0x7E ^ 0x2B) & ~(0xC0 ^ 0x95);
        bj.do[1] = " ".length();
        bj.do[2] = 0x5A ^ 0x50;
        bj.do[3] = 0x61 ^ 0x5E ^ (0x88 ^ 0xA9);
        bj.do[4] = "  ".length();
        bj.do[5] = "   ".length();
        bj.do[6] = -" ".length();
        bj.do[7] = 0x37 ^ 0x5E ^ (0xE8 ^ 0x87);
    }

    public final void do(Graphics graphics, int n, int n2) {
        bx.if(graphics);
        n = w.do + (dH.break << do[1]) + do[2] * dH.this + do[3] * (dH.this - do[1]) + fs.byte;
        n2 = dH.new;
        this.do.do(graphics, bx.char / do[4], n, do[0]);
        bx.byte.do(graphics, String.valueOf(bT.ay) + ((dF)this.do).do, bx.char / do[4], n + n2, do[4]);
        bx.byte.do(graphics, String.valueOf(bT.long[do[5]]) + this.if + " (" + this.for + "%)", bx.char / do[4], n + (n2 << do[1]), do[4]);
        bx.byte.do(graphics, String.valueOf(bT.de) + this.do, bx.char / do[4], n + n2 * do[5], do[4]);
        bx.byte.do(graphics, String.valueOf(bT.ct) + ": ", bx.char / do[4], n + (n2 << do[4]), do[4]);
        if (bj.do(this.if, do[6])) {
            ((fd)ac_0.do(this.if)).if(graphics, bx.char / do[4], n + n2 * do[7], do[5]);
        }
    }

    static {
        bj.for();
    }
}

