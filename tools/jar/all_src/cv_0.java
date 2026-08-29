/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from cv
 * Duplicate member names - consider using --renamedupmembers true
 */
final class cv_0
implements dh_0 {
    private final hu do;
    private static int[] do;
    private dT do;

    private static void if() {
        do = new int[5];
        cv_0.do[0] = (0x6F ^ 0x25 ^ (0x65 ^ 0x6D)) & ("  ".length() ^ (0x17 ^ 0x57) ^ -" ".length());
        cv_0.do[1] = 0xE5 ^ 0x9C;
        cv_0.do[2] = " ".length();
        cv_0.do[3] = 0x30 ^ 0x17 ^ (0x42 ^ 0x6D);
        cv_0.do[4] = -" ".length();
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    cv_0(dT dT2, hu hu2) {
        this.do = dT2;
        this.do = hu2;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    static {
        cv_0.if();
    }

    /*
     * Unable to fully structure code
     */
    public final void do() {
        var1_1 = cv_0.do[0];
        var2_3 = cv_0.do[0];
        "".length();
        if ("   ".length() > 0) ** GOTO lbl17
        return;
lbl-1000:
        // 1 sources

        {
            var3_4 = (ei_0)dT.new.elementAt(var2_3);
            if (cv_0.do(var3_4.do, cv_0.do[1])) {
                var1_2 = dT.do(var3_4.do);
                dT.do(this.do, var1_2, var3_4.do, this.do);
                var1_1 = cv_0.do[2];
                "".length();
                if (" ".length() > 0) break;
                return;
            }
            ++var2_3;
lbl17:
            // 2 sources

            ** while (!cv_0.if((int)var2_3, (int)dT.new.size()))
        }
lbl18:
        // 2 sources

        if (cv_0.do(var1_1)) {
            bx.int(bT.bA);
            dT.do().if(cv_0.do[3], cv_0.do[4]);
        }
    }
}

