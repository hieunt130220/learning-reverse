/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class gY {
    private static final Object do;
    private static final int[] do;
    public static boolean do;

    static {
        gY.if();
        do = do[1];
        do = new Object();
    }

    private static boolean do(int n) {
        return n < 0;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void do() {
        if (gY.if(do ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if ((0x8D ^ 0x89) < "   ".length()) {
                return;
            }
            do = do[1];
        }
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean do() {
        long l;
        block7: {
            do = do[0];
            l = System.currentTimeMillis();
            Object object = do;
            synchronized (object) {
                try {
                    do.wait(10000L);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                    break block7;
                }
                if ("   ".length() < 0) {
                    return ((0xCA ^ 0x97 ^ (0x40 ^ 0x38)) & (70 + 18 - -5 + 38 ^ 151 + 155 - 193 + 53 ^ -" ".length())) != 0;
                }
            }
        }
        "".length();
        if (gY.if(do ? 1 : 0)) {
            do = do[1];
        }
        if (gY.do(gY.do(System.currentTimeMillis() - l, 10000L))) {
            return do[0];
        }
        return do[1];
    }

    private static void if() {
        do = new int[2];
        gY.do[0] = " ".length();
        gY.do[1] = (0x86 ^ 0x89) & ~(0x1D ^ 0x12);
    }
}

