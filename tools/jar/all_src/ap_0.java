/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from aP
 * Duplicate member names - consider using --renamedupmembers true
 */
final class ap_0
extends fn_0 {
    private final eh do;
    private final String if;
    private final byte if;
    private static int[] do;
    private final String for;
    private final byte for;
    private final short if;
    private final eh if;

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    ap_0(String string, String string2, eh eh2, eh eh3, short s2, byte by2, byte by3, String string3) {
        super(string, null);
        this.if = string2;
        this.if = eh2;
        this.do = eh3;
        this.if = s2;
        this.for = by2;
        this.if = by3;
        this.for = string3;
    }

    private static void for() {
        do = new int[9];
        ap_0.do[0] = 0x98 ^ 0x97;
        ap_0.do[1] = "  ".length();
        ap_0.do[2] = 0x9F ^ 0x98;
        ap_0.do[3] = 130 + 95 - 81 + 10 ^ 15 + 53 - -48 + 42;
        ap_0.do[4] = " ".length();
        ap_0.do[5] = "   ".length();
        ap_0.do[6] = -" ".length();
        ap_0.do[7] = 0x66 ^ 0x75 ^ (0x3C ^ 0x27);
        ap_0.do[8] = 1 ^ 0x22 ^ (0xBE ^ 0x98);
    }

    static {
        ap_0.for();
    }

    public final void do() {
        this.do.do();
    }

    public final void do(Graphics graphics, int n, int n2) {
        n = do[0] * dH.this;
        bx.byte.do(graphics, this.if, fs.for / do[1] - do[2], n, do[1]);
        this.if.do(graphics, fs.for / do[3] - do[2], n += ((bp)this.if).new + bx.byte.do() + do[0] * dH.this, do[4]);
        this.do.do(graphics, fs.for / do[3] * do[5] - do[2], n, do[4]);
        e e2 = ac_0.if(this.if);
        if (ap_0.do(e2.do, do[6])) {
            graphics.drawImage(e2.do, fs.for / do[1] - do[2], n - ((bp)this.if).new / do[1], do[5]);
            if (ap_0.do(this.for)) {
                bx.for.do(graphics, "lv" + this.for + "+" + this.if + "%", fs.for / do[1] - do[2], n, do[1]);
                gs_0.do(graphics, "", fs.for / do[1] - do[7], n += bx.for.do(), (int)this.if);
            }
        }
        bx.byte.do(graphics, this.for, fs.for / do[1] - do[2], (n += bx.for.do() << do[4]) - do[8], do[1]);
    }

    private static boolean do(int n) {
        return n > 0;
    }
}

