/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 */
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class ho {
    public byte[] do;
    public x_0[] do;
    public Image do;
    private static int[] do;
    public m_0[] do;
    public short do;

    static {
        ho.do();
    }

    /*
     * Unable to fully structure code
     */
    public final void do(Graphics var1_1, int var2_2, int var3_3, int var4_4) {
        var4_5 = this.do[this.do[var4_4]];
        var5_6 = ho.do[0];
        "".length();
        if (" ".length() <= "  ".length()) ** GOTO lbl28
        return;
lbl-1000:
        // 1 sources

        {
            block4: {
                var6_7 = var4_5.do[var5_6];
                var7_8 = this;
                var8_9 = ho.do[0];
                "".length();
                if (-(9 + 109 - 46 + 78 ^ 89 + 59 - 19 + 18) < 0) ** GOTO lbl22
                return;
lbl-1000:
                // 1 sources

                {
                    if (ho.if(var7_8.do[var8_9].if, var6_7)) {
                        v0 = var7_8.do[var8_9];
                        "".length();
                        if (" ".length() < ((43 ^ 13 ^ (6 ^ 114)) & (131 ^ 178 ^ (88 ^ 59) ^ -" ".length()))) {
                            return;
                        }
                        break block4;
                    }
                    ++var8_9;
lbl22:
                    // 2 sources

                    ** while (!ho.do((int)var8_9, (int)var7_8.do.length))
                }
lbl23:
                // 1 sources

                v0 = null;
            }
            var7_8 = v0;
            var1_1.drawRegion(this.do, var7_8.new * dH.this, var7_8.do * dH.this, var7_8.try * dH.this, var7_8.for * dH.this, ho.do[0], var2_2 * dH.this + var4_5.do[var5_6] * dH.this, var3_3 * dH.this + var4_5.if[var5_6] * dH.this, ho.do[0]);
            ++var5_6;
lbl28:
            // 2 sources

            ** while (!ho.do((int)var5_6, (int)var4_5.do.length))
        }
lbl29:
        // 1 sources

    }

    private static void do() {
        do = new int[1];
        ho.do[0] = (0x55 ^ 0x7F) & ~(7 ^ 0x2D);
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }
}

