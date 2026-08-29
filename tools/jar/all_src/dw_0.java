/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from dw
 * Duplicate member names - consider using --renamedupmembers true
 */
final class dw_0
implements dh_0 {
    private static final int[] do;
    private final fc[] do;

    public final void do() {
        String string = this.do[do[0]].do().trim();
        String string2 = this.do[do[1]].do().trim();
        if (dw_0.if(string.equals("") ? 1 : 0) && dw_0.if(string2.equals("") ? 1 : 0)) {
            bx.do = null;
            new bt_0(do[2], new cq(do[0], do[0])).do();
            return;
        }
        int n = do[0];
        int n2 = do[0];
        if (dw_0.for(string.equals("") ? 1 : 0)) {
            try {
                n = Integer.parseInt(string);
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
                n = do[3];
            }
            "".length();
            if (" ".length() < ((0x46 ^ 0x77) & ~(0xBF ^ 0x8E))) {
                return;
            }
        }
        if (dw_0.for(string2.equals("") ? 1 : 0)) {
            try {
                n2 = Integer.parseInt(string2);
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
                n2 = do[3];
            }
            "".length();
            if (-(0x57 ^ 0x53) >= 0) {
                return;
            }
        }
        if (dw_0.do(n) && dw_0.do(n2)) {
            if (dw_0.do(n2, n)) {
                n2 = do[0];
            }
            bx.do = null;
            new bt_0(do[2], new cq(n, n2)).do();
            return;
        }
        bx.if("Vui l\u00f2ng nh\u1eadp \u0111\u00fang ho\u1eb7c \u0111\u1ec3 tr\u1ed1ng \u0111\u1ec3 cu\u1ed1c h\u1ebft!");
    }

    public dw_0(fc[] fcArray) {
        this.do = fcArray;
    }

    private static boolean do(int n) {
        return n >= 0;
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    static {
        dw_0.if();
    }

    private static void if() {
        do = new int[4];
        dw_0.do[0] = (0xA2 ^ 0xB6) & ~(0x90 ^ 0x84);
        dw_0.do[1] = " ".length();
        dw_0.do[2] = -"  ".length();
        dw_0.do[3] = -" ".length();
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static boolean for(int n) {
        return n == 0;
    }
}

