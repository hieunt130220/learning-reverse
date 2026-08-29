/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from dx
 */
final class dx_0
implements dh_0 {
    private static final int[] do;

    private static void if() {
        do = new int[1];
        dx_0.do[0] = (0x4C ^ 0x12) & ~(0xC9 ^ 0x97);
    }

    private static boolean do(int n) {
        return n > 0;
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    dx_0() {
    }

    public final void do() {
        Vector<gx> vector = new Vector<gx>();
        Vector vector2 = dT.do();
        int n = vector2.size();
        int n2 = do[0];
        while (dx_0.do(n2, n)) {
            ei_0 ei_02 = (ei_0)vector2.elementAt(n2);
            vector.addElement(new gx(ei_02.do + "(" + ei_02.do + ")", new gc_0(ei_02), ei_02));
            ++n2;
            "".length();
            if (null == null) continue;
            return;
        }
        if (dx_0.do(vector.size())) {
            dT.do(vector);
            return;
        }
        aq_0.do("C\u00f3", "Kho \u0111\u00e3 h\u1ebft gi\u1ed1ng!\nV\u00e0o c\u1eeda h\u00e0ng mua th\u00eam?", new bu_0());
    }

    static {
        dx_0.if();
    }
}

