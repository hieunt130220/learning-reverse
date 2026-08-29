/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class hr
implements dh_0 {
    private static int[] do;
    private final ez do;

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    hr(ez ez2) {
        this.do = ez2;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    private static boolean for(int n, int n2) {
        return n < n2;
    }

    private static void if() {
        do = new int[5];
        hr.do[0] = (0x33 ^ 0x29) & ~(0xDC ^ 0xC6);
        hr.do[1] = 0x6E ^ 0x2A ^ (0xA7 ^ 0x87);
        hr.do[2] = 0xB ^ 0x39;
        hr.do[3] = " ".length();
        hr.do[4] = "  ".length();
    }

    /*
     * Enabled aggressive block sorting
     */
    public final void do() {
        int n = do[0];
        "".length();
        while (!hr.if(n, this.do.if.length)) {
            ei_0 ei_02;
            String string;
            block9: {
                block7: {
                    block8: {
                        string = "";
                        if (!hr.for(this.do.if[n], do[1])) break block7;
                        ei_02 = dT.do(this.do.if[n]);
                        if (!hr.for(this.do.if[n], do[2])) break block8;
                        string = bC.do((int)this.do.if[n]).do;
                        "".length();
                        if (-" ".length() > -" ".length()) {
                            return;
                        }
                        break block9;
                    }
                    if (hr.do(bC.do((int)this.do.if[n]).for, do[3])) {
                        string = String.valueOf(bT.ac) + " " + bC.do((int)this.do.if[n]).if;
                        "".length();
                        if (" ".length() <= 0) {
                            return;
                        }
                        break block9;
                    } else if (hr.do(bC.do((int)this.do.if[n]).for, do[4])) {
                        string = String.valueOf(bT.import) + " " + bC.do((int)this.do.if[n]).if;
                        "".length();
                    }
                    break block9;
                }
                ei_02 = dT.if(this.do.if[n]);
                string = dT.do((int)this.do.if[n]).do;
            }
            if (!hr.do(ei_02) || hr.for(ei_02.do, this.do.do[n])) {
                bx.int(String.valueOf(bT.native) + string);
                return;
            }
            ++n;
        }
        ev_0.do().for(this.do.if);
        fs.do().int();
    }

    private static boolean do(Object object) {
        return object != null;
    }

    static {
        hr.if();
    }
}

