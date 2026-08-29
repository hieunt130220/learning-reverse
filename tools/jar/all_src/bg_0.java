/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from bG
 */
final class bg_0
implements dh_0 {
    private static final int[] do;

    bg_0() {
    }

    private static void if() {
        do = new int[5];
        bg_0.do[0] = " ".length();
        bg_0.do[1] = "  ".length() & ~"  ".length();
        bg_0.do[2] = 0x2C ^ 0x20;
        bg_0.do[3] = 59 + 125 - 63 + 10 ^ 17 + 102 - 38 + 61;
        bg_0.do[4] = 0xBD ^ 0xB9;
    }

    public final void do() {
        Vector<fn_0> vector = new Vector<fn_0>();
        vector.addElement(new dz_0("T\u01b0\u1edbi n\u01b0\u1edbc", new cd(do[0]), do[1]));
        vector.addElement(new bj_0("sau.png", "Di\u1ec7t s\u00e2u", new cd(do[2])));
        vector.addElement(new bj_0("co.png", "Di\u1ec7t c\u1ecf", new cd(do[3])));
        vector.addElement(new bj_0("bonphan.png", "B\u00f3n ph\u00e2n", new cd(do[4])));
        vector.addElement(new bj_0("gieohat.png", "Gieo h\u1ea1t", new B()));
        dT.do(vector);
    }

    static {
        bg_0.if();
    }
}

