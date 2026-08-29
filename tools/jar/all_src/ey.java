/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class ey
implements dh_0 {
    private static int[] do;
    private final fc[] do;
    private final String do;
    private aj_0 do;

    private static void if() {
        do = new int[2];
        ey.do[0] = (0x7E ^ 0x5E) & ~(0x48 ^ 0x68);
        ey.do[1] = " ".length();
    }

    public final void do() {
        String string = this.do[do[1]].do();
        String string2 = this.do[do[0]].do();
        String string3 = this.do;
        aj_0 aj_02 = this.do;
        if (ey.do(string2.equals("") ? 1 : 0)) {
            bx.int(bT.float[do[0]]);
            return;
        }
        if (ey.do(string.equals("") ? 1 : 0)) {
            bx.int(bT.float[do[1]]);
            return;
        }
        fv_0.do().for(string3, string2, string);
        aj_02.if(((dH)aj_02).try.do, ((dH)aj_02).try.do);
        bx.int();
    }

    private static boolean do(int n) {
        return n != 0;
    }

    static {
        ey.if();
    }

    ey(aj_0 aj_02, String string, fc[] fcArray) {
        this.do = aj_02;
        this.do = string;
        this.do = fcArray;
    }
}

