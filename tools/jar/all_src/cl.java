/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class cl
implements Runnable {
    private static final int[] do;
    private final ah do;
    private String do;

    private static void if() {
        do = new int[2];
        cl.do[0] = (0x62 ^ 0x55) & ~(0x16 ^ 0x21);
        cl.do[1] = " ".length();
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean if(int n) {
        return n > 0;
    }

    public cl(ah ah2, String string) {
        this.do = ah2;
        this.do = string;
    }

    public final void run() {
        if (cl.if(ah.do)) {
            aq_0.if((long)ah.do);
        }
        if (cl.do(ah.do(this.do))) {
            if (cl.do(ah.do.isEmpty() ? 1 : 0)) {
                int n = do[0];
                while (cl.if(n, ah.do.size())) {
                    af_0 af_02 = (af_0)ah.do.elementAt(n);
                    if (cl.do(af_02) && cl.for(this.do.equals(af_02.do[do[0]]) ? 1 : 0)) {
                        fp.do().for(af_02.do);
                        return;
                    }
                    ++n;
                    "".length();
                    if (((0xFD ^ 0xA2 ^ (0x7B ^ 0x6E)) & (0xCD ^ 0x81 ^ (0x8F ^ 0x89) ^ -" ".length())) >= -" ".length()) continue;
                    return;
                }
            }
            return;
        }
        if (cl.do(ah.do(this.do), do[1]) && cl.do(ah.if.isEmpty() ? 1 : 0)) {
            int n = do[0];
            while (cl.if(n, ah.if.size())) {
                af_0 af_03 = (af_0)ah.if.elementAt(n);
                if (cl.do(af_03) && cl.for(this.do.startsWith(af_03.do[do[0]]) ? 1 : 0) && cl.for(this.do.endsWith(af_03.do[do[1]]) ? 1 : 0)) {
                    fp.do().for(af_03.do);
                    return;
                }
                ++n;
                "".length();
                if (-"  ".length() < 0) continue;
                return;
            }
        }
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    private static boolean for(int n) {
        return n != 0;
    }

    static {
        cl.if();
    }

    public final void do() {
        new Thread(this).start();
    }
}

