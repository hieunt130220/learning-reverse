/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from gR
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class gr_0
extends bH
implements bK {
    private static gr_0 do;
    private static int[] do;

    /*
     * Unable to fully structure code
     * Could not resolve type clashes
     */
    public final void do(bm var1_1) {
        try {
            var2_4 = var1_1.do.readByte();
            var3_6 = var1_1.do.readByte();
            if (gr_0.do((int)y_0.do(var2_4, var3_6))) {
                return;
            }
            System.out.println("tienlen: " + var1_1.do);
            switch (var1_1.do) {
                case 51: {
                    var2_4 = var1_1.do.readInt();
                    var3_6 = var1_1.do.readByte();
                    var4_9 = var1_1.do.readInt();
                    var1_2 = var1_1.do.readInt();
                    i_0.do();
                    "".length();
                    i_0.do(var2_4, var3_6, var4_9, var1_2);
                    return;
                }
                case 50: {
                    i_0.do().do = gr_0.do[1];
                    i_0.do();
                    "".length();
                    i_0.case();
                    if (!gr_0.if(var1_1.do.available())) break;
                    var2_4 = var1_1.do.readInt();
                    v0 = var1_1.do.readByte();
                    var3_6 = v0;
                    var4_10 = new byte[v0];
                    var5_15 = gr_0.do[1];
                    "".length();
                    if (null == null) ** GOTO lbl38
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var4_10[var5_15] = var1_1.do.readByte();
                        ++var5_15;
lbl38:
                        // 2 sources

                        ** while (!gr_0.do((int)var5_15, (int)var3_6))
                    }
lbl39:
                    // 1 sources

                    i_0.do().do((int)var2_4, var4_10);
                    return;
                }
                case 20: {
                    var2_4 = var1_1.do.readByte();
                    var3_7 = new Vector<de_0>();
                    var4_11 = gr_0.do[1];
                    "".length();
                    if (null == null) ** GOTO lbl51
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var3_7.addElement(new de_0(var1_1.do.readByte()));
                        ++var4_11;
lbl51:
                        // 2 sources

                        ** while (!gr_0.do((int)var4_11, (int)gr_0.do[2]))
                    }
lbl52:
                    // 1 sources

                    var4_11 = var1_1.do.readInt();
                    bx.case();
                    y_0.break();
                    i_0.do().do(var4_11, var2_4, var3_7);
                    var1_1 = eb_0.do();
                    try {
                        var1_1.if(gr_0.do[3]);
                        "".length();
                    }
                    catch (Exception v1) {
                        "".length();
                    }
                    if ((98 ^ 102) <= ((102 ^ 79) & ~(51 ^ 26))) {
                        return;
                    }
                    var1_1.if();
                    return;
                }
                case 21: {
                    var5_16 = var1_1.do.readInt();
                    v2 = var1_1.do.readByte();
                    var2_4 = v2;
                    var3_8 = new byte[v2];
                    var4_12 = gr_0.do[1];
                    "".length();
                    if (((8 ^ 59) & ~(36 ^ 23)) == 0) ** GOTO lbl81
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var3_8[var4_12] = var1_1.do.readByte();
                        ++var4_12;
lbl81:
                        // 2 sources

                        ** while (!gr_0.do((int)var4_12, (int)var2_4))
                    }
lbl82:
                    // 1 sources

                    var4_12 = var1_1.do.readInt();
                    y_0.int = gr_0.do[4];
                    i_0.do().do(var5_16, var3_8, var4_12);
                    i_0.do().const();
                    return;
                }
                case 49: {
                    var2_4 = var1_1.do.readInt();
                    var3_6 = var1_1.do.readInt();
                    var1_3 = var1_1.do.readBoolean();
                    i_0.do().do((int)var2_4, (int)var3_6, var1_3);
                    return;
                }
                case 53: {
                    var3_6 = var1_1.do.readInt();
                    var2_5 = new byte[gr_0.do[2]];
                    try {
                        var4_13 = gr_0.do[1];
                        "".length();
                        if ((184 ^ 188) == (72 ^ 76)) ** GOTO lbl104
                        return;
lbl-1000:
                        // 1 sources

                        {
                            var2_5[var4_13] = var1_1.do.readByte();
                            ++var4_13;
lbl104:
                            // 2 sources

                            ** while (!gr_0.do((int)var4_13, (int)gr_0.do[2]))
                        }
lbl105:
                        // 1 sources

                        "".length();
                    }
                    catch (Exception v3) {
                        "".length();
                        var2_5 = null;
                    }
                    if (" ".length() < 0) {
                        return;
                    }
                    bx.case();
                    i_0.do();
                    "".length();
                    i_0.case();
                    if (gr_0.do(var2_5)) {
                        i_0.do().do((int)var3_6, var2_5);
                    }
                    y_0.do((int)var3_6, bT.aS);
                    return;
                }
                case 54: {
                    var4_14 = var1_1.do.readUTF();
                    i_0.do().do(var4_14);
                }
                default: {
                    return;
                }
            }
        }
        catch (Exception v4) {
            v4.printStackTrace();
        }
    }

    static {
        gr_0.for();
        do = new gr_0();
    }

    private static boolean do(int n) {
        return n == 0;
    }

    public static void do() {
        y_0.do = do[0];
        q.if = q.do;
        fq_0.do(do[1], i_0.do());
        bv.do.do = do;
    }

    private static void for() {
        do = new int[5];
        gr_0.do[0] = 0xFD ^ 0xBD ^ (0x1A ^ 0x5E);
        gr_0.do[1] = (0x84 ^ 0x93) & ~(0x5F ^ 0x48);
        gr_0.do[2] = 0xF8 ^ 0x8B ^ (0xBD ^ 0xC3);
        gr_0.do[3] = 0xBA ^ 0x8F;
        gr_0.do[4] = " ".length();
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }
}

