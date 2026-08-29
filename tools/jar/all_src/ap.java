/*
 * Decompiled with CFR 0.152.
 */
import java.io.InputStream;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class ap
extends InputStream {
    private final InputStream do;
    private static final int[] do;

    private static void do() {
        do = new int[2];
        ap.do[0] = -" ".length();
        ap.do[1] = 108 + 102 - 0 + 45;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    public final int read() {
        int n = this.do.read();
        if (ap.do(n, do[0])) {
            return do[0];
        }
        return (n ^ do[0]) & do[1];
    }

    public ap(InputStream inputStream) {
        this.do = inputStream;
    }

    static {
        ap.do();
    }
}

