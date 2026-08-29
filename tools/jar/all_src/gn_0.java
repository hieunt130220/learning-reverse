/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from gN
 */
final class gn_0
implements dh_0 {
    private static final int[] do;

    gn_0() {
    }

    static {
        gn_0.if();
    }

    public final void do() {
        Vector<bj_0> vector = new Vector<bj_0>();
        vector.addElement(new bj_0("choan.png", "Cho \u0103n", new cd(do[0])));
        vector.addElement(new bj_0("cum.png", "Thu\u1ed1c c\u00fam", new cd(do[1])));
        vector.addElement(new bj_0("tieuchay.png", "Thu\u1ed1c ti\u00eau ch\u1ea3y", new cd(do[2])));
        vector.addElement(new bj_0("thuocbo.png", "Thu\u1ed1c b\u1ed5", new cd(do[3])));
        dT.do(vector);
    }

    private static void if() {
        do = new int[4];
        gn_0.do[0] = 0xBF ^ 0x90 ^ (0xA9 ^ 0x81);
        gn_0.do[1] = 0xA9 ^ 0xB8 ^ (0x90 ^ 0x8F);
        gn_0.do[2] = 82 + 19 - -5 + 25 ^ 123 + 94 - 145 + 68;
        gn_0.do[3] = 96 + 124 - 91 + 10 ^ 61 + 96 - 106 + 79;
    }
}

