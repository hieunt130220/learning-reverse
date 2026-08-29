/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 */
final class aw
implements dh_0 {
    private static final int[] do;

    private static boolean do(int n) {
        return n > 0;
    }

    aw() {
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    public final void do() {
        Vector<ej> vector = new Vector<ej>();
        Vector vector2 = dT.new;
        int n = do[0];
        while (aw.if(n, vector2.size())) {
            ei_0 ei_02 = (ei_0)vector2.elementAt(n);
            if (!aw.for(ei_02.do, do[1]) || aw.do(ei_02.do, do[2])) {
                dI dI2 = dT.do(ei_02.do);
                vector.addElement(new ej(dI2.do + "(" + ei_02.do + ")", new bt_0(do[3], ei_02), dI2));
            }
            ++n;
            "".length();
            if ((0x6A ^ 0x6E) >= 0) continue;
            return;
        }
        if (aw.do(vector.size())) {
            dT.do(vector);
            return;
        }
        aq_0.do("C\u00f3", "Kho \u0111\u00e3 h\u1ebft ph\u00e2n b\u00f3n\nB\u1ea1n c\u00f3 mu\u1ed1n mua th\u00eam?", new bu_0());
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    static {
        aw.if();
    }

    private static void if() {
        do = new int[4];
        aw.do[0] = (0xA7 ^ 0xAB) & ~(0x1A ^ 0x16);
        aw.do[1] = 0x14 ^ 0x12 ^ (0x7C ^ 0x15);
        aw.do[2] = 0x2C ^ 0x3F ^ (0x6D ^ 0xE);
        aw.do[3] = 0x1B ^ 0x26 ^ (0x70 ^ 0x49);
    }
}

