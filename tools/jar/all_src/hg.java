/*
 * Decompiled with CFR 0.152.
 */
import java.io.IOException;
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class hg
implements Runnable {
    private ag_0 do;
    final Vector do;
    private static int[] do;

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void run() {
        try {
            "".length();
            if ((0x73 ^ 0x77) < -" ".length()) {
                return;
            }
            while (true) {
                if (hg.if(this.do.int ? 1 : 0)) {
                    return;
                }
                if (hg.do(this.do.if ? 1 : 0)) {
                    "".length();
                    while (!hg.for(this.do.size())) {
                        bm bm2 = (bm)this.do.elementAt(do[0]);
                        this.do.removeElementAt(do[0]);
                        ag_0.do(this.do, bm2);
                    }
                }
                try {
                    Thread.sleep(10L);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                }
            }
        }
        catch (IOException iOException) {
            iOException.printStackTrace();
            return;
        }
    }

    private static void do() {
        do = new int[1];
        hg.do[0] = (0x80 ^ 0x91) & ~(0x34 ^ 0x25);
    }

    public hg(ag_0 ag_02) {
        this.do = ag_02;
        this.do = new Vector();
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean if(int n) {
        return n == 0;
    }

    static {
        hg.do();
    }

    private static boolean for(int n) {
        return n <= 0;
    }
}

