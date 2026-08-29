/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import java.util.Vector;
import javax.microedition.lcdui.Graphics;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from fF
 */
public class ff_0
extends bp {
    private static int[] do;
    public int char;
    public short try;

    private static boolean do(int n) {
        return n < 0;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    public void do(Graphics graphics) {
        if (ff_0.do(this.char) && (!ff_0.for(this.int * bp.if + this.try / do[1], fq.do().if) || ff_0.if(this.int * bp.if - this.try / do[1], fq.do().if + bx.char))) {
            return;
        }
        int n = this.int * bp.if;
        int n2 = this.for * bp.if;
        switch (this.char) {
            case 0: {
                ac_0.do(graphics, do[2], n, n2, do[3]);
                return;
            }
            case -2: {
                if (ff_0.int(dT.if, do[4])) {
                    int n3;
                    if (ff_0.do(((dF)AngelChip.do).int, dF.case)) {
                        n3 = do[1];
                        "".length();
                        if ("   ".length() <= "  ".length()) {
                            return;
                        }
                    } else {
                        n3 = do[5];
                    }
                    dT.int.do(dT.char, n, n2, n3, do[6], graphics);
                }
                return;
            }
            case -10: 
            case -3: {
                graphics.drawImage(dT.do, n, n2, do[7]);
                return;
            }
            case -5: {
                dT.new.do(do[5], n, n2, do[5], do[6], graphics);
                if (ff_0.int(fk.do, do[4])) {
                    dT.new.do(do[1], n, n2, do[5], do[6], graphics);
                }
                return;
            }
            case -6: {
                dT.do.do(do[5], n, n2, do[5], do[6], graphics);
                if (ff_0.int(fg.do, do[4])) {
                    dT.do.do(do[0], n, n2, do[5], do[6], graphics);
                }
                return;
            }
            case -7: {
                ff_0.do(graphics, n, n2, dT.if);
                return;
            }
            case -8: {
                ff_0.do(graphics, n, n2, dT.case);
                return;
            }
            case -9: {
                if (!ff_0.do(bx.do)) break;
                graphics.drawImage(fj.do, n, n2, do[6]);
                ac_0.do(graphics, do[8], n, n2 + bx.do.do - do[9], do[3]);
            }
        }
    }

    private static boolean do(Object object) {
        return object != null;
    }

    /*
     * Unable to fully structure code
     */
    private static void do(Graphics var0, int var1_1, int var2_2, Vector var3_3) {
        var4_4 = ff_0.do[5];
        "".length();
        if (((248 ^ 169 ^ (31 ^ 47)) & (116 ^ 90 ^ (104 ^ 39) ^ -" ".length())) > -" ".length()) ** GOTO lbl24
        return;
lbl-1000:
        // 1 sources

        {
            block4: {
                var5_5 = (fw)var3_3.elementAt(var4_4);
                if (!ff_0.do(var5_5.if * bp.if, var1_1) || !ff_0.do(var5_5.for * bp.if, var2_2)) break block4;
                var6_6 = bC.do(var5_5.do);
                if (ff_0.int(var6_6.do, ff_0.do[4])) {
                    ac_0.do(var0, var6_6.do, var1_1, var2_2, ff_0.do[6]);
                }
                var7_7 = ff_0.do[5];
                "".length();
                if (((19 ^ 62) & ~(95 ^ 114)) == 0) ** GOTO lbl21
                return;
lbl-1000:
                // 1 sources

                {
                    var8_8 = (hu)dT.byte.elementAt(var7_7);
                    if (ff_0.do(var8_8.else, var5_5.do) && ff_0.if(var8_8.class)) {
                        ac_0.do(var0, var6_6.for, var1_1, var2_2, ff_0.do[6]);
                        return;
                    }
                    ++var7_7;
lbl21:
                    // 2 sources

                    ** while (!ff_0.for((int)var7_7, (int)dT.byte.size()))
                }
            }
            ++var4_4;
lbl24:
            // 2 sources

            ** while (!ff_0.for((int)var4_4, (int)var3_3.size()))
        }
lbl25:
        // 1 sources

    }

    static {
        ff_0.if();
    }

    private static boolean if(int n, int n2) {
        return n > n2;
    }

    public ff_0(int n, int n2, int n3, int n4) {
        this.if = (byte)do[0];
        this.char = n;
        this.int = n2;
        this.for = n3;
        this.try = (short)n4;
    }

    private static boolean for(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private static boolean int(int n, int n2) {
        return n != n2;
    }

    private static void if() {
        do = new int[10];
        ff_0.do[0] = " ".length();
        ff_0.do[1] = "  ".length();
        ff_0.do[2] = 92 + 45 - 89 + 195;
        ff_0.do[3] = 49 + 147 - 9 + 0 ^ 96 + 72 - 155 + 141;
        ff_0.do[4] = -" ".length();
        ff_0.do[5] = (7 ^ 0x47 ^ (0xB ^ 0x6D)) & (0xEF ^ 0xC0 ^ (0x62 ^ 0x6B) ^ -" ".length());
        ff_0.do[6] = "   ".length();
        ff_0.do[7] = 0xB0 ^ 0x98;
        ff_0.do[8] = -(0xFFFFF767 & 0x6CFC) & (0xFFFFFFE7 & 0x67FF);
        ff_0.do[9] = 0x88 ^ 0x82;
    }

    public ff_0() {
        this.if = (byte)do[0];
    }
}

