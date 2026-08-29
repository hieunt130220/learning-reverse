/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class ha
implements dh_0 {
    private static int[] do;
    private final hu do;
    private dT do;

    private static void if() {
        do = new int[6];
        ha.do[0] = (0x6B ^ 0x79 ^ (0x68 ^ 0x71)) & (0x38 ^ 0x43 ^ (0xF9 ^ 0x89) ^ -" ".length());
        ha.do[1] = 0x8E ^ 0x8B;
        ha.do[2] = " ".length();
        ha.do[3] = 6 ^ 0xC;
        ha.do[4] = -" ".length();
        ha.do[5] = 0x46 ^ 0x60 ^ (0xF ^ 0x21);
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    ha(dT dT2, hu hu2) {
        this.do = dT2;
        this.do = hu2;
    }

    /*
     * Unable to fully structure code
     */
    public final void do() {
        var1_1 = ha.do[0];
        var2_2 = bC.do((int)this.do.else);
        var3_3 = ha.do[0];
        "".length();
        if ("   ".length() >= 0) ** GOTO lbl23
        return;
lbl-1000:
        // 1 sources

        {
            var4_4 = (ei_0)dT.new.elementAt(var3_3);
            var5_5 = dT.do(var4_4.do);
            if (ha.if(var5_5.if, var2_2.for) && ha.if(var5_5.do, ha.do[1]) && ha.if(var4_4.do)) {
                var1_1 = ha.do[2];
                this.do.for = ha.do[0];
                dT.do();
                "".length();
                dT.do(var5_5.if, this.do.char);
                "".length();
                this.do.do(ha.do[3], ha.do[4]);
            }
            ++var3_3;
lbl23:
            // 2 sources

            ** while (!ha.do((int)var3_3, (int)dT.new.size()))
        }
lbl24:
        // 1 sources

        if (ha.do(var1_1)) {
            bx.int(bT.ag);
            this.do.if(ha.do[5], ha.do[4]);
        }
    }

    static {
        ha.if();
    }

    private static boolean if(int n) {
        return n > 0;
    }
}

