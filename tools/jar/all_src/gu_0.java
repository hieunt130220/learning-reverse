/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from gu
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class gu_0
extends bH
implements bK {
    private static int[] do;
    private static gu_0 do;

    private static boolean do(int n) {
        return n <= 0;
    }

    static {
        gu_0.for();
        do = new gu_0();
    }

    private static boolean if(int n) {
        return n != 0;
    }

    public static void do() {
        y_0.do = do[0];
        q.if = q.do;
        fq_0.do(do[1], bW.do());
        bv.do.do = do;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static void for() {
        do = new int[10];
        gu_0.do[0] = 0x41 ^ 6 ^ (0x4D ^ 0xE);
        gu_0.do[1] = " ".length();
        gu_0.do[2] = (0x9A ^ 0xA6 ^ (0x62 ^ 0x3D)) & (17 + 143 - -33 + 40 ^ 131 + 137 - 143 + 13 ^ -" ".length());
        gu_0.do[3] = 0x52 ^ 0x5B;
        gu_0.do[4] = -" ".length();
        gu_0.do[5] = 0x28 ^ 0x53 ^ (0x2B ^ 0x5C);
        gu_0.do[6] = 54 + 111 - 38 + 11 ^ 47 + 39 - 26 + 69;
        gu_0.do[7] = "   ".length();
        gu_0.do[8] = 0x98 ^ 0x92;
        gu_0.do[9] = -"  ".length();
    }

    private static boolean for(int n) {
        return n == 0;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    /*
     * Unable to fully structure code
     * Could not resolve type clashes
     */
    public final void do(bm var1_1) {
        try {
            var2_6 = var1_1.do.readByte();
            var3_8 = var1_1.do.readByte();
            if (gu_0.for((int)y_0.do(var2_6, (byte)var3_8))) {
                return;
            }
            switch (var1_1.do) {
                case 20: {
                    var2_6 = var1_1.do.readByte();
                    var3_9 = new Vector<de_0>();
                    var4_12 = gu_0.do[2];
                    "".length();
                    if ("   ".length() > -" ".length()) ** GOTO lbl18
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var5_19 = var1_1.do.readByte();
                        var3_9.addElement(new de_0(var5_19));
                        ++var4_12;
lbl18:
                        // 2 sources

                        ** while (!gu_0.if((int)var4_12, (int)gu_0.do[3]))
                    }
lbl19:
                    // 1 sources

                    var4_12 = var1_1.do.readInt();
                    var5_19 = var1_1.do.readInt();
                    bx.case();
                    y_0.break();
                    bW.do().do(var2_6, var3_9, var4_12, (int)var5_19);
                    return;
                }
                case 49: {
                    var2_6 = var1_1.do.readInt();
                    var1_2 = var1_1.do.readInt();
                    bW.do().int(var2_6, var1_2);
                    return;
                }
                case 21: {
                    var2_6 = var1_1.do.readInt();
                    var3_8 = var1_1.do.readInt();
                    var4_13 = var1_1.do.readByte();
                    var5_20 = gu_0.do[2];
                    if (gu_0.for(var4_13, gu_0.do[4])) {
                        var5_20 = var1_1.do.readByte();
                    }
                    bx.case();
                    bW.do().do((int)var2_6, var3_8, (int)var4_13, var5_20);
                    return;
                }
                case 63: {
                    var1_3 = var1_1.do.readByte();
                    bx.case();
                    bW.do().try(var1_3);
                    return;
                }
                case 64: {
                    var2_6 = var1_1.do.readInt();
                    var3_8 = (int)var1_1.do.readBoolean();
                    var4_14 = gu_0.do[2];
                    if (gu_0.if(var3_8)) {
                        var4_14 = var1_1.do.readByte();
                    }
                    var1_4 = var1_1.do.readByte();
                    bx.case();
                    bW.do().do((boolean)var3_8, var4_14, (int)var2_6, var1_4);
                    return;
                }
                case 65: {
                    var2_6 = var1_1.do.readInt();
                    var3_8 = (int)var1_1.do.readBoolean();
                    var4_15 = var1_1.do.readBoolean();
                    var5_21 = new int[gu_0.do[0]];
                    var6_24 = new int[gu_0.do[5]];
                    if (!gu_0.if(var3_8)) ** GOTO lbl86
                    var7_28 = gu_0.do[2];
                    "".length();
                    if (" ".length() < (32 ^ 18 ^ (36 ^ 18))) ** GOTO lbl69
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var5_21[var7_28] = var1_1.do.readInt();
                        ++var7_28;
lbl69:
                        // 2 sources

                        ** while (!gu_0.if((int)var7_28, (int)gu_0.do[0]))
                    }
lbl70:
                    // 1 sources

                    var7_28 = gu_0.do[2];
                    "".length();
                    if (" ".length() > ((36 ^ 18 ^ (179 ^ 194)) & (96 ^ 47 ^ (34 ^ 42) ^ -" ".length()))) ** GOTO lbl77
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var6_24[var7_28] = gu_0.do[4];
                        ++var7_28;
lbl77:
                        // 2 sources

                        ** while (!gu_0.if((int)var7_28, (int)gu_0.do[5]))
                    }
lbl78:
                    // 1 sources

                    var7_28 = gu_0.do[2];
                    "".length();
                    if (-(225 ^ 197 ^ (79 ^ 111)) < 0) ** GOTO lbl85
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var6_24[var7_28] = var1_1.do.readByte();
                        ++var7_28;
lbl85:
                        // 2 sources

                        ** while (!gu_0.do((int)var1_1.do.available()))
                    }
lbl86:
                    // 2 sources

                    bx.case();
                    bW.do().do((boolean)var3_8, var6_24, var4_15, (int)var2_6);
                    return;
                }
                case 51: {
                    var7_29 = new int[gu_0.do[0]];
                    var2_6 = gu_0.do[2];
                    "".length();
                    if (null == null) ** GOTO lbl98
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var7_29[var2_6] = var1_1.do.readInt();
                        ++var2_6;
lbl98:
                        // 2 sources

                        ** while (!gu_0.if((int)var2_6, (int)gu_0.do[0]))
                    }
lbl99:
                    // 1 sources

                    var2_7 = new int[gu_0.do[0]];
                    var3_8 = gu_0.do[2];
                    "".length();
                    if ("  ".length() != (40 ^ 44)) ** GOTO lbl107
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var2_7[var3_8] = var1_1.do.readInt();
                        ++var3_8;
lbl107:
                        // 2 sources

                        ** while (!gu_0.if((int)var3_8, (int)gu_0.do[0]))
                    }
lbl108:
                    // 1 sources

                    var3_10 = new int[gu_0.do[0]][gu_0.do[6]];
                    var4_16 = gu_0.do[2];
                    "".length();
                    if (((208 ^ 133) & ~(64 ^ 21)) == 0) ** GOTO lbl123
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var5_22 = gu_0.do[2];
                        "".length();
                        if ("  ".length() >= 0) ** GOTO lbl121
                        return;
lbl-1000:
                        // 1 sources

                        {
                            var3_10[var4_16][var5_22] = gu_0.do[4];
                            ++var5_22;
lbl121:
                            // 2 sources

                            ** while (!gu_0.if((int)var5_22, (int)gu_0.do[6]))
                        }
lbl122:
                        // 1 sources

                        ++var4_16;
lbl123:
                        // 2 sources

                        ** while (!gu_0.if((int)var4_16, (int)gu_0.do[0]))
                    }
lbl124:
                    // 1 sources

                    var4_16 = gu_0.do[2];
                    var5_22 = gu_0.do[2];
                    "".length();
                    if (((33 ^ 108 ^ (50 ^ 122)) & (139 + 96 - 100 + 7 ^ 88 + 62 - 95 + 84 ^ -" ".length())) >= -" ".length()) ** GOTO lbl142
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var6_25 = var1_1.do.readByte();
                        if (gu_0.do(var6_25, gu_0.do[4])) {
                            if (gu_0.int(var4_16, gu_0.do[7])) {
                                ++var4_16;
                            }
                            var5_22 = gu_0.do[2];
                            "".length();
                            if ((120 ^ 125) != 0) continue;
                            return;
                        }
                        var3_10[var4_16][var5_22] = var6_25;
                        if (!gu_0.int(var5_22, gu_0.do[8])) continue;
                        ++var5_22;
lbl142:
                        // 4 sources

                        ** while (!gu_0.do((int)var1_1.do.available()))
                    }
lbl143:
                    // 1 sources

                    bx.case();
                    bW.do().do(var2_7, var3_10);
                    return;
                }
                case 67: {
                    var6_26 = var1_1.do.readBoolean();
                    var2_6 = gu_0.do[4];
                    if (gu_0.if((int)var6_26)) {
                        var2_6 = var1_1.do.readByte();
                    }
                    bx.case();
                    bW.do().do(var6_26, var2_6);
                    return;
                }
                case 68: {
                    var1_5 = var1_1.do.readByte();
                    bx.case();
                    bW.do().do(var1_5);
                    return;
                }
                case 69: {
                    var2_6 = var1_1.do.readInt();
                    var3_11 = new int[gu_0.do[0]];
                    var4_17 = gu_0.do[2];
                    "".length();
                    if ((128 ^ 133) > 0) ** GOTO lbl169
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var3_11[var4_17] = var1_1.do.readInt();
                        ++var4_17;
lbl169:
                        // 2 sources

                        ** while (!gu_0.if((int)var4_17, (int)gu_0.do[0]))
                    }
lbl170:
                    // 1 sources

                    bW.do().byte(var2_6);
                    return;
                }
                case 62: {
                    var4_18 = var1_1.do.readByte();
                    var2_6 = var1_1.do.readInt();
                    var3_8 = var1_1.do.readInt();
                    var5_23 = var1_1.do.readInt();
                    var6_27 = new int[gu_0.do[0]][gu_0.do[0]];
                    var7_30 = new int[gu_0.do[0]][gu_0.do[7]];
                    var8_31 = gu_0.do[2];
                    "".length();
                    if (null == null) ** GOTO lbl195
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var9_32 = gu_0.do[2];
                        "".length();
                        if (" ".length() > ((56 ^ 89) & ~(163 ^ 194))) ** GOTO lbl193
                        return;
lbl-1000:
                        // 1 sources

                        {
                            var6_27[var8_31][var9_32] = gu_0.do[4];
                            if (gu_0.int(var9_32, gu_0.do[7])) {
                                var7_30[var8_31][var9_32] = gu_0.do[4];
                            }
                            ++var9_32;
lbl193:
                            // 2 sources

                            ** while (!gu_0.if((int)var9_32, (int)gu_0.do[0]))
                        }
lbl194:
                        // 1 sources

                        ++var8_31;
lbl195:
                        // 2 sources

                        ** while (!gu_0.if((int)var8_31, (int)gu_0.do[0]))
                    }
lbl196:
                    // 1 sources

                    var8_31 = gu_0.do[2];
                    var9_32 = gu_0.do[2];
                    var10_33 = gu_0.do[2];
                    "".length();
                    if ((135 ^ 142 ^ (15 ^ 3)) != 0) ** GOTO lbl213
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var11_34 = gu_0.do[2];
                        "".length();
                        if ("  ".length() >= -" ".length()) ** GOTO lbl211
                        return;
                        while (gu_0.for(var12_35 = var1_1.do.readByte(), gu_0.do[9]) && gu_0.for(var12_35, gu_0.do[4])) {
                            var7_30[var10_33][var11_34] = var12_35;
                            ++var11_34;
lbl211:
                            // 2 sources

                            if (!gu_0.if(var11_34, gu_0.do[7])) continue;
                        }
                        ++var10_33;
lbl213:
                        // 2 sources

                        ** while (!gu_0.if((int)var10_33, (int)gu_0.do[0]))
                    }
lbl214:
                    // 1 sources

                    "".length();
                    if (((27 ^ 0) & ~(179 ^ 168)) == 0) ** GOTO lbl229
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var10_33 = var1_1.do.readByte();
                        if (gu_0.int(var8_31, gu_0.do[7]) && gu_0.do(var10_33, gu_0.do[4])) {
                            ++var8_31;
                            var9_32 = gu_0.do[2];
                            "".length();
                            if ("   ".length() >= 0) continue;
                            return;
                        }
                        var6_27[var8_31][var9_32] = var10_33;
                        if (!gu_0.int(var9_32, gu_0.do[7])) continue;
                        ++var9_32;
lbl229:
                        // 4 sources

                        ** while (!gu_0.do((int)var1_1.do.available()))
                    }
lbl230:
                    // 1 sources

                    bW.do().do(var4_18, var2_6, var3_8, var6_27, var7_30, var5_23);
                    return;
                }
                case 70: {
                    var1_1.do.readInt();
                    "".length();
                    bW.do().case();
                }
            }
            return;
        }
        catch (Exception v0) {
            v0.printStackTrace();
            return;
        }
    }

    private static boolean int(int n, int n2) {
        return n < n2;
    }
}

