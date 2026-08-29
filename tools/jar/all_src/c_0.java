/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from C
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class c_0
extends ca {
    private int new;
    public int do;
    public String do;
    public int if;
    public int for;
    private static int[] do;
    public byte do;
    public int int;
    private int try = do[0];

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    public c_0() {
        this.new = (short)(dH.new * do[1]);
        ((dH)this).try = ey_0.do().do;
    }

    private static boolean for(int n, int n2) {
        return n >= n2;
    }

    /*
     * Unable to fully structure code
     */
    public final void do(Graphics var1_1) {
        bx.do.do(var1_1, (bx.char - this.try) / c_0.do[2], (bx.new - this.new) / c_0.do[2], this.try, this.new, w.do[c_0.do[2]], w.do[c_0.do[3]], c_0.do[4]);
        var1_1.translate((bx.char - this.try) / c_0.do[2], (bx.new - this.new) / c_0.do[2]);
        var2_2 = c_0.do[5] + dH.new;
        bx.byte.do(var1_1, String.valueOf(ey_0.do().do), this.try / c_0.do[2], var2_2 - dH.new / c_0.do[2] - c_0.do[2] * dH.this, c_0.do[2]);
        bx.byte.do(var1_1, "Th\u00fa \u0111ua chi\u1ebfn th\u1eafng", this.try / c_0.do[2], var2_2 += dH.new / c_0.do[2] + c_0.do[2] * dH.this, c_0.do[2]);
        bx.int.do(var1_1, this.do, this.try / c_0.do[2], var2_2 += dH.new + c_0.do[6] * dH.this, c_0.do[2]);
        var2_2 += dH.new << c_0.do[4];
        var3_3 = c_0.do[5];
        "".length();
        if ("  ".length() != (10 ^ 14)) ** GOTO lbl19
        return;
lbl-1000:
        // 1 sources

        {
            if (c_0.if(this.do, ey_0.do().do[var3_3].char)) {
                var4_4 = ac_0.if(ey_0.do().do[var3_3].if);
                if (c_0.do(var4_4.do, c_0.do[7])) {
                    var5_5 = var4_4.do / c_0.do[8];
                    var1_1.drawRegion(var4_4.do, c_0.do[5], ey_0.do[c_0.do[5]][c_0.do[5]] * var5_5, (int)var4_4.if, var5_5, c_0.do[5], this.try / c_0.do[2], var2_2 + dH.new / c_0.do[2], c_0.do[3]);
                }
            }
            ++var3_3;
lbl19:
            // 2 sources

            ** while (!c_0.for((int)var3_3, (int)c_0.do[6]))
        }
lbl20:
        // 1 sources

        var2_2 += dH.new / c_0.do[2];
        bx.byte.do(var1_1, "Ti\u1ec1n c\u01b0\u1ee3c: ", c_0.do[9], var2_2 += dH.new, c_0.do[5]);
        bx.if.do(var1_1, "" + this.if, this.try - c_0.do[10], var2_2 + dH.new / c_0.do[2] - dH.byte / c_0.do[2], c_0.do[4]);
        bx.byte.do(var1_1, "Ti\u1ec1n \u0103n: ", c_0.do[9], var2_2 += dH.new, c_0.do[5]);
        bx.if.do(var1_1, "" + this.for, this.try - c_0.do[10], var2_2 + dH.new / c_0.do[2] - dH.byte / c_0.do[2], c_0.do[4]);
        bx.byte.do(var1_1, "Ti\u1ec1n thu\u1ebf: ", c_0.do[9], var2_2 += dH.new, c_0.do[5]);
        bx.if.do(var1_1, "" + this.do, this.try - c_0.do[10], var2_2 + dH.new / c_0.do[2] - dH.byte / c_0.do[2], c_0.do[4]);
        bx.byte.do(var1_1, "Ti\u1ec1n nh\u1eadn \u0111\u01b0\u1ee3c: ", c_0.do[9], var2_2 += dH.new, c_0.do[5]);
        bx.if.do(var1_1, "" + this.int, this.try - c_0.do[10], var2_2 + dH.new / c_0.do[2] - dH.byte / c_0.do[2], c_0.do[4]);
        super.do(var1_1);
    }

    private static void if() {
        do = new int[11];
        c_0.do[0] = (0xD3 ^ 0xA6) + (0x2B ^ 0x5A) - (6 + 89 - -28 + 19) + (0x21 ^ 0x51);
        c_0.do[1] = 0x63 ^ 0x68;
        c_0.do[2] = "  ".length();
        c_0.do[3] = "   ".length();
        c_0.do[4] = " ".length();
        c_0.do[5] = (0x6B ^ 0x77) & ~(0x74 ^ 0x68);
        c_0.do[6] = 0xB ^ 0xD;
        c_0.do[7] = -" ".length();
        c_0.do[8] = 0x27 ^ 0x54 ^ (0x60 ^ 0x16);
        c_0.do[9] = 0xAB ^ 0xA1;
        c_0.do[10] = 0x1A ^ 0xE;
    }

    static {
        c_0.if();
    }
}

