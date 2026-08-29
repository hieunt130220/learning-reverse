/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from au
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class au_0
extends bH
implements bK {
    private static int[] do;
    private static au_0 do;

    static {
        au_0.for();
        do = new au_0();
    }

    public static void do() {
        fj_0.do().do = do;
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    private static void for() {
        do = new int[3];
        au_0.do[0] = (38 + 82 - -22 + 74 ^ 119 + 170 - 213 + 110) & (206 + 96 - 73 + 3 ^ 77 + 126 - 198 + 133 ^ -" ".length());
        au_0.do[1] = -" ".length();
        au_0.do[2] = "  ".length();
    }

    /*
     * Unable to fully structure code
     */
    public final void do(bm var1_1) {
        try {
            switch (var1_1.do) {
                case -11: {
                    var2_2 = new Vector<ht>();
                    var3_8 = var1_1.do.readByte();
                    var4_11 = au_0.do[0];
                    "".length();
                    if (null == null) ** GOTO lbl16
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var5_12 = new ht();
                        new ht().if = var1_1.do.readShort();
                        var5_12.do = var1_1.do.readShort();
                        var2_2.addElement(var5_12);
                        ++var4_11;
lbl16:
                        // 2 sources

                        ** while (!au_0.do((int)var4_11, (int)var3_8))
                    }
lbl17:
                    // 1 sources

                    var4_11 = var1_1.do.readShort();
                    var5_13 = var1_1.do.readShort();
                    var3_8 = var1_1.do.readShort();
                    var6_14 = var1_1.do.readShort();
                    var7_15 = var1_1.do.readShort();
                    var8_16 = var1_1.do.readByte();
                    var9_17 = au_0.do[0];
                    "".length();
                    if (null == null) ** GOTO lbl33
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var10_18 = new ht();
                        new ht().if = var1_1.do.readShort();
                        var10_18.do = var1_1.do.readShort();
                        var2_2.addElement(var10_18);
                        ++var9_17;
lbl33:
                        // 2 sources

                        ** while (!au_0.do((int)var9_17, (int)var8_16))
                    }
lbl34:
                    // 1 sources

                    var1_1.do.readInt();
                    "".length();
                    ac_0.do(var2_2, var4_11, var5_13, var3_8, var6_14, var7_15);
                    return;
                }
                case -14: {
                    var10_19 = new ht();
                    new ht().if = var1_1.do.readShort();
                    var10_19.do = var1_1.do.readShort();
                    var2_3 = var1_1.do.readUnsignedShort();
                    var10_19.do = new byte[var2_3];
                    var3_9 = au_0.do[0];
                    "".length();
                    if (" ".length() > -" ".length()) ** GOTO lbl53
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var10_19.do[var3_9] = var1_1.do.readByte();
                        ++var3_9;
lbl53:
                        // 2 sources

                        ** while (!au_0.do((int)var3_9, (int)var2_3))
                    }
lbl54:
                    // 1 sources

                    var10_19.for = (short)au_0.do[1];
                    if (au_0.do(var1_1.do.available(), au_0.do[2])) {
                        var10_19.for = var1_1.do.readShort();
                    }
                    ac_0.do(var10_19);
                    return;
                }
                case -15: {
                    var3_10 = new byte[var1_1.do.available()];
                    var1_1.do.read(var3_10);
                    "".length();
                    ac_0.int(var3_10);
                    return;
                }
                case -16: {
                    var2_4 = new byte[var1_1.do.available()];
                    var1_1.do.read(var2_4);
                    "".length();
                    ac_0.for(var2_4);
                    return;
                }
                case -37: {
                    var2_5 = new byte[var1_1.do.available()];
                    var1_1.do.read(var2_5);
                    "".length();
                    ac_0.do(var2_5);
                    return;
                }
                case -40: {
                    var2_6 = new byte[var1_1.do.available()];
                    var1_1.do.read(var2_6);
                    "".length();
                    ac_0.new(var2_6);
                    return;
                }
                case -41: {
                    var2_7 = new byte[var1_1.do.available()];
                    var1_1.do.read(var2_7);
                    "".length();
                    ac_0.if(var2_7);
                    return;
                }
            }
            return;
        }
        catch (Exception v0) {
            v0.printStackTrace();
            return;
        }
    }
}

