/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class bv
extends bH
implements bK {
    public static bv do;
    public static y_0 do;
    private static int[] do;
    public bK do;

    static {
        bv.for();
        do = new bv();
    }

    private static boolean do(int n) {
        return n <= 0;
    }

    private static boolean do(Object object) {
        return object == null;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    /*
     * Unable to fully structure code
     */
    public final void do(bm var1_1) {
        try {
            switch (var1_1.do) {
                case 61: {
                    switch (var1_1.do.readByte()) {
                        case 3: {
                            gr_0.do();
                            "".length();
                            if (" ".length() != 0) break;
                            return;
                        }
                        case 7: {
                            gu_0.do();
                            "".length();
                            if ((16 ^ 61 ^ (96 ^ 73)) != 0) break;
                            return;
                        }
                        case 21: {
                            dR.do();
                            "".length();
                            if (-" ".length() < "   ".length()) break;
                            return;
                        }
                        case 22: {
                            y_0.do = bv.do[0];
                            q.if = q.for;
                            fq_0.do(bv.do[1], ab_0.do());
                            if (bv.do(eu_0.do)) {
                                eu_0.do = new eu_0();
                            }
                            bv.do.do = eu_0.do;
                            "".length();
                            if ("   ".length() != "  ".length()) break;
                            return;
                        }
                        default: {
                            return;
                        }
                    }
                    bx.for(bT.as);
                    eb_0.do().do();
                    return;
                }
                case 6: {
                    var2_6 = new Vector<fn>();
                    "".length();
                    if (null == null) ** GOTO lbl54
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var3_16 = new fn();
                        new fn().do = var1_1.do.readByte();
                        var3_16.if = var1_1.do.readByte();
                        var1_1.do.readByte();
                        "".length();
                        var3_16.for = var1_1.do.readByte();
                        var2_6.addElement(var3_16);
lbl54:
                        // 2 sources

                        ** while (!bv.do((int)var1_1.do.available()))
                    }
lbl55:
                    // 1 sources

                    fq_0.do().do(var2_6);
                    fq_0.do().try();
                    bx.case();
                    return;
                }
                case 7: {
                    var3_17 = new Vector<gA>();
                    var2_7 = var1_1.do.readByte();
                    "".length();
                    if (((15 ^ 41 ^ (164 ^ 155)) & (37 ^ 96 ^ (87 ^ 11) ^ -" ".length())) < " ".length()) ** GOTO lbl93
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var4_23 = new gA();
                        new gA().for = var1_1.do.readByte();
                        var5_27 = var1_1.do.readUnsignedByte();
                        var4_23.if = (byte)(var5_27 % bv.do[2]);
                        var4_23.do = (byte)(var5_27 / bv.do[2]);
                        var6_29 = var1_1.do.readUnsignedByte();
                        if (bv.if(var6_29 & bv.do[3])) {
                            v0 = bv.do[3];
                            "".length();
                            if (" ".length() == 0) {
                                return;
                            }
                        } else {
                            var4_23.if = bv.do[4];
                            v0 = (int)var4_23.if;
                        }
                        if (bv.if(var6_29 & bv.do[5])) {
                            v1 = bv.do[3];
                            "".length();
                            if (((86 ^ 56 ^ (7 ^ 78)) & (225 ^ 178 ^ (16 ^ 100) ^ -" ".length())) != 0) {
                                return;
                            }
                        } else {
                            v1 = bv.do[4];
                        }
                        var4_23.do = v1;
                        var4_23.do = var1_1.do.readInt();
                        var4_23.do = String.valueOf(bx.do(var4_23.do)) + bT.do();
                        var3_17.addElement(var4_23);
lbl93:
                        // 2 sources

                        ** while (!bv.do((int)var1_1.do.available()))
                    }
lbl94:
                    // 1 sources

                    q.do().int = var2_7;
                    q.do().do(var3_17);
                    q.do().try();
                    q.do().case();
                    bx.case();
                    return;
                }
                case 8: {
                    bx.byte = bv.do[4];
                    var2_8 = var1_1.do.readByte();
                    var3_18 = var1_1.do.readByte();
                    var4_24 = var1_1.do.readInt();
                    var5_28 = var1_1.do.readInt();
                    var6_30 = new Vector<eh>();
                    "".length();
                    if (null == null) ** GOTO lbl142
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var7_31 = new eh();
                        new eh().char = var1_1.do.readInt();
                        if (!bv.do(var7_31.char, bv.do[6])) ** GOTO lbl120
                        var7_31.do("");
                        "".length();
                        if (-" ".length() >= "   ".length()) {
                            return;
                        }
                        ** GOTO lbl141
lbl120:
                        // 1 sources

                        if (bv.do(var7_31.char, AngelChip.do.char)) {
                            var7_31 = AngelChip.do;
                        }
                        var7_31.do(var1_1.do.readUTF());
                        var7_31.for(var1_1.do.readInt());
                        var8_33 = var1_1.do.readByte();
                        var9_35 = bv.do[4];
                        "".length();
                        if (-" ".length() < (88 ^ 92)) ** GOTO lbl134
                        return;
lbl-1000:
                        // 1 sources

                        {
                            var10_39 = new cj(var1_1.do.readShort());
                            if (bv.for(var7_31.char, AngelChip.do.char)) {
                                var7_31.do(var10_39);
                            }
                            ++var9_35;
lbl134:
                            // 2 sources

                            ** while (!bv.if((int)var9_35, (int)var8_33))
                        }
lbl135:
                        // 1 sources

                        var9_35 = var1_1.do.readInt();
                        var7_31.if(var9_35);
                        var7_31.for = var1_1.do.readBoolean();
                        var7_31.if(var9_35);
                        var7_31.for(var7_31.do());
                        var7_31.const = var1_1.do.readShort();
lbl141:
                        // 2 sources

                        var6_30.addElement(var7_31);
lbl142:
                        // 2 sources

                        ** while (!bv.do((int)var1_1.do.available()))
                    }
lbl143:
                    // 1 sources

                    bv.do.do(var2_8, var3_18, var4_24, var5_28, var6_30);
                    i_0.do().do = bv.do[3];
                    y_0.int = bv.do[4];
                    var7_32 = var6_30.size();
                    var8_33 = bv.do[4];
                    "".length();
                    if (((185 ^ 147) & ~(60 ^ 22)) <= 0) ** GOTO lbl158
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var9_37 = (eh)var6_30.elementAt(var8_33);
                        if (bv.do(var9_37.char, var4_24)) {
                            var9_37.for = bv.do[3];
                        }
                        if (bv.do(var9_37.char, AngelChip.do.char)) {
                            AngelChip.do.for(var9_37.do());
                        }
                        ++var8_33;
lbl158:
                        // 2 sources

                        ** while (!bv.if((int)var8_33, (int)var7_32))
                    }
lbl159:
                    // 1 sources

                    bv.do.long();
                    bv.do.try();
                    i_0.do();
                    "".length();
                    i_0.else();
                    bx.case();
                    bx.byte = bv.do[3];
                    return;
                }
                case 12: {
                    var8_34 = new eh();
                    var9_38 = var1_1.do.readByte();
                    var8_34.char = var1_1.do.readInt();
                    var8_34.do(var1_1.do.readUTF());
                    var8_34.for(var1_1.do.readInt());
                    var10_40 = var1_1.do.readByte();
                    var2_9 = bv.do[4];
                    "".length();
                    if ("  ".length() <= "  ".length()) ** GOTO lbl183
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var8_34.do(new cj(var1_1.do.readShort()));
                        ++var2_9;
lbl183:
                        // 2 sources

                        ** while (!bv.if((int)var2_9, (int)var10_40))
                    }
lbl184:
                    // 1 sources

                    var8_34.int = (byte)bv.do[4];
                    var8_34.if(var1_1.do.readInt());
                    var8_34.const = var1_1.do.readShort();
                    var8_34.for = bv.do[4];
                    i_0.do().do = bv.do[3];
                    var8_34.for = bv.do[4];
                    bv.do.do((int)var9_38, var8_34);
                    return;
                }
                case 14: {
                    var2_10 = var1_1.do.readInt();
                    var1_2 = var1_1.do.readInt();
                    if (bv.if((int)y_0.for) && bv.do(y_0.do, bv.do[5])) {
                        bv.do.if(bT.cu);
                    }
                    i_0.do().do = bv.do[3];
                    y_0.do.int(var2_10);
                    y_0.new(var1_2);
                    return;
                }
                case 16: {
                    var2_11 = var1_1.do.readInt();
                    var1_3 = var1_1.do.readBoolean();
                    if (bv.do(var2_11, AngelChip.do.char)) {
                        bx.case();
                    }
                    y_0.if(var2_11, var1_3);
                    return;
                }
                case 19: {
                    var2_12 = var1_1.do.readByte();
                    var3_19 = var1_1.do.readByte();
                    var1_4 = var1_1.do.readInt();
                    if (bv.if((int)y_0.do(var2_12, var3_19))) {
                        y_0.for(var1_4);
                        return;
                    }
                    break;
                }
                case 9: {
                    var2_13 = var1_1.do.readByte();
                    var3_20 = var1_1.do.readByte();
                    var4_25 = var1_1.do.readInt();
                    var1_1 = var1_1.do.readUTF();
                    if (bv.if((int)y_0.do(var2_13, var3_20))) {
                        y_0.do(var4_25, (String)var1_1);
                        return;
                    }
                    break;
                }
                case 11: {
                    var2_14 = var1_1.do.readByte();
                    var3_21 = var1_1.do.readByte();
                    var1_5 = var1_1.do.readInt();
                    bx.do = null;
                    if (bv.if((int)y_0.do(var2_14, var3_21))) {
                        if (bv.do(var1_5, AngelChip.do.char)) {
                            bx.if(bT.k, new gf());
                            return;
                        }
                        y_0.do.int(var1_5);
                        return;
                    }
                    break;
                }
                case 52: {
                    var1_1.do.readByte();
                    "".length();
                    var1_1.do.readByte();
                    "".length();
                    var2_15 = var1_1.do.readInt();
                    var3_22 = var1_1.do.readInt();
                    var1_1 = var1_1.do.readUTF();
                    var4_26 = y_0.do(var2_15);
                    if (!bv.if(var3_22) || bv.do(var4_26)) {
                        return;
                    }
                    var4_26.for(var4_26.do() + var3_22);
                    if (bv.do(AngelChip.do.char, var2_15)) {
                        AngelChip.do.for(var4_26.do());
                    }
                    y_0.do(var2_15, (String)var1_1);
                    y_0.for(var2_15, var3_22);
                    return;
                }
                default: {
                    this.do.do((bm)var1_1);
                    return;
                }
            }
        }
        catch (Exception v2) {
            v2.printStackTrace();
        }
    }

    public static void do() {
        fj_0.do().do = do;
    }

    private static void for() {
        do = new int[7];
        bv.do[0] = 0x97 ^ 0x92;
        bv.do[1] = "   ".length();
        bv.do[2] = 37 + 155 - 133 + 113 ^ 92 + 134 - 127 + 89;
        bv.do[3] = " ".length();
        bv.do[4] = (125 + 45 - 37 + 74 ^ 137 + 11 - 103 + 103) & (45 + 126 - 119 + 197 ^ 16 + 105 - -5 + 36 ^ -" ".length());
        bv.do[5] = "  ".length();
        bv.do[6] = -" ".length();
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }
}

