/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class dR
extends bH
implements bK {
    private static int[] do;
    private static dR do;

    private static boolean do(int n) {
        return n == 0;
    }

    static {
        dR.for();
        do = new dR();
    }

    private static void for() {
        do = new int[6];
        dR.do[0] = "  ".length();
        dR.do[1] = (44 + 105 - 112 + 107 ^ 126 + 64 - 168 + 144) & (80 + 6 - 25 + 68 ^ 76 + 158 - 116 + 65 ^ -" ".length());
        dR.do[2] = 0x93 ^ 0x9B;
        dR.do[3] = " ".length();
        dR.do[4] = 0x15 ^ 0x11;
        dR.do[5] = 0x78 ^ 0x66;
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static boolean for(int n) {
        return n > 0;
    }

    /*
     * Unable to fully structure code
     * Could not resolve type clashes
     */
    public final void do(bm var1_1) {
        try {
            var2_3 = var1_1.do.readByte();
            var3_5 = var1_1.do.readByte();
            if (dR.do((int)y_0.do(var2_3, (byte)var3_5))) {
                return;
            }
            switch (var1_1.do) {
                case 20: {
                    var2_3 = var1_1.do.readByte();
                    var3_5 = var1_1.do.readInt();
                    var4_8 = new byte[dR.do[2]][dR.do[2]];
                    var5_12 = dR.do[1];
                    "".length();
                    if (((178 ^ 159) & ~(132 ^ 169)) == 0) ** GOTO lbl25
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var6_18 = dR.do[1];
                        "".length();
                        if (-" ".length() < ((13 ^ 42 ^ (121 ^ 100)) & (76 + 89 - 149 + 130 ^ 66 + 154 - 201 + 149 ^ -" ".length()))) ** GOTO lbl23
                        return;
lbl-1000:
                        // 1 sources

                        {
                            var4_8[var5_12][var6_18] = var1_1.do.readByte();
                            ++var6_18;
lbl23:
                            // 2 sources

                            ** while (!dR.do((int)var6_18, (int)dR.do[2]))
                        }
lbl24:
                        // 1 sources

                        ++var5_12;
lbl25:
                        // 2 sources

                        ** while (!dR.do((int)var5_12, (int)dR.do[2]))
                    }
lbl26:
                    // 1 sources

                    var5_12 = dR.do[1];
                    "".length();
                    if ("   ".length() != ((249 ^ 152 ^ (22 ^ 66)) & (145 + 148 - 268 + 146 ^ 59 + 41 - 76 + 134 ^ -" ".length()))) ** GOTO lbl42
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var7_21 = y_0.do(var1_1.do.readInt());
                        y_0.do(var1_1.do.readInt()).goto = var1_1.do.readShort();
                        v0 = dR.do[1];
                        var7_21.if = (short)v0;
                        var7_21.final = (short)v0;
                        var7_21.this = var7_21.else = var1_1.do.readShort();
                        var7_21.try = var1_1.do.readShort();
                        var7_21.void = var1_1.do.readShort();
                        var7_21.case <<= dR.do[3];
                        var7_21.new(dR.do[4]);
                        ++var5_12;
lbl42:
                        // 2 sources

                        ** while (!dR.do((int)var5_12, (int)dR.do[0]))
                    }
lbl43:
                    // 1 sources

                    gK.do().do(var3_5, (int)var2_3, var4_8);
                    return;
                }
                case 64: {
                    var5_13 = var1_1.do.readByte();
                    var6_19 = new byte[var5_13];
                    var7_22 = new fw[var5_13];
                    var2_3 = dR.do[1];
                    "".length();
                    if ("  ".length() != "   ".length()) ** GOTO lbl59
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var7_22[var2_3] = new fw();
                        var6_19[var2_3] = var1_1.do.readByte();
                        var7_22[var2_3].do = var1_1.do.readByte();
                        var7_22[var2_3].do = var1_1.do.readByte();
                        ++var2_3;
lbl59:
                        // 2 sources

                        ** while (!dR.do((int)var2_3, (int)var5_13))
                    }
lbl60:
                    // 1 sources

                    var2_3 = var1_1.do.readByte();
                    var3_5 = var1_1.do.readByte();
                    var4_9 = new Vector<String>();
                    var5_13 = dR.do[1];
                    "".length();
                    if ((154 ^ 195 ^ (13 ^ 80)) >= 0) ** GOTO lbl71
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var8_23 = var1_1.do.readUTF();
                        var4_9.addElement(var8_23);
                        ++var5_13;
lbl71:
                        // 2 sources

                        ** while (!dR.do((int)var5_13, (int)var3_5))
                    }
lbl72:
                    // 1 sources

                    var5_13 = dR.do[1];
                    "".length();
                    if (-" ".length() <= " ".length()) ** GOTO lbl86
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var3_6 = y_0.do(var1_1.do.readInt());
                        y_0.do(var1_1.do.readInt()).break = var1_1.do.readByte();
                        var3_6.goto = var1_1.do.readShort();
                        var3_6.final = (short)(var1_1.do.readShort() - var3_6.this);
                        var3_6.if = (short)(var1_1.do.readShort() - var3_6.try);
                        var3_6.int = var1_1.do.readBoolean();
                        if (dR.if((int)var3_6.int)) {
                            gK.do().do = dR.do[3];
                        }
                        ++var5_13;
lbl86:
                        // 2 sources

                        ** while (!dR.do((int)var5_13, (int)dR.do[0]))
                    }
lbl87:
                    // 1 sources

                    gK.do().do(var6_19, var7_22, var2_3, var4_9);
                    return;
                }
                case 21: {
                    var5_14 = var1_1.do.readInt();
                    var8_24 = var1_1.do.readByte();
                    var3_5 = var1_1.do.readByte();
                    gK.do().do(var5_14, (int)var8_24, var3_5);
                    return;
                }
                case 49: {
                    var1_2 = var1_1.do.readInt();
                    gK.do().try(var1_2);
                    return;
                }
                case 24: {
                    var2_3 = var1_1.do.readInt();
                    var3_7 = new byte[dR.do[2]][dR.do[2]];
                    var4_10 = dR.do[1];
                    "".length();
                    if (null == null) ** GOTO lbl116
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var5_15 = dR.do[1];
                        "".length();
                        if (((147 + 165 - 256 + 115 ^ 83 + 127 - 119 + 58) & (72 + 81 - 143 + 136 ^ 141 + 30 - 109 + 110 ^ -" ".length())) == 0) ** GOTO lbl114
                        return;
lbl-1000:
                        // 1 sources

                        {
                            var3_7[var4_10][var5_15] = var1_1.do.readByte();
                            ++var5_15;
lbl114:
                            // 2 sources

                            ** while (!dR.do((int)var5_15, (int)dR.do[2]))
                        }
lbl115:
                        // 1 sources

                        ++var4_10;
lbl116:
                        // 2 sources

                        ** while (!dR.do((int)var4_10, (int)dR.do[2]))
                    }
lbl117:
                    // 1 sources

                    gK.do().do((int)var2_3, var3_7);
                    return;
                }
                case 51: {
                    var4_11 = new Vector<String>();
                    var5_16 = dR.do[1];
                    "".length();
                    if (-" ".length() < ((61 ^ 87 ^ (105 ^ 55)) & (121 ^ 29 ^ (47 ^ 127) ^ -" ".length()))) ** GOTO lbl147
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var2_3 = var1_1.do.readInt();
                        var3_5 = var1_1.do.readInt();
                        var2_4 = y_0.do(var2_3);
                        var2_4.case /= dR.do[0];
                        var2_4.byte = (byte)dR.do[1];
                        var2_4.for(var2_4.do() + var3_5);
                        if (dR.if(var3_5)) {
                            bx.if(var3_5, var2_4.int, var2_4.for, dR.do[5]);
                            var6_20 = String.valueOf(var2_4.do) + ": ";
                            if (dR.for(var3_5)) {
                                gK.do().super = var2_4.char;
                                var6_20 = String.valueOf(var6_20) + bT.bY + "   +" + var3_5 + bT.i;
                                "".length();
                                if (" ".length() < 0) {
                                    return;
                                }
                            } else {
                                var6_20 = String.valueOf(var6_20) + bT.static + "  " + var3_5 + bT.i;
                            }
                            var4_11.addElement("  ");
                            var4_11.addElement(var6_20);
                        }
                        ++var5_16;
lbl147:
                        // 2 sources

                        ** while (!dR.do((int)var5_16, (int)dR.do[0]))
                    }
lbl148:
                    // 1 sources

                    gK.do().do(var4_11);
                    return;
                }
                case 71: {
                    var5_17 = new byte[dR.do[2]][];
                    var2_3 = dR.do[1];
                    "".length();
                    if (-" ".length() <= 0) ** GOTO lbl159
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var5_17[var2_3] = new byte[dR.do[2]];
                        ++var2_3;
lbl159:
                        // 2 sources

                        ** while (!dR.do((int)var2_3, (int)dR.do[2]))
                    }
lbl160:
                    // 1 sources

                    var2_3 = dR.do[1];
                    "".length();
                    if (null == null) ** GOTO lbl174
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var3_5 = dR.do[1];
                        "".length();
                        if (-" ".length() <= "  ".length()) ** GOTO lbl172
                        return;
lbl-1000:
                        // 1 sources

                        {
                            var5_17[var2_3][var3_5] = var1_1.do.readByte();
                            ++var3_5;
lbl172:
                            // 2 sources

                            ** while (!dR.do((int)var3_5, (int)dR.do[2]))
                        }
lbl173:
                        // 1 sources

                        ++var2_3;
lbl174:
                        // 2 sources

                        ** while (!dR.do((int)var2_3, (int)dR.do[2]))
                    }
lbl175:
                    // 1 sources

                    gK.do().do(var5_17);
                    return;
                }
            }
            return;
        }
        catch (Exception v1) {
            v1.printStackTrace();
            return;
        }
    }

    public static void do() {
        y_0.do = do[0];
        q.if = (byte)do[1];
        fq_0.do(do[0], gK.do());
        bv.do.do = do;
    }
}

