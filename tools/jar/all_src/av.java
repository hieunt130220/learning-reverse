/*
 * Decompiled with CFR 0.152.
 */
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class av
extends hc {
    private boolean if = do[0];
    public static int do;
    private static final int[][] do;
    public static long do;
    private static final int[] do;
    public static boolean do;

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    /*
     * Loose catch block
     */
    static {
        block11: {
            av.new();
            do = do[2];
            do = 0L;
            do = do[0];
            int[][] nArray = new int[do[34]][do[18]];
            do = nArray;
            int[] nArray2 = new int[do[18]];
            nArray2[av.do[0]] = do[11];
            nArray2[av.do[1]] = do[35];
            nArray[av.do[12]] = nArray2;
            int[] nArray3 = new int[do[18]];
            nArray3[av.do[0]] = do[36];
            nArray3[av.do[1]] = do[35];
            av.do[av.do[11]] = nArray3;
            int[] nArray4 = new int[do[18]];
            nArray4[av.do[0]] = do[38];
            nArray4[av.do[1]] = do[39];
            av.do[av.do[37]] = nArray4;
            int[] nArray5 = new int[do[18]];
            nArray5[av.do[0]] = do[41];
            nArray5[av.do[1]] = do[42];
            av.do[av.do[40]] = nArray5;
            int[] nArray6 = new int[do[18]];
            nArray6[av.do[0]] = do[44];
            nArray6[av.do[1]] = do[42];
            av.do[av.do[43]] = nArray6;
            int[] nArray7 = new int[do[18]];
            nArray7[av.do[0]] = do[45];
            nArray7[av.do[1]] = do[46];
            av.do[av.do[10]] = nArray7;
            int[] nArray8 = new int[do[18]];
            nArray8[av.do[0]] = do[47];
            nArray8[av.do[1]] = do[48];
            av.do[av.do[9]] = nArray8;
            int[] nArray9 = new int[do[18]];
            nArray9[av.do[0]] = do[49];
            nArray9[av.do[1]] = do[42];
            av.do[av.do[8]] = nArray9;
            int[] nArray10 = new int[do[18]];
            nArray10[av.do[0]] = do[50];
            nArray10[av.do[1]] = do[51];
            av.do[av.do[7]] = nArray10;
            int[] nArray11 = new int[do[18]];
            nArray11[av.do[0]] = do[52];
            nArray11[av.do[1]] = do[53];
            av.do[av.do[6]] = nArray11;
            int[] nArray12 = new int[do[18]];
            nArray12[av.do[0]] = do[54];
            nArray12[av.do[1]] = do[55];
            av.do[av.do[5]] = nArray12;
            int[] nArray13 = new int[do[18]];
            nArray13[av.do[0]] = do[56];
            nArray13[av.do[1]] = do[57];
            av.do[av.do[4]] = nArray13;
            int[] nArray14 = new int[do[18]];
            nArray14[av.do[0]] = do[58];
            nArray14[av.do[1]] = do[59];
            av.do[av.do[3]] = nArray14;
            Object object = cs.do("AicapSettings");
            if (!av.do(object)) break block11;
            object = new ByteArrayInputStream((byte[])object);
            DataInputStream dataInputStream = new DataInputStream((InputStream)object);
            do = dataInputStream.readInt();
            do = dataInputStream.readBoolean();
            try {
                dataInputStream.close();
                ((ByteArrayInputStream)object).close();
            }
            catch (IOException iOException) {
                "".length();
            }
            break block11;
            catch (IOException iOException) {
                "".length();
                cs.do("AicapSettings");
                try {
                    dataInputStream.close();
                    ((ByteArrayInputStream)object).close();
                }
                catch (IOException iOException2) {
                    "".length();
                }
                catch (Throwable throwable) {
                    try {
                        dataInputStream.close();
                        ((ByteArrayInputStream)object).close();
                        "".length();
                    }
                    catch (IOException iOException3) {
                        "".length();
                    }
                    if (-"  ".length() >= 0) {
                        break block11;
                    }
                    throw throwable;
                }
            }
        }
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean for(int n) {
        return n > 0;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void int() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeInt((int)do);
            dataOutputStream.writeBoolean(do);
            dataOutputStream.flush();
            byteArrayOutputStream.flush();
            cs.do("AicapSettings", byteArrayOutputStream.toByteArray());
        }
        catch (IOException iOException) {
            "".length();
            try {
                byteArrayOutputStream.close();
                dataOutputStream.close();
                return;
            }
            catch (IOException iOException2) {
                "".length();
                return;
            }
        }
        catch (Throwable throwable) {
            try {
                byteArrayOutputStream.close();
                dataOutputStream.close();
                "".length();
            }
            catch (IOException iOException) {
                "".length();
                throw throwable;
            }
            if ((0x4E ^ 0x4A) != -" ".length()) throw throwable;
            return;
        }
        try {
            byteArrayOutputStream.close();
            dataOutputStream.close();
            return;
        }
        catch (IOException iOException) {
            "".length();
            return;
        }
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public final boolean do(String string) {
        if (av.do(string.startsWith("B\u1ea1n \u0111\u00e3 \u0103n") ? 1 : 0)) {
            aq_0.case();
            return do[1];
        }
        if (!av.if(string.startsWith("B\u1ea1n ph\u1ea3i c\u00f3") ? 1 : 0) || av.if(string.indexOf("B\u1ea1n kh\u00f4ng th\u1ec3"), do[2])) {
            this.if = do[1];
            aq_0.for();
            return do[0];
        }
        if (av.do(string.startsWith("Ng\u01b0\u01a1i \u0111\u00e3 c\u00f3 1 t\u1ea5m v\u00e9") ? 1 : 0)) {
            aq_0.try();
            return do[1];
        }
        return super.do(string);
    }

    public final void for() {
        super.for();
        this.if = do[0];
    }

    public final String toString() {
        return "Auto Ai C\u1eadp";
    }

    protected final void if() {
        long l;
        if (av.for(av.do(System.currentTimeMillis() - this.try, 180000L))) {
            aq_0.else();
            aq_0.do(16000L);
            return;
        }
        if (av.do(bx.do instanceof fo_0)) {
            return;
        }
        if (av.do(this.if ? 1 : 0)) {
            this.if = do[0];
            aq_0.if(2000L);
            gs_0.do().return();
            aq_0.if(2000L);
            return;
        }
        if (av.do(fj.new, do[3])) {
            dF dF2 = aq_0.do("nu.hoang");
            if (av.do(dF2)) {
                fp.do().for(dF2.char, do[0], do[0]);
                if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                    this.try = System.currentTimeMillis();
                    aq_0.if(2000L);
                }
            }
            return;
        }
        if (av.do(fj.new, do[4])) {
            fj.int = do[do[3]][do[0]];
            fj.byte = do[do[3]][do[1]];
            fp.do().do(do[3], do[2]);
            if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(1000L);
            }
            return;
        }
        if (av.do(fj.new, do[5])) {
            fj.int = do[do[4]][do[0]];
            fj.byte = do[do[4]][do[1]];
            fp.do().do(do[4], do[2]);
            if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(do);
            }
            return;
        }
        if (av.do(fj.new, do[6])) {
            fj.int = do[do[5]][do[0]];
            fj.byte = do[do[5]][do[1]];
            fp.do().do(do[5], do[2]);
            if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(do);
            }
            return;
        }
        if (av.do(fj.new, do[7])) {
            fj.int = do[do[6]][do[0]];
            fj.byte = do[do[6]][do[1]];
            fp.do().do(do[6], do[2]);
            if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(do);
            }
            return;
        }
        if (av.do(fj.new, do[8])) {
            fj.int = do[do[7]][do[0]];
            fj.byte = do[do[7]][do[1]];
            fp.do().do(do[7], do[2]);
            if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(do);
            }
            return;
        }
        if (av.do(fj.new, do[9])) {
            fj.int = do[do[8]][do[0]];
            fj.byte = do[do[8]][do[1]];
            fp.do().do(do[8], do[2]);
            if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(do);
            }
            return;
        }
        if (av.do(fj.new, do[10])) {
            fj.int = do[do[9]][do[0]];
            fj.byte = do[do[9]][do[1]];
            fp.do().do(do[9], do[2]);
            if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(do);
            }
            return;
        }
        if (av.do(fj.new, do[11])) {
            fj.int = do[do[10]][do[0]];
            fj.byte = do[do[10]][do[1]];
            fp.do().do(do[10], do[2]);
            if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(do);
            }
            return;
        }
        if (av.do(fj.new, do[12])) {
            fj.int = do[do[11]][do[0]];
            fj.byte = do[do[11]][do[1]];
            fp.do().do(do[11], do[2]);
            if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(do);
            }
            return;
        }
        if (av.do(fj.new, do[13])) {
            fj.int = do[do[12]][do[0]];
            fj.byte = do[do[12]][do[1]];
            fp.do().do(do[12], do[2]);
            if (av.do(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(do);
            }
            return;
        }
        if (av.do(fj.new, do[14])) {
            if (av.do(do ? 1 : 0)) {
                int[] nArray = new int[do[15]];
                nArray[av.do[0]] = do[16];
                nArray[av.do[1]] = do[17];
                nArray[av.do[18]] = do[19];
                nArray[av.do[20]] = do[21];
                nArray[av.do[22]] = do[23];
                nArray[av.do[24]] = do[25];
                int[] nArray2 = nArray;
                av av2 = this;
                this.for = null;
                fv_0.do().void(AngelChip.do.char);
                if (av.do(aq_0.if(15000L) ? 1 : 0) && av.do(av2.for)) {
                    int n = do[0];
                    while (av.for(n, av2.for.size())) {
                        cj cj2 = (cj)av2.for.elementAt(n);
                        if (av.do(cj2)) {
                            int n2;
                            block48: {
                                short s2 = cj2.do;
                                int[] nArray3 = nArray2;
                                int n3 = do[0];
                                while (av.for(n3, nArray3.length)) {
                                    if (av.do(nArray3[n3], s2)) {
                                        n2 = do[1];
                                        "".length();
                                        if ("   ".length() <= 0) {
                                            return;
                                        }
                                        break block48;
                                    }
                                    ++n3;
                                    "".length();
                                    if (((0x57 ^ 0x4D) & ~(0x89 ^ 0x93)) > -" ".length()) continue;
                                    return;
                                }
                                n2 = do[0];
                            }
                            if (av.do(n2)) {
                                fv_0.do().for(cj2.do, do[1]);
                                aq_0.if(50L);
                            }
                        }
                        ++n;
                        "".length();
                        if ("   ".length() <= "   ".length()) continue;
                        return;
                    }
                }
                av2.for = null;
            }
            if (av.for(AngelChip.do.if, do[26])) {
                int n;
                if (av.for(AngelChip.do.do[do[0]], do[27])) {
                    bx_0.try();
                    bx.if("Kh\u00f4ng \u0111\u1ee7 xu mua b\u00e1nh m\u1ef3");
                    return;
                }
                if (av.if((int)AngelChip.do.int, do[28]) && av.if(AngelChip.do.for ? 1 : 0, do[29])) {
                    AngelChip.do.do(do[28], do[29]);
                    fp.do().do(do[28], do[29], do[18], do[0]);
                    aq_0.if(500L);
                }
                fp fp2 = fp.do();
                if (av.for(AngelChip.do.if, do[4])) {
                    n = do[30];
                    "".length();
                    if (null != null) {
                        return;
                    }
                } else {
                    n = do[31];
                }
                fp2.do((short)n);
                if (av.do(aq_0.byte(15000L) ? 1 : 0)) {
                    aq_0.if(500L);
                }
                return;
            }
            if (av.for(do, do[32])) {
                bx_0.try();
                bx.if("Kh\u00f4ng t\u00ecm th\u1ea5y npc: pharaoh");
                return;
            }
            if (av.for(AngelChip.do.do[do[0]], do[33])) {
                bx_0.try();
                bx.if("Kh\u00f4ng \u0111\u1ee7 xu mua v\u00e9");
                return;
            }
            fp.do().do(do, do[0], do[0]);
            if (av.if(aq_0.try(15000L) ? 1 : 0)) {
                return;
            }
            aq_0.if(500L);
            if (av.do(aq_0.byte(do[13]) ? 1 : 0)) {
                aq_0.if(1000L);
            }
            return;
        }
        if ((!av.if(bx.do instanceof gQ) || av.do(fj.new, do[2])) && av.int(av.do(l = System.currentTimeMillis() - this.new, 2000L))) {
            aq_0.if(2000L - l);
        }
        if (av.do(aq_0.byte(do[14]) ? 1 : 0)) {
            aq_0.if(2500L);
        }
    }

    private static boolean int(int n) {
        return n < 0;
    }

    private static boolean for(int n, int n2) {
        return n < n2;
    }

    private static void new() {
        do = new int[60];
        av.do[0] = (0xAB ^ 0xB0) & ~(0x38 ^ 0x23);
        av.do[1] = " ".length();
        av.do[2] = -" ".length();
        av.do[3] = 5 ^ 0x29;
        av.do[4] = 86 + 38 - -59 + 4 ^ 6 + 29 - -57 + 45;
        av.do[5] = 0x1C ^ 0x4C ^ 96 + 65 - 123 + 89;
        av.do[6] = 24 + 81 - 66 + 114 ^ 20 + 104 - 41 + 92;
        av.do[7] = 101 + 17 - 109 + 148 ^ 132 + 89 - 199 + 160;
        av.do[8] = 0x7A ^ 0x50;
        av.do[9] = 0x94 ^ 0x90 ^ (0x78 ^ 0x55);
        av.do[10] = 0x75 ^ 0x5D;
        av.do[11] = 7 ^ 0xE ^ (0xAB ^ 0x86);
        av.do[12] = 113 + 16 - 30 + 74 ^ 32 + 40 - 65 + 135;
        av.do[13] = 0x2F ^ 0xD;
        av.do[14] = 0x3F ^ 0x1E;
        av.do[15] = 0xEB ^ 0xA3 ^ (0x15 ^ 0x5B);
        av.do[16] = -(0xFFFFFFC9 & 0x17F7) & (0xFFFF9FF6 & Short.MAX_VALUE);
        av.do[17] = -(0xFFFFF5DF & 0x4F29) & (0xFFFFEDBF & 0x5F7F);
        av.do[18] = "  ".length();
        av.do[19] = -(0xFFFFFFAD & 0x60DA) & (0xFFFFFCFF & 0x6BBF);
        av.do[20] = "   ".length();
        av.do[21] = 0xFFFFBDBD & 0x4A7B;
        av.do[22] = 0x23 ^ 0x27;
        av.do[23] = -(0xFFFFFEDB & 0x37E5) & (0xFFFFBEFE & 0x7FFB);
        av.do[24] = 0x46 ^ 0x43;
        av.do[25] = -(0xFFFFFF97 & 0x1369) & (0xFFFFFB3F & 0x1FFB);
        av.do[26] = 77 + 176 - 242 + 200 ^ 83 + 162 - 123 + 61;
        av.do[27] = -(0xFFFFCBE3 & 0x741F) & (0xFFFFCFD7 & 0x77FA);
        av.do[28] = -(0xFFFF931C & 0x7EFF) & (0xFFFFF3FB & 0x1FFF);
        av.do[29] = 133 + 70 - 168 + 143 ^ 82 + 71 - 81 + 59;
        av.do[30] = 0x93 ^ 0x9B;
        av.do[31] = 0xBB ^ 0xBC;
        av.do[32] = 0xFFFFFEAF & 0x77359550;
        av.do[33] = -(0xFFFFF2DF & 0x3D24) & (0xFFFFBFBF & 0x7BFB);
        av.do[34] = 0x2D ^ 0x16;
        av.do[35] = 153 + 77 - 195 + 147 + (0xE ^ 0x4F) - (131 + 123 - 170 + 51) + (0xD3 ^ 0x82);
        av.do[36] = -(0xFFFFFF33 & 0x3ECF) & (0xFFFFBFFE & 0x7FBF);
        av.do[37] = 0xA ^ 0x2F;
        av.do[38] = -(0xFFFFFFAB & 0x2E57) & (0xFFFFBFEE & 0x6FFF);
        av.do[39] = -(0xFFFFE6FB & 0x3FF7) & (0xFFFFEFFF & 0x37FB);
        av.do[40] = 0xA1 ^ 0x87;
        av.do[41] = 0xFFFFE72A & 0x19DD;
        av.do[42] = 0x68 ^ 0x3D;
        av.do[43] = 93 + 68 - 151 + 146 ^ 149 + 128 - 237 + 147;
        av.do[44] = 158 + 213 - 274 + 119;
        av.do[45] = 96 + 75 - 80 + 149;
        av.do[46] = -(0xFFFFBC73 & 0x5FEF) & (0xFFFFFF7F & 0x1DF7);
        av.do[47] = 0xFFFFB7A6 & 0x49FD;
        av.do[48] = 85 + 89 - 87 + 118;
        av.do[49] = 163 + 3 - 32 + 94;
        av.do[50] = 0xFFFF9143 & 0x6FBC;
        av.do[51] = 163 + 194 - 316 + 196 ^ 45 + 48 - -41 + 30;
        av.do[52] = 0x69 ^ 0x11;
        av.do[53] = 0x43 ^ 0x12;
        av.do[54] = 0xFFFFA7FC & 0x59FF;
        av.do[55] = 0xCF ^ 0x99;
        av.do[56] = 0xFFFFEFBF & 0x1154;
        av.do[57] = -(0xFFFFE6FF & 0x7D5B) & (0xFFFFEDFF & 0x77FF);
        av.do[58] = 0xFFFFDD3F & 0x23EF;
        av.do[59] = -(0xFFFFFFC7 & 0x72FB) & (0xFFFFFFFF & 0x73FB);
    }
}

