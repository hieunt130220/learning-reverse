/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class bI
implements dh_0 {
    private static int[] do;
    private final int do;
    private final cj do;
    private final int if;

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static void if() {
        do = new int[4];
        bI.do[0] = "  ".length();
        bI.do[1] = " ".length();
        bI.do[2] = "   ".length();
        bI.do[3] = (0x53 ^ 0x5E) & ~(0x53 ^ 0x5E);
    }

    bI(int n, int n2, cj cj2) {
        this.if = n;
        this.do = n2;
        this.do = cj2;
    }

    static {
        bI.if();
    }

    public final void do() {
        if (bI.do(this.if, do[0])) {
            fv_0.do().do(do[1], this.do, this.do.do);
            "".length();
            if ("   ".length() == 0) {
                return;
            }
        } else if (bI.do(this.if, do[2])) {
            fv_0.do().do(do[3], this.do, this.do.do);
            "".length();
            if (-" ".length() > "  ".length()) {
                return;
            }
        } else {
            fv_0.do().do(this.do.do, (byte)this.if);
        }
        bx.int();
    }
}

