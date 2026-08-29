/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class dN
implements dh_0 {
    private ao_0 do;
    private String do;
    private short do;
    private int do;
    private static final int[] do;
    private int if;
    private int for;

    static {
        dN.if();
    }

    public dN(ao_0 ao_02, short s2, int n, String string, int n2, int n3) {
        this.do = ao_02;
        this.do = s2;
        this.do = n;
        this.do = string;
        this.for = n2;
        this.if = n3;
    }

    /*
     * Enabled force condition propagation
     * Lifted jumps to return sites
     */
    public final void do() {
        if (dN.do(this.do, do[0])) {
            gk_0.do(this.do);
            return;
        }
        if (dN.do(this.do, do[1])) {
            bx.case();
            gs_0.do();
            "".length();
            gs_0.try(this.do);
            fs.do().int();
            return;
        }
        ao_0 ao_02 = this.do;
        if (dN.do(this.do.for, do[2])) {
            ao_02 = ac_0.do(this.do);
        }
        if (dN.if(this.for, do[2]) && dN.if(this.do, do[3]) && dN.if(this.do, do[4])) {
            if (dN.do(this.for, co.do)) {
                if (dN.do(bx_0.do) && !dN.do(bx_0.do instanceof co)) return;
                gk_0.do(this.do, this.do, this.for, this.do, this.if);
                return;
            }
            bx.do(this.do, new fk_0(this.for, this.do, this.if));
            return;
        }
        gs_0.do(ao_02);
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    private static void if() {
        do = new int[5];
        dN.do[0] = 0x6E ^ 0x35 ^ (0xA0 ^ 0x9F);
        dN.do[1] = 166 + 188 - 151 + 13 ^ 176 + 55 - 121 + 84;
        dN.do[2] = -" ".length();
        dN.do[3] = 0x47 ^ 0x56;
        dN.do[4] = 63 + 46 - 41 + 123 ^ 54 + 147 - 33 + 5;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean do(Object object) {
        return object != null;
    }
}

