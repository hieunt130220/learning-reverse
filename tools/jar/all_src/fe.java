/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.io.Connector
 *  javax.microedition.io.SocketConnection
 */
import javax.microedition.io.Connector;
import javax.microedition.io.SocketConnection;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class fe
implements Runnable {
    private final String do;
    final ag_0 do;
    private static final int[] do;

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    static {
        fe.do();
    }

    public final void run() {
        ag_0.for = do[0];
        new Thread(new a_0(this)).start();
        this.do.do = do[1];
        this.do.int = do[1];
        try {
            ag_0.do(this.do, (SocketConnection)Connector.open((String)this.do));
            ag_0.do(this.do, ag_0.do(this.do).openDataOutputStream());
            this.do.do = ag_0.do(this.do).openDataInputStream();
            new Thread(ag_0.do(this.do)).start();
            this.do.do = new Thread(new dB(this.do));
            this.do.do.start();
            this.do.do = System.currentTimeMillis();
            ag_0.do(this.do, new bm(do[2]));
            this.do.do = do[0];
            return;
        }
        catch (Exception exception) {
            "".length();
            try {
                Thread.sleep(500L);
                "".length();
            }
            catch (InterruptedException interruptedException) {
                "".length();
            }
            if (" ".length() != " ".length()) {
                return;
            }
            if (fe.do(ag_0.for ? 1 : 0) && fe.do(this.do.do)) {
                this.do.do();
                this.do.do.for();
            }
            return;
        }
    }

    private static void do() {
        do = new int[3];
        fe.do[0] = (0x33 ^ 0x53) & ~(0x52 ^ 0x32);
        fe.do[1] = " ".length();
        fe.do[2] = -(0x7C ^ 0x2C ^ (0x45 ^ 0xE));
    }

    fe(ag_0 ag_02, String string) {
        this.do = ag_02;
        this.do = string;
    }
}

