/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from eO
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class eo_0
extends bH
implements bK {
    private static final int[] do;
    public static eo_0 do;

    private static boolean do(int n) {
        return n == 0;
    }

    public static void do() {
        fj_0.do().do = do;
    }

    static {
        eo_0.for();
        do = new eo_0();
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    private static void for() {
        do = new int[3];
        eo_0.do[0] = (0xF6 ^ 0xAB) & ~(0x1D ^ 0x40);
        eo_0.do[1] = -" ".length();
        eo_0.do[2] = 47 + 64 - 0 + 69 ^ 59 + 164 - 221 + 170;
    }

    public final void do(bm object) {
        try {
            switch (((bm)object).do) {
                case -75: {
                    int n = ((bm)object).do.readInt();
                    bx.do.do(bT.bO, new h_0(n), do[0]);
                }
                default: {
                    return;
                }
                case -73: {
                    short s2 = ((bm)object).do.readShort();
                    byte[] byArray = new byte[((bm)object).do.readInt()];
                    ((bm)object).do.read(byArray);
                    "".length();
                    gf_0.do().do(byArray, (int)s2);
                    return;
                }
                case -67: {
                    byte by2 = ((bm)object).do.readByte();
                    int n = do[1];
                    short s3 = do[0];
                    Vector<eh> vector = null;
                    if (eo_0.do(by2)) {
                        s3 = ((bm)object).do.readShort();
                        n = ((bm)object).do.readByte();
                        "".length();
                        if ((0x60 ^ 0x33 ^ (0x72 ^ 0x24)) == 0) {
                            return;
                        }
                    } else {
                        vector = new Vector<eh>();
                        short s4 = ((bm)object).do.readShort();
                        int n2 = do[0];
                        while (eo_0.do(n2, s4)) {
                            eh eh2 = new eh();
                            new eh().char = (byte)((bm)object).do.readInt();
                            eh2.catch = ((bm)object).do.readByte();
                            vector.addElement(eh2);
                            ++n2;
                            "".length();
                            if ("   ".length() >= 0) continue;
                            return;
                        }
                    }
                    gf_0.do().do(by2, n, s3, vector);
                    return;
                }
                case -66: {
                    bE bE2 = new bE();
                    new bE().do = ((bm)object).do.readShort();
                    bE2.int = ((bm)object).do.readByte();
                    bE2.for = ((bm)object).do.readByte();
                    gf_0.do().for(bE2);
                    return;
                }
                case -65: {
                    byte by3 = ((bm)object).do.readByte();
                    int n = ((bm)object).do.readInt();
                    short s5 = ((bm)object).do.readShort();
                    short[] sArray = new short[s5];
                    byte by4 = do[0];
                    while (eo_0.do(by4, s5)) {
                        sArray[by4] = ((bm)object).do.readByte();
                        ++by4;
                        "".length();
                        if ("   ".length() != (0x2B ^ 0x15 ^ (0xBE ^ 0x84))) continue;
                        return;
                    }
                    by4 = ((bm)object).do.readByte();
                    Vector<bE> vector = new Vector<bE>();
                    short s6 = ((bm)object).do.readShort();
                    int n3 = do[0];
                    while (eo_0.do(n3, s6)) {
                        bE bE3 = new bE();
                        new bE().do = ((bm)object).do.readShort();
                        bE3.int = ((bm)object).do.readByte() * do[2];
                        bE3.for = ((bm)object).do.readByte() * do[2];
                        bE3.do = ((bm)object).do.readByte();
                        vector.addElement(bE3);
                        ++n3;
                        "".length();
                        if ((0x66 ^ 0x56 ^ (0x87 ^ 0xB2)) != 0) continue;
                        return;
                    }
                    Vector vector2 = fj_0.do((bm)object);
                    fw_0.do();
                    gf_0.do().do(by3, n, sArray, by4, vector, vector2);
                    aq_0.for();
                    return;
                }
                case -46: {
                    short s7 = ((bm)object).do.readShort();
                    object = ((bm)object).do.readUTF();
                    gf_0.do().do(s7, (String)object);
                    return;
                }
                case -43: {
                    short s8 = ((bm)object).do.readShort();
                    ev[] evArray = new ev[s8];
                    int n = do[0];
                    while (eo_0.do(n, s8)) {
                        evArray[n] = new ev();
                        evArray[n].do = ((bm)object).do.readUTF();
                        evArray[n].do = ((bm)object).do.readInt();
                        evArray[n].if = ((bm)object).do.readInt();
                        ++n;
                        "".length();
                        if (((0x84 ^ 0xAD) & ~(0x84 ^ 0xAD)) < (0x83 ^ 0x87)) continue;
                        return;
                    }
                    gf_0.do().do(evArray);
                    return;
                }
                case 51: {
                    gs_0.do();
                    "".length();
                    gs_0.if(fw_0.do((bm)object));
                    return;
                }
                case 76: {
                    fj_0.do((bm)object);
                    return;
                }
                case 77: 
            }
            fj_0.if((bm)object);
            return;
        }
        catch (Exception exception) {
            exception.printStackTrace();
            return;
        }
    }
}

