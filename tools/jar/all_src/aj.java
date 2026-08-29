/*
 * Decompiled with CFR 0.152.
 */
import java.util.Enumeration;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class aj
implements Enumeration {
    private int do;
    private static final int[] do;
    private final hd do;

    aj(hd hd2) {
        this.do = hd2;
        this.do = do[0];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    public final Object nextElement() {
        hd hd2 = this.do;
        synchronized (hd2) {
            if (aj.do(this.do, this.do.do.size())) {
                cf cf2 = (cf)this.do.do.elementAt(this.do);
                this.do += do[1];
                return cf2.if;
            }
            return null;
        }
    }

    private static void do() {
        do = new int[2];
        aj.do[0] = (0x44 ^ 0x7B ^ (2 ^ 0x7F)) & (0xF3 ^ 0xB4 ^ (0x3B ^ 0x3E) ^ -" ".length());
        aj.do[1] = " ".length();
    }

    static {
        aj.do();
    }

    public final boolean hasMoreElements() {
        if (aj.do(this.do, this.do.do.size())) {
            return do[1];
        }
        return do[0];
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }
}

