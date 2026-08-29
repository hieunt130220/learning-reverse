/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from cG
 */
final class cg_0
implements dh_0 {
    private static final int[] do;

    public final void do() {
        Vector<bj_0> vector = new Vector<bj_0>();
        vector.addElement(new bj_0("choan.png", "Cho \u0103n", new bt_0(do[0], null)));
        vector.addElement(new bj_0("chuabenh.png", "Ch\u1eefa b\u1ec7nh", new bt_0(do[1], null)));
        vector.addElement(new bj_0("thuocbo.png", "Thu\u1ed1c b\u1ed5", new bt_0(do[2], null)));
        vector.addElement(new bj_0("thuhoach.png", "Thu ho\u1ea1ch", new bt_0(do[3], null)));
        vector.addElement(new bj_0("coin.png", "B\u00e1n v\u1eadt nu\u00f4i (xu)", new ex(do[4])));
        vector.addElement(new bj_0("gold.png", "B\u00e1n v\u1eadt nu\u00f4i (l\u01b0\u1ee3ng)", new ex(do[5])));
        dT.do(vector);
    }

    static {
        cg_0.if();
    }

    cg_0() {
    }

    private static void if() {
        do = new int[6];
        cg_0.do[0] = 0x85 ^ 0xBD ^ (0x44 ^ 0x7B);
        cg_0.do[1] = 4 ^ 0xC;
        cg_0.do[2] = 0xBB ^ 0xB2;
        cg_0.do[3] = 0xC8 ^ 0xC2;
        cg_0.do[4] = (0x73 ^ 0x34 ^ (0x55 ^ 0x3E)) & (65 + 26 - -34 + 22 ^ 190 + 13 - 144 + 132 ^ -" ".length());
        cg_0.do[5] = " ".length();
    }
}

