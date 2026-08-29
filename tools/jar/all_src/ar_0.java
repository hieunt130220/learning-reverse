/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from aR
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class ar_0
implements bK {
    public static ar_0 do;
    private static final int[] do;

    static {
        ar_0.do();
    }

    private static boolean do(int n, int n2) {
        return n > n2;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    private static boolean for(int n, int n2) {
        return n < n2;
    }

    private static void do() {
        do = new int[6];
        ar_0.do[0] = 0xF0 ^ 0x85 ^ (0x17 ^ 0x64);
        ar_0.do[1] = (0x3E ^ 1) & ~(0xB7 ^ 0x88);
        ar_0.do[2] = " ".length();
        ar_0.do[3] = "   ".length();
        ar_0.do[4] = 0 ^ 9;
        ar_0.do[5] = 66 + 1 - -24 + 40 ^ 124 + 106 - 91 + 38;
    }

    public final void do(bm object) {
        try {
            switch (((bm)object).do) {
                case 1: {
                    short s2;
                    if (ar_0.do(((bm)object).do.readByte())) {
                        ed[] edArray = new ed[do[0]];
                        int n = do[1];
                        while (ar_0.for(n, do[0])) {
                            edArray[n] = new ed();
                            edArray[n].do = do[1];
                            edArray[n].char = ((bm)object).do.readByte();
                            edArray[n].char = ((bm)object).do.readByte();
                            edArray[n].if = ((bm)object).do.readShort();
                            edArray[n].do = ((bm)object).do.readShort();
                            ++n;
                            "".length();
                            if ("   ".length() > 0) continue;
                            return;
                        }
                        short s3 = ((bm)object).do.readShort();
                        ey_0.do().do(edArray, s3, do[1], do[2]);
                        return;
                    }
                    if (ar_0.do(((bm)object).do.readBoolean() ? 1 : 0)) {
                        ed[] edArray = new ed[do[0]];
                        int n = do[1];
                        while (ar_0.for(n, do[0])) {
                            edArray[n] = new ed();
                            edArray[n].do = do[1];
                            edArray[n].char = ((bm)object).do.readByte();
                            edArray[n].if = ((bm)object).do.readShort();
                            byte by2 = ((bm)object).do.readByte();
                            edArray[n].do = new short[by2];
                            edArray[n].if = new short[by2];
                            int n2 = do[1];
                            while (ar_0.for(n2, by2)) {
                                edArray[n].do[n2] = ((bm)object).do.readShort();
                                edArray[n].if[n2] = ((bm)object).do.readShort();
                                ++n2;
                                "".length();
                                if ("  ".length() < (115 + 95 - 162 + 82 ^ 72 + 102 - 165 + 125)) continue;
                                return;
                            }
                            ++n;
                            "".length();
                            if (((0x31 ^ 0x18) & ~(0xA7 ^ 0x8E)) <= ((0xBA ^ 0xA9) & ~(0x2B ^ 0x38))) continue;
                            return;
                        }
                        n = ((bm)object).do.readShort();
                        ey_0.do().do = ((bm)object).do.readShort();
                        ey_0.do().do = System.currentTimeMillis();
                        ey_0.do().do(edArray, (short)n, do[1], do[1]);
                        return;
                    }
                    int n = do[1];
                    while (ar_0.for(n, do[0])) {
                        s2 = ((bm)object).do.readByte();
                        ey_0.do().do[n].do = new short[s2];
                        ey_0.do().do[n].if = new short[s2];
                        int n3 = do[1];
                        while (ar_0.for(n3, s2)) {
                            ey_0.do().do[n].do[n3] = ((bm)object).do.readShort();
                            ey_0.do().do[n].if[n3] = ((bm)object).do.readShort();
                            ey_0.do();
                            "".length();
                            ++n3;
                            "".length();
                            if (" ".length() > 0) continue;
                            return;
                        }
                        ++n;
                        "".length();
                        if (("   ".length() & ("   ".length() ^ -" ".length())) == 0) continue;
                        return;
                    }
                    s2 = ((bm)object).do.readShort();
                    ey_0.do().do = ((bm)object).do.readShort();
                    ey_0.do().do = System.currentTimeMillis();
                    ey_0.do().do(null, s2, do[2], do[1]);
                    return;
                }
                case 2: {
                    short s4 = ((bm)object).do.readShort();
                    String string = ((bm)object).do.readUTF();
                    short s5 = ((bm)object).do.readShort();
                    short s6 = ((bm)object).do.readByte();
                    short s7 = ((bm)object).do.readByte();
                    byte by3 = ((bm)object).do.readByte();
                    short s8 = s4;
                    short s9 = s5;
                    short s10 = s6;
                    byte by4 = by3;
                    s6 = s7;
                    s5 = s10;
                    s4 = s9;
                    s7 = s8;
                    ey_0 ey_02 = ey_0.do();
                    ey_0.do().do = do[2];
                    ey_02.if = s7;
                    ey_02.do = string;
                    ey_02.int = s4;
                    ey_02.else = (byte)s5;
                    ey_02.char = (byte)s6;
                    ey_02.for = by4;
                    return;
                }
                case 5: {
                    byte by5 = ((bm)object).do.readByte();
                    int n = ((bm)object).do.readInt();
                    int n4 = do[1];
                    while (ar_0.for(n4, ey_0.do().do.length)) {
                        if (ar_0.if(by5, ey_0.do().do[n4].char)) {
                            ey_0.do().do[n4].do = n;
                            ey_0.do().do = (byte)n4;
                            "".length();
                            if (" ".length() < (0x6A ^ 0x6E)) break;
                            return;
                        }
                        ++n4;
                        "".length();
                        if (((14 + 36 - -104 + 58 ^ 9 + 81 - -84 + 9) & (9 + 11 - -179 + 0 ^ 99 + 137 - 205 + 133 ^ -" ".length())) <= 0) continue;
                        return;
                    }
                    bx.case();
                    aq_0.case();
                    return;
                }
                case 8: {
                    byte by6 = ((bm)object).do.readByte();
                    short[] sArray = new short[by6];
                    String[] stringArray = new String[by6];
                    int n = do[1];
                    while (ar_0.for(n, by6)) {
                        sArray[n] = ((bm)object).do.readShort();
                        stringArray[n] = ((bm)object).do.readUTF();
                        ++n;
                        "".length();
                        if (" ".length() > -" ".length()) continue;
                        return;
                    }
                    if (ar_0.if(by6)) {
                        bx.do = new ed_0(sArray, stringArray);
                        return;
                    }
                    bx.case();
                    return;
                }
                case 9: {
                    String string;
                    String string2 = string = ((bm)object).do.readUTF();
                    object = ey_0.do();
                    Vector<dF> vector = new Vector<dF>();
                    int n = fq.do().do;
                    if (!ar_0.do(((ey_0)object).for ? 1 : 0) || ar_0.do(((ey_0)object).if ? 1 : 0)) {
                        n += bx.char / do[3];
                    }
                    int n5 = do[1];
                    while (ar_0.for(n5, fj.if.size())) {
                        dF dF2 = (dF)fj.if.elementAt(n5);
                        if (ar_0.if(dF2.if ? 1 : 0, do[4]) && ar_0.do(dF2.int * dH.this, n) && ar_0.for(dF2.int * dH.this, n + bx.char)) {
                            vector.addElement(dF2);
                        }
                        ++n5;
                        "".length();
                        if ("  ".length() == "  ".length()) continue;
                        return;
                    }
                    if (ar_0.if(vector.size())) {
                        n5 = hi.for(vector.size());
                        ((eh)vector.elementAt((int)n5)).do = (byte)new cX(do[5], string2, do[1]);
                    }
                    return;
                }
                case 10: {
                    ey_0.do().do = new c_0();
                    ey_0.do().do.do = ((bm)object).do.readByte();
                    ey_0.do().do.do = ((bm)object).do.readUTF();
                    ey_0.do();
                    "".length();
                    ((bm)object).do.readByte();
                    "".length();
                    ey_0.do().do.if = ((bm)object).do.readInt();
                    ey_0.do().do.for = ((bm)object).do.readInt();
                    ey_0.do().do.do = ((bm)object).do.readInt();
                    ey_0.do().do.int = ((bm)object).do.readInt();
                }
            }
            return;
        }
        catch (Exception exception) {
            exception.printStackTrace();
            return;
        }
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean if(int n) {
        return n > 0;
    }
}

