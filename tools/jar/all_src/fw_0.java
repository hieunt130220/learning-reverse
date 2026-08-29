/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from fW
 */
public final class fw_0
extends bH
implements bK {
    private static final int[] do;
    public static fw_0 do;

    private static boolean do(Object object) {
        return object != null;
    }

    static {
        fw_0.for();
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean if(Object object) {
        return object == null;
    }

    public static eh do(bm bm2) {
        eh eh2 = new eh();
        new eh().char = (byte)bm2.do.readInt();
        eh2.do(bm2.do.readUTF());
        byte by2 = bm2.do.readByte();
        int n = do[1];
        while (fw_0.do(n, by2)) {
            eh2.do(new cj(bm2.do.readShort()));
            ++n;
            "".length();
            if (-" ".length() < (0x92 ^ 0xA1 ^ (0xA5 ^ 0x92))) continue;
            return null;
        }
        short s2 = bm2.do.readShort();
        eh2.else = (byte)s2;
        eh2.int = (Vector)s2;
        eh2.byte = bm2.do.readShort();
        eh2.for = eh2.byte;
        eh2.long = bm2.do.readByte();
        eh2.do = (byte)(do[4] - bm2.do.readByte());
        eh2.const = bm2.do.readShort();
        eh2.for = bm2.do.readShort();
        return eh2;
    }

    public final void do(bm object) {
        try {
            switch (((bm)object).do) {
                case -69: {
                    bx.if(bT.bI, new al_0());
                    return;
                }
                case -68: {
                    byte by2 = ((bm)object).do.readByte();
                    int n = ((bm)object).do.readInt();
                    gs_0.do();
                    "".length();
                    gs_0.do(by2, n);
                    return;
                }
                case 51: {
                    gs_0.do();
                    "".length();
                    gs_0.if(fw_0.do((bm)object));
                    return;
                }
                case 53: {
                    int n = ((bm)object).do.readInt();
                    gs_0.do();
                    "".length();
                    gs_0.new(n);
                    return;
                }
                case 54: {
                    fj_0.do((bm)object);
                    return;
                }
                case 55: {
                    fj_0.if((bm)object);
                    return;
                }
                case 57: {
                    int n = ((bm)object).do.readInt();
                    byte by3 = ((bm)object).do.readByte();
                    gs_0.do();
                    "".length();
                    gs_0.if(n, by3);
                    return;
                }
                case 58: {
                    int n = ((bm)object).do.readInt();
                    int n9 = ((bm)object).do.readInt();
                    short n8 = ((bm)object).do.readShort();
                    String by8 = "";
                    if (fw_0.for(n8, do[0])) {
                        by8 = ((bm)object).do.readUTF();
                    }
                    ((bm)object).do.readInt();
                    "".length();
                    ((bm)object).do.readByte();
                    "".length();
                    System.out.println("AVATAR_GIFT_GIVING: " + ((bm)object).do.available());
                    int nArray = ((bm)object).do.readInt();
                    int n2 = ((bm)object).do.readInt();
                    int n5 = ((bm)object).do.readInt();
                    gs_0.do().do(n, n9, (int)n8, by8, nArray, n2, n5);
                    return;
                }
                case 59: {
                    n = ((bm)object).do.readInt();
                    int s6 = ((bm)object).do.readInt();
                    short n12 = ((bm)object).do.readShort();
                    String string = "";
                    int by7 = do[1];
                    if (fw_0.for(n12, do[0])) {
                        string = ((bm)object).do.readUTF();
                        "".length();
                        if (-" ".length() >= 0) {
                            return;
                        }
                    } else {
                        by7 = ((bm)object).do.readShort();
                    }
                    if (fw_0.do(bx_0.do) && (!fw_0.do(bx_0.do instanceof N) || !fw_0.do(bx_0.do instanceof bO) || fw_0.if(bx_0.do instanceof V))) {
                        if (fw_0.for(n12, do[0])) {
                            bx_0.do.do(string);
                            "".length();
                            aq_0.byte();
                            if (fw_0.if(bx_0.do instanceof bO)) {
                                bO.do = System.currentTimeMillis();
                                return;
                            }
                            if (fw_0.if(bx_0.do instanceof N)) {
                                N.do = System.currentTimeMillis();
                            }
                            return;
                        }
                        if (fw_0.for(n12, do[2])) {
                            if (fw_0.if(bx_0.do instanceof bO) && fw_0.for(n, AngelChip.do.char)) {
                                aq_0.byte();
                                bO.do += do[3];
                                bO.do = System.currentTimeMillis();
                                "".length();
                                if ((0x81 ^ 0x85) < 0) {
                                    return;
                                }
                            }
                        } else if (fw_0.for(n12, do[4])) {
                            if (fw_0.if(bx_0.do instanceof V)) {
                                if (fw_0.for(n, AngelChip.do.char)) {
                                    V.do().if += do[3];
                                    aq_0.case();
                                    "".length();
                                    if (((0xE6 ^ 0xAF) & ~(0x30 ^ 0x79)) > ((0x30 ^ 0x24) & ~(0x9D ^ 0x89))) {
                                        return;
                                    }
                                }
                            } else if (fw_0.if(bx_0.do instanceof N)) {
                                if (fw_0.for(n, AngelChip.do.char)) {
                                    aq_0.byte();
                                    N.do += do[3];
                                    N.do = System.currentTimeMillis();
                                    "".length();
                                    if (((0xAF ^ 0x9B) & ~(0x64 ^ 0x50)) != ((0x47 ^ 1) & ~(0x4C ^ 0xA))) {
                                        return;
                                    }
                                }
                            } else if (fw_0.if(bx_0.do instanceof bO) && fw_0.do(aq_0.for(fj.new) ? 1 : 0)) {
                                bO.do = System.currentTimeMillis() + 1000L;
                            }
                        }
                    }
                    gs_0.do().do(n, s6, (int)n12, string, by7);
                    return;
                }
                case 60: {
                    byte by4 = ((bm)object).do.readByte();
                    int[] n10 = new int[by4];
                    int string = do[1];
                    while (fw_0.do(string, by4)) {
                        n10[string] = ((bm)object).do.readByte();
                        ++string;
                        "".length();
                        if (-" ".length() != " ".length()) continue;
                        return;
                    }
                    gs_0.do().do(n10);
                    bx.case();
                    return;
                }
                case 78: {
                    return;
                }
                case 82: {
                    int eh2 = ((bm)object).do.readInt();
                    w_0.do().int(eh2);
                    return;
                }
                case 84: {
                    n = ((bm)object).do.readInt();
                    short s4 = ((bm)object).do.readShort();
                    w_0.do().for(n, s4);
                    return;
                }
                case 85: {
                    n = ((bm)object).do.readInt();
                    w_0.do().for(n);
                    return;
                }
                case 86: {
                    n = ((bm)object).do.readBoolean();
                    String by6 = "";
                    if (fw_0.do(n)) {
                        by6 = ((bm)object).do.readUTF();
                    }
                    n = n;
                    object = w_0.do();
                    if (fw_0.if(n)) {
                        aq_0.long();
                        ((w_0)object).do.do();
                        ((ep)object).new = ((w_0)object).do;
                        ((ep)object).try();
                        fq.if(bx.char / do[5]);
                        bx.case();
                        if (fw_0.do(bx_0.do) && fw_0.if(bx_0.do instanceof bs_0)) {
                            bs_0.do().for = do[5];
                            bs_0.do().do(do[3]);
                            return;
                        }
                    } else {
                        bx.do(by6, do[1], (dH)object);
                    }
                    return;
                }
                case 87: {
                    n = ((bm)object).do.readInt();
                    byte by5 = ((bm)object).do.readByte();
                    w_0.do();
                    "".length();
                    byte n13 = by5;
                    eh s7 = fj.do(n);
                    if (fw_0.do(s7) && (!fw_0.if(s7.byte, do[6]) || fw_0.for(s7.byte, do[7]))) {
                        ew_0 ew_02 = new ew_0();
                        gs_0.do.addElement(ew_02);
                        ew_02.do(s7);
                        ew_02.if();
                        ew_02.if[ew_02.do - fw_0.do[3]].if = (int)(s7.int + do[8] + (dH.this - do[3]) * do[9] + hi.for(do[10]));
                        ew_02.if[ew_02.do - fw_0.do[3]].for = s7.for ? 1 : 0;
                        ew_02.int = do[3];
                        ew_02.do = do[0];
                        ew_02.do(do[3]);
                        if (fw_0.for(n13, do[6])) {
                            ew_02.for = do[3];
                            return;
                        }
                        if (fw_0.for(n13, do[5])) {
                            ew_02.for = do[3];
                            ew_02.if = do[3];
                            ew_02.if = do[6];
                        }
                    }
                    return;
                }
                case 88: {
                    n = ((bm)object).do.readInt();
                    byte by2 = ((bm)object).do.readByte();
                    byte by3 = ((bm)object).do.readByte();
                    int n = ((bm)object).do.readInt();
                    short s5 = ((bm)object).do.readShort();
                    w_0.do();
                    "".length();
                    w_0.do(n, by2, by3, n, s5);
                    return;
                }
                case 91: {
                    int n = ((bm)object).do.readInt();
                    short s2 = ((bm)object).do.readShort();
                    short s3 = ((bm)object).do.readShort();
                    byte by4 = ((bm)object).do.readByte();
                    byte[][] byArrayArray = new byte[by4][];
                    int n3 = do[1];
                    while (fw_0.do(n3, by4)) {
                        short s4 = ((bm)object).do.readShort();
                        byArrayArray[n3] = new byte[s4];
                        ((bm)object).do.read(byArrayArray[n3]);
                        "".length();
                        ++n3;
                        "".length();
                        if ("  ".length() > 0) continue;
                        return;
                    }
                    w_0.do().do(n, s2, s3, byArrayArray);
                    return;
                }
                case 92: {
                    gs_0.int = ((bm)object).do.readBoolean();
                    if (!fw_0.if(gs_0.int ? 1 : 0)) break;
                    AngelChip.do.short = ((bm)object).do.readShort();
                    return;
                }
                case 93: {
                    int n = ((bm)object).do.readInt();
                    int n11 = ((bm)object).do.readInt();
                    gs_0.do().for(n, n11);
                }
            }
            return;
        }
        catch (Exception exception) {
            exception.printStackTrace();
            return;
        }
    }

    public static void do() {
        if (fw_0.if(do)) {
            do = new fw_0();
        }
        fj_0.do().do = do;
    }

    private static void for() {
        do = new int[11];
        fw_0.do[0] = -" ".length();
        fw_0.do[1] = (0xA9 ^ 0xB7) & ~(0xB3 ^ 0xAD);
        fw_0.do[2] = 0x7E ^ 0x5E ^ (0x44 ^ 1);
        fw_0.do[3] = " ".length();
        fw_0.do[4] = 100 + 0 - 60 + 212 ^ 39 + 99 - -11 + 3;
        fw_0.do[5] = "   ".length();
        fw_0.do[6] = "  ".length();
        fw_0.do[7] = 0xAF ^ 0xA2;
        fw_0.do[8] = 0xFF ^ 0xB9;
        fw_0.do[9] = 0x18 ^ 0x2B ^ (0x53 ^ 0x43);
        fw_0.do[10] = 0xA ^ 0x13;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static boolean for(int n, int n2) {
        return n == n2;
    }
}

