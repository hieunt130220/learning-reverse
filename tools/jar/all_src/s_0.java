/*
 * Decompiled with CFR 0.152.
 */
import java.io.IOException;
import java.util.Vector;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from S
 */
public final class s_0
extends bH
implements bK {
    private static final int[] do;
    public static s_0 do;

    private static void if(bm bm2) {
        byte by2;
        byte by3;
        int n = bm2.do.readInt();
        Vector<eu> vector = new Vector<eu>();
        Vector<eu> vector2 = new Vector<eu>();
        int n2 = do[0];
        if (s_0.int(n, do[4])) {
            bp bp2;
            n2 = bm2.do.readByte();
            by3 = do[0];
            while (s_0.for(by3, n2)) {
                bp2 = new eu();
                new eu().byte = bm2.do.readByte();
                if (s_0.if(bp2.byte, do[4])) {
                    vector.addElement((eu)bp2);
                    "".length();
                    if (" ".length() < 0) {
                        return;
                    }
                } else {
                    s_0.do(bp2, bm2);
                    vector.addElement((eu)bp2);
                }
                ++by3;
                "".length();
                if ((0x58 ^ 0x5C) >= 0) continue;
                return;
            }
            by2 = bm2.do.readByte();
            if (!s_0.if(fj.new, do[18]) || s_0.int(AngelChip.do.char, n)) {
                fk.char = (byte)do[0];
                fg.do = (byte)do[0];
                gv_0.do = do[0];
                dT.byte.removeAllElements();
            }
            by3 = do[0];
            while (s_0.for(by3, by2)) {
                bp2 = null;
                byte by4 = bm2.do.readByte();
                int n3 = dT.byte.size();
                if (s_0.if(fj.new, do[18]) && s_0.int(n3) && s_0.if(n3, by2)) {
                    dT.do((int)by3);
                    "".length();
                    bp2 = (hu)dT.byte.elementAt(by3);
                    "".length();
                    if (-" ".length() > 0) {
                        return;
                    }
                } else {
                    go_0 go_02 = bC.do((int)by4);
                    if (s_0.int(by4, do[4])) {
                        switch (go_02.for) {
                            case 1: {
                                bp2 = new gv_0(by3, by4);
                                "".length();
                                if ((0x2D ^ 0x2B ^ "  ".length()) != 0) break;
                                return;
                            }
                            case 2: {
                                bp2 = new fk(by3, by4);
                                "".length();
                                if ("   ".length() >= "  ".length()) break;
                                return;
                            }
                            case 3: {
                                bp2 = new fg(by3, by4);
                                "".length();
                                if (" ".length() != "   ".length()) break;
                                return;
                            }
                            case 4: {
                                bp2 = new ff(by3, by4);
                            }
                        }
                    }
                }
                if (s_0.int(by4, do[4]) && s_0.do(bp2)) {
                    ((hu)bp2).else = by4;
                    s_0.do((hu)bp2, bm2);
                    vector2.addElement((eu)bp2);
                }
                ++by3;
                "".length();
                if (-" ".length() <= (0x11 ^ 0x26 ^ (0x4F ^ 0x7C))) continue;
                return;
            }
        }
        by2 = bm2.do.readByte();
        by3 = bm2.do.readByte();
        dT.do = new g_0();
        new g_0().do = bm2.do.readShort();
        dT.do.int = bm2.do.readShort();
        dT.do.for = bm2.do.readShort();
        dT.do.if = bm2.do.readShort();
        bm2.do.readShort();
        "".length();
        bm2.do.readShort();
        "".length();
        dT.do.do = bm2.do.readShort() * do[10];
        dT.do.do = System.currentTimeMillis();
        short s2 = do[0];
        while (s_0.for(s2, n2)) {
            eu eu2 = (eu)vector.elementAt(s2);
            ((eu)vector.elementAt(s2)).new = bm2.do.readByte();
            eu2.new = s2 + do[3];
            ++s2;
            "".length();
            if ("   ".length() != 0) continue;
            return;
        }
        s2 = do[0];
        int n4 = do[0];
        if (s_0.if(bm2.do.available())) {
            s2 = bm2.do.readShort();
            n4 = bm2.do.readShort() * do[10];
        }
        dT.do().do(n, vector, vector2, by2, by3, s2, n4);
    }

    static {
        s_0.do();
    }

    private static boolean do(int n) {
        return n >= 0;
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private static boolean do(int n, int n2) {
        return n > n2;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    private static boolean for(int n) {
        return n <= 0;
    }

    private static boolean for(int n, int n2) {
        return n < n2;
    }

    public final void do(bm object) {
        try {
            switch (((bm)object).do) {
                case 51: {
                    byte by2 = ((bm)object).do().readByte();
                    short[] sArray = new short[by2];
                    short[] sArray2 = new short[by2];
                    int n = do[0];
                    while (s_0.for(n, by2)) {
                        sArray[n] = ((bm)object).do().readShort();
                        sArray2[n] = ((bm)object).do().readShort();
                        ++n;
                        "".length();
                        if (-"  ".length() <= 0) continue;
                        return;
                    }
                    n = ((bm)object).do().readInt();
                    int n2 = ((bm)object).do().readInt();
                    bC.do(by2, sArray2, n, n2);
                    return;
                }
                default: {
                    return;
                }
                case 54: {
                    short s2 = ((bm)object).do().readShort();
                    short s3 = ((bm)object).do().readShort();
                    int n = ((bm)object).do().readUnsignedShort();
                    byte[] byArray = new byte[n];
                    int n3 = do[0];
                    while (s_0.for(n3, n)) {
                        byArray[n3] = ((bm)object).do().readByte();
                        ++n3;
                        "".length();
                        if ("  ".length() >= 0) continue;
                        return;
                    }
                    bC.do(s2, s3, byArray);
                    return;
                }
                case 55: {
                    byte[] byArray = new byte[((bm)object).do().available()];
                    ((bm)object).do().read(byArray);
                    "".length();
                    bC.do(byArray);
                    return;
                }
                case 56: {
                    byte[] byArray = new byte[((bm)object).do().available()];
                    ((bm)object).do().read(byArray);
                    "".length();
                    bC.if(byArray);
                    return;
                }
                case 60: {
                    Object object2;
                    byte by3 = ((bm)object).do().readByte();
                    Vector<ei_0> vector = new Vector<ei_0>();
                    Vector<Object> vector2 = new Vector<Object>();
                    boolean bl = do[0];
                    while (s_0.for(bl ? 1 : 0, by3)) {
                        ei_0 ei_02 = new ei_0();
                        new ei_0().do = ((bm)object).do().readByte();
                        ei_02.do = ((bm)object).do().readShort();
                        if (s_0.do(ei_02.do, do[1])) {
                            vector2.addElement(ei_02);
                            "".length();
                            if (((0x85 ^ 0x81) & ~(0xB9 ^ 0xBD)) != 0) {
                                return;
                            }
                        } else {
                            vector.addElement(ei_02);
                        }
                        bl += 1;
                        "".length();
                        if ((0x1B ^ 0x1F) >= 0) continue;
                        return;
                    }
                    byte by4 = ((bm)object).do().readByte();
                    Vector<ei_0> vector3 = new Vector<ei_0>();
                    int n = do[0];
                    while (s_0.for(n, by4)) {
                        object2 = new ei_0();
                        new ei_0().do = ((bm)object).do().readByte();
                        ((ei_0)object2).do = ((bm)object).do().readShort();
                        vector3.addElement((ei_0)object2);
                        ++n;
                        "".length();
                        if (-(0xF0 ^ 0xC2 ^ (0xE ^ 0x38)) < 0) continue;
                        return;
                    }
                    AngelChip.do.do[s_0.do[0]] = ((bm)object).do().readInt();
                    AngelChip.do.char = ((bm)object).do().readByte();
                    AngelChip.do.do = ((bm)object).do().readByte();
                    by3 = ((bm)object).do().readByte();
                    vector2 = new Vector();
                    bl = do[0];
                    while (s_0.for(bl ? 1 : 0, by3)) {
                        object2 = new ei_0();
                        new ei_0().do = ((bm)object).do().readShort();
                        ((ei_0)object2).do = ((bm)object).do().readShort();
                        vector2.addElement(object2);
                        bl += 1;
                        "".length();
                        if ("   ".length() == "   ".length()) continue;
                        return;
                    }
                    by4 = ((bm)object).do().readByte();
                    object2 = new Vector();
                    n = do[0];
                    while (s_0.for(n, by4)) {
                        ei_0 ei_03 = new ei_0();
                        new ei_0().do = ((bm)object).do().readShort();
                        ei_03.do = ((bm)object).do().readShort();
                        ((Vector)object2).addElement(ei_03);
                        ++n;
                        "".length();
                        if (-"   ".length() <= 0) continue;
                        return;
                    }
                    byte by5 = ((bm)object).do().readByte();
                    ((bm)object).do().readInt();
                    "".length();
                    bl = ((bm)object).do().readBoolean();
                    AngelChip.do.char = ((bm)object).do().readShort();
                    AngelChip.do.do = ((bm)object).do().readByte();
                    by4 = ((bm)object).do().readByte();
                    vector3.removeAllElements();
                    int n4 = do[0];
                    while (s_0.for(n4, by4)) {
                        ei_0 ei_04 = new ei_0();
                        new ei_0().do = ((bm)object).do().readShort();
                        ei_04.do = ((bm)object).do().readInt();
                        vector3.addElement(ei_04);
                        ++n4;
                        "".length();
                        if (-" ".length() != "   ".length()) continue;
                        return;
                    }
                    ((Vector)object2).removeAllElements();
                    by4 = ((bm)object).do().readByte();
                    n4 = do[0];
                    while (s_0.for(n4, by4)) {
                        ei_0 ei_05 = new ei_0();
                        new ei_0().do = ((bm)object).do().readShort();
                        ei_05.do = ((bm)object).do().readInt();
                        ((Vector)object2).addElement(ei_05);
                        ++n4;
                        "".length();
                        if (" ".length() > 0) continue;
                        return;
                    }
                    dT.do();
                    "".length();
                    dT.do(vector, vector3, vector2, (Vector)object2, by5, bl);
                    if (!s_0.new(bC.do) || !s_0.int(s_0.do() ? 1 : 0) || !s_0.int(fj.new, do[2])) break;
                    bC.if();
                    fp.do().do(do[2], do[0]);
                    dT.char();
                    dT.do().if((int)AngelChip.do.char, do[0]);
                    return;
                }
                case 61: {
                    s_0.if((bm)object);
                    return;
                }
                case 62: {
                    ei_0 ei_06 = new ei_0();
                    new ei_0().do = ((bm)object).do().readShort();
                    ei_06.do = ((bm)object).do().readByte();
                    ((bm)object).do().readInt();
                    "".length();
                    ((bm)object).do().readByte();
                    "".length();
                    int n = ((bm)object).do().readInt();
                    int n5 = ((bm)object).do().readInt();
                    int n6 = ((bm)object).do().readInt();
                    dT.do();
                    "".length();
                    dT.do(ei_06, n, n5, n6);
                    aq_0.break();
                    return;
                }
                case 63: {
                    int n = ((bm)object).do().readInt();
                    int n7 = ((bm)object).do().readInt();
                    short s4 = ((bm)object).do().readShort();
                    dT.do();
                    "".length();
                    dT.do(n, n7, s4);
                    return;
                }
                case 64: {
                    ((bm)object).do().readInt();
                    "".length();
                    byte by6 = ((bm)object).do().readByte();
                    byte by7 = ((bm)object).do().readByte();
                    dT.do().for(by6, by7);
                    aq_0.break();
                    return;
                }
                case 65: {
                    ei_0 ei_07;
                    ((bm)object).do().readByte();
                    "".length();
                    short s5 = ((bm)object).do().readShort();
                    if (s_0.do(dT.do(s5)) && s_0.do(ei_07 = ei_0.do(dT.new, (int)s5))) {
                        ei_07.do -= do[3];
                        if (s_0.for(ei_07.do)) {
                            dT.new.removeElement(ei_07);
                            "".length();
                        }
                    }
                    aq_0.break();
                    return;
                }
                case 66: {
                    byte by8 = ((bm)object).do().readByte();
                    short s6 = ((bm)object).do().readShort();
                    dT.do();
                    "".length();
                    dT.try(by8, s6);
                    aq_0.break();
                    return;
                }
                case 67: {
                    dT.do();
                    "".length();
                    ((bm)object).do().readInt();
                    "".length();
                    dT.long();
                    return;
                }
                case 69: {
                    dT.do();
                    "".length();
                    dT.do(((bm)object).do().readUTF());
                    return;
                }
                case 70: {
                    int n = ((bm)object).do().readInt();
                    ((bm)object).do().readInt();
                    "".length();
                    ((bm)object).do().readByte();
                    "".length();
                    String string = ((bm)object).do().readUTF();
                    int n8 = ((bm)object).do().readInt();
                    int n9 = ((bm)object).do().readInt();
                    int n10 = ((bm)object).do().readInt();
                    dT.do();
                    "".length();
                    dT.do(n, string, n8, n9, n10);
                    return;
                }
                case 71: {
                    ei_0 ei_08 = new ei_0();
                    new ei_0().do = ((bm)object).do().readByte();
                    ((bm)object).do().readInt();
                    "".length();
                    ((bm)object).do().readByte();
                    "".length();
                    int n = ((bm)object).do().readInt();
                    int n11 = ((bm)object).do().readInt();
                    int n12 = ((bm)object).do().readInt();
                    dT.do();
                    "".length();
                    dT.do(ei_08, n, n11, n12);
                    aq_0.class();
                    return;
                }
                case 72: {
                    byte by9 = ((bm)object).do().readByte();
                    object = ((bm)object).do().readUTF();
                    dT.do();
                    "".length();
                    dT.do(by9, (String)object);
                    return;
                }
                case 73: {
                    ((bm)object).do().readInt();
                    "".length();
                    byte by10 = ((bm)object).do().readByte();
                    int n = ((bm)object).do().readInt();
                    dT.do();
                    "".length();
                    dT.new(by10, n);
                    aq_0.class();
                    return;
                }
                case 74: {
                    byte by11 = ((bm)object).do().readByte();
                    short s7 = ((bm)object).do().readShort();
                    dT.do();
                    "".length();
                    dT.byte(by11, s7);
                    return;
                }
                case 75: {
                    int n = ((bm)object).do().readInt();
                    int n13 = ((bm)object).do().readInt();
                    AngelChip.do.try(n);
                    AngelChip.do.do[s_0.do[3]] = n13;
                    bx.int(((bm)object).do().readUTF());
                    return;
                }
                case 76: {
                    fj_0.do((bm)object);
                    return;
                }
                case 77: {
                    fj_0.if((bm)object);
                    return;
                }
                case 78: {
                    if (s_0.int(s_0.do() ? 1 : 0)) {
                        aq_0.break();
                        return;
                    }
                    byte by12 = ((bm)object).do().readByte();
                    eu eu2 = (eu)dT.for.elementAt(by12);
                    ((eu)dT.for.elementAt(by12)).byte = ((bm)object).do().readByte();
                    s_0.do(eu2, (bm)object);
                    dT.do().int(by12);
                    aq_0.break();
                    return;
                }
                case 79: {
                    if (s_0.int(s_0.do() ? 1 : 0)) {
                        aq_0.class();
                        return;
                    }
                    byte by13 = ((bm)object).do().readByte();
                    byte by14 = ((bm)object).do().readByte();
                    if (s_0.if(by14, do[4])) {
                        return;
                    }
                    hu hu2 = dT.do((int)by13);
                    dT.do((int)by13).else = by14;
                    s_0.do(hu2, (bm)object);
                    dT.do();
                    "".length();
                    dT.void();
                    aq_0.class();
                    return;
                }
                case 80: {
                    if (s_0.new(((bm)object).do().readByte())) {
                        String string = ((bm)object).do().readUTF();
                        Vector<fn_0> vector = new Vector<fn_0>();
                        vector.addElement(new fn_0(bT.i, do[5], dT.do));
                        vector.addElement(new fn_0(bT.interface, do[6], dT.do));
                        vector.addElement(bx.do);
                        bx.do(string, vector);
                        return;
                    }
                    ((bm)object).do().readByte();
                    "".length();
                    ((bm)object).do().readInt();
                    "".length();
                    int n = ((bm)object).do().readInt();
                    int n14 = ((bm)object).do().readInt();
                    int n15 = ((bm)object).do().readInt();
                    AngelChip.do.do(n, n14, n15);
                    bx.byte = do[3];
                    dT.do().if((int)AngelChip.do.char, do[3]);
                    dT.do = do[3];
                    return;
                }
                case 81: {
                    if (s_0.new(((bm)object).do().readByte())) {
                        String string = ((bm)object).do().readUTF();
                        Vector<fn_0> vector = new Vector<fn_0>();
                        vector.addElement(new fn_0(bT.i, do[7], dT.do));
                        vector.addElement(new fn_0(bT.interface, do[8], dT.do));
                        vector.addElement(bx.do);
                        bx.do(string, vector);
                        return;
                    }
                    ((bm)object).do().readByte();
                    "".length();
                    ((bm)object).do().readInt();
                    "".length();
                    bx.byte = do[3];
                    int n = ((bm)object).do().readInt();
                    int n16 = ((bm)object).do().readInt();
                    int n17 = ((bm)object).do().readInt();
                    AngelChip.do.do(n, n16, n17);
                    dT.do().if((int)AngelChip.do.char, do[3]);
                    dT.do = do[3];
                    return;
                }
                case 82: {
                    short s8 = ((bm)object).do().readShort();
                    byte[] byArray = new byte[((bm)object).do().readShort()];
                    ((bm)object).do().read(byArray);
                    "".length();
                    bC.do.put("" + s8, new e(hi.do(byArray)));
                    "".length();
                    return;
                }
                case 83: {
                    if (!s_0.int(((bm)object).do().readBoolean() ? 1 : 0)) break;
                    dT.do.int = ((bm)object).do().readShort();
                    dT.do.do = (short)(dT.do.do + do[3]);
                    return;
                }
                case 84: {
                    if (s_0.new(((bm)object).do().readByte())) {
                        bx.if(((bm)object).do().readUTF(), do[9], dT.do);
                        aq_0.catch();
                        return;
                    }
                    ((bm)object).do().readInt();
                    "".length();
                    short s9 = ((bm)object).do().readShort();
                    dT.do.do = s9 * do[10];
                    dT.do.do = System.currentTimeMillis();
                    aq_0.case();
                    return;
                }
                case 85: {
                    try {
                        short s10 = ((bm)object).do().readShort();
                        short s11 = ((bm)object).do().readShort();
                        dT.do();
                        "".length();
                        dT.do(s10, s11);
                        "".length();
                    }
                    catch (IOException iOException) {
                        "".length();
                    }
                    if (-(0x30 ^ 0x34) > 0) {
                        return;
                    }
                    aq_0.byte();
                    return;
                }
                case 86: {
                    if (s_0.new(((bm)object).do().readByte())) {
                        bx.if(((bm)object).do().readUTF(), do[11], dT.do);
                        return;
                    }
                    ((bm)object).do().readInt();
                    "".length();
                    dT.do.int = ((bm)object).do().readShort();
                    dT.do.do = do[0];
                    dT.do.do = (short)(dT.do.do + do[3]);
                    int n = ((bm)object).do().readInt();
                    int n18 = ((bm)object).do().readInt();
                    AngelChip.do.do(AngelChip.do.do[do[0]], n, n18);
                    return;
                }
                case 90: {
                    if (s_0.new(((bm)object).do().readByte())) {
                        String string = ((bm)object).do().readUTF();
                        Vector<fn_0> vector = new Vector<fn_0>();
                        vector.addElement(new fn_0(bT.i, do[12], dT.do));
                        vector.addElement(new fn_0(bT.interface, do[13], dT.do));
                        vector.addElement(bx.do);
                        bx.do(string, vector);
                        return;
                    }
                    ((bm)object).do().readByte();
                    "".length();
                    ((bm)object).do().readInt();
                    "".length();
                    int n = ((bm)object).do().readByte();
                    bx.int(((bm)object).do().readUTF());
                    ((eu)dT.for.elementAt((int)n)).new = (byte)(((eu)dT.for.elementAt((int)n)).new + do[3]);
                    dT.do().do(dT.new, dT.for, dT.byte, dT.for, dT.do, dT.do, dT.int);
                    n = ((bm)object).do().readInt();
                    int n19 = ((bm)object).do().readInt();
                    AngelChip.do.do(AngelChip.do.do[do[0]], n, n19);
                    return;
                }
                case 91: {
                    short s12 = ((bm)object).do().readShort();
                    if (s_0.if(s12, do[4])) {
                        dT.do = (short)do[0];
                        "".length();
                        if ((0x53 ^ 0x5B ^ (0x19 ^ 0x15)) < -" ".length()) {
                            return;
                        }
                    } else {
                        short s13 = ((bm)object).do().readShort();
                        dT.do = s12;
                        dT.int = s13 * do[10];
                    }
                    bx.case();
                    return;
                }
                case 92: {
                    object = bC.do(dT.do);
                    dI dI2 = dT.do(((ez)object).for);
                    ei_0 ei_09 = dT.if(((ez)object).for);
                    if (s_0.do(ei_09)) {
                        ei_09.do += do[3];
                        "".length();
                        if ("   ".length() <= -" ".length()) {
                            return;
                        }
                    } else {
                        ei_09 = new ei_0();
                        new ei_0().do = ((ez)object).for;
                        ei_09.do = do[3];
                        dT.int.addElement(ei_09);
                    }
                    bx.do(do[0], dT.else, dT.if, dI2.do);
                    dT.do = (short)do[0];
                    aq_0.byte();
                    return;
                }
                case 93: {
                    if (s_0.new(((bm)object).do().readByte())) {
                        bx.if(((bm)object).do().readUTF(), do[14], dT.do);
                        return;
                    }
                    int n = ((bm)object).do().readInt();
                    int n20 = do[15];
                    AngelChip.do.do[n20] = AngelChip.do.do[n20] - n;
                    dT.int = do[0];
                    n = ((bm)object).do().readInt();
                    int n21 = ((bm)object).do().readInt();
                    AngelChip.do.do(AngelChip.do.do[do[0]], n, n21);
                    return;
                }
                case 94: {
                    if (s_0.new(((bm)object).do().readByte())) {
                        String string = ((bm)object).do().readUTF();
                        Vector<fn_0> vector = new Vector<fn_0>();
                        vector.addElement(new fn_0(bT.i, do[16], dT.do));
                        vector.addElement(new fn_0(bT.interface, do[17], dT.do));
                        vector.addElement(bx.do);
                        bx.do(string, vector);
                        return;
                    }
                    byte by15 = ((bm)object).do().readByte();
                    int n = ((bm)object).do().readInt();
                    if (s_0.if(by15, do[3])) {
                        int n22 = do[0];
                        AngelChip.do.do[n22] = AngelChip.do.do[n22] - n;
                        "".length();
                        if (-" ".length() == " ".length()) {
                            return;
                        }
                    } else {
                        int n23 = do[15];
                        AngelChip.do.do[n23] = AngelChip.do.do[n23] - n;
                    }
                    ((bm)object).do().readInt();
                    "".length();
                    dT.int = (byte)(dT.int + do[3]);
                    bx.int(((bm)object).do().readUTF());
                    dT.do().do(dT.new, dT.for, dT.byte, dT.for, dT.do, dT.do, dT.int);
                    return;
                }
            }
            return;
        }
        catch (Exception exception) {
            exception.printStackTrace();
            return;
        }
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean int(int n) {
        return n != 0;
    }

    private static boolean do() {
        if (s_0.int(fj.new, do[18]) && s_0.int(fj.new, do[19])) {
            return do[3];
        }
        return do[0];
    }

    private static boolean int(int n, int n2) {
        return n != n2;
    }

    private static void do() {
        do = new int[20];
        s_0.do[0] = (200 + 11 - 79 + 97 ^ 137 + 166 - 239 + 116) & (0x68 ^ 0x25 ^ (1 ^ 0x1D) ^ -" ".length());
        s_0.do[1] = 61 + 92 - 119 + 93 ^ (0xAC ^ 0xB7);
        s_0.do[2] = 0x6C ^ 0x75;
        s_0.do[3] = " ".length();
        s_0.do[4] = -" ".length();
        s_0.do[5] = "   ".length();
        s_0.do[6] = 0xA ^ 0xE;
        s_0.do[7] = 0x2A ^ 0x7A ^ (0xE7 ^ 0xB2);
        s_0.do[8] = 0x85 ^ 0xBF ^ (0xFA ^ 0xC6);
        s_0.do[9] = 143 + 20 - 53 + 79 ^ 146 + 83 - 197 + 154;
        s_0.do[10] = 0xDB ^ 0xB6 ^ (0x7A ^ 0x2B);
        s_0.do[11] = 0xC9 ^ 0xC1;
        s_0.do[12] = 125 + 3 - -11 + 5 ^ 41 + 10 - -91 + 11;
        s_0.do[13] = 0x9F ^ 0x95;
        s_0.do[14] = 0xD7 ^ 0x9F ^ (0xD5 ^ 0x96);
        s_0.do[15] = "  ".length();
        s_0.do[16] = 29 + 99 - 114 + 163 ^ 172 + 185 - 270 + 101;
        s_0.do[17] = 0x34 ^ 0x39 ^ "   ".length();
        s_0.do[18] = 90 + 113 - 143 + 80 ^ 94 + 130 - 214 + 138;
        s_0.do[19] = 8 ^ 0x3D;
    }

    private static void do(hu hu2, bm bm2) {
        hu2.void = bm2.do.readInt();
        byte by2 = bm2.do.readByte();
        dT.do(hu2.float, (int)by2, null, hu2);
        hu2.float = by2;
        bm2.do.readByte();
        "".length();
        hu2.class = bm2.do.readByte();
        hu2.for = bm2.do.readBoolean();
        by2 = (byte)(bm2.do.readBoolean() ? 1 : 0);
        int n = bm2.do.readBoolean();
        int n2 = do[4];
        if (s_0.new(by2) && s_0.int(hu2.do[do[0]])) {
            n2 = do[0];
        }
        if (s_0.new(n) && s_0.int(hu2.do[do[3]])) {
            n2 = do[16] * dH.this;
        }
        if (s_0.do(n2)) {
            bx.do(do[0], hu2.int ? 1 : 0, hu2.for - hu2.new, hi.do(do[0], n2, do[12] * dH.this, do[16] * dH.this, dT.try.do), do[4]);
        }
        hu2.do[s_0.do[0]] = by2;
        hu2.do[s_0.do[3]] = n;
    }

    private static boolean new(int n) {
        return n == 0;
    }

    private static void do(eu eu2, bm bm2) {
        short s2 = bm2.do.readShort();
        dT.do(eu2.if, (int)s2, eu2, null);
        eu2.if = s2;
        eu2.do = eu2.if * do[10];
        s2 = bm2.do.readByte();
        dT.do(eu2.do, (int)s2, eu2, null);
        eu2.do = (byte)s2;
        eu2.int = bm2.do.readByte();
        eu2.for = bm2.do.readBoolean();
        s2 = (short)(bm2.do.readBoolean() ? 1 : 0);
        int n = do[4];
        if (s_0.new(s2) && s_0.int(eu2.if ? 1 : 0)) {
            n = do[0];
        }
        eu2.if = s2;
        int n2 = bm2.do.readBoolean() ? 1 : 0;
        if (s_0.new(n2) && s_0.int(eu2.int ? 1 : 0)) {
            n = do[12] * dH.this;
        }
        eu2.int = n2;
        if (s_0.do(n)) {
            bx.do(do[0], eu2.do * fj.char + do[14], eu2.case * fj.char, hi.do(do[0], n, do[16] * dH.this, do[12] * dH.this, dT.for.do), do[4]);
        }
    }
}

