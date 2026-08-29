/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.io.SocketConnection
 */
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import javax.microedition.io.SocketConnection;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ag
 */
public final class ag_0
implements bK {
    public int do;
    public boolean do;
    boolean if;
    public gz do;
    public static boolean for;
    private byte do;
    private static ag_0 do;
    public int if;
    public String do;
    public byte[] do;
    long do;
    private final hg do;
    private static final int[] do;
    private DataOutputStream do;
    private byte if;
    private Thread if;
    public Thread do;
    private SocketConnection do;
    public DataInputStream do = "";
    public boolean int;

    static hg do(ag_0 ag_02) {
        return ag_02.do;
    }

    static {
        ag_0.for();
        do = new ag_0();
    }

    public final void do() {
        bx_0.do.new();
        this.if();
    }

    static void do(ag_0 ag_02, DataOutputStream dataOutputStream) {
        ag_02.do = dataOutputStream;
    }

    public final void do(gz gz2) {
        this.do = gz2;
    }

    static void do(ag_0 ag_02, bm bm2) {
        ag_02.if(bm2);
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    public final void do(bm bm2) {
        this.do.do.addElement(bm2);
    }

    public final boolean do() {
        return this.int;
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private void if() {
        this.do = null;
        this.do = (byte)do[0];
        this.if = (byte)do[0];
        try {
            this.int = do[0];
            this.do = do[0];
            if (ag_0.do(this.do)) {
                this.do.close();
                this.do = null;
            }
            if (ag_0.do(this.do)) {
                this.do.close();
                this.do = null;
            }
            if (ag_0.do(this.do)) {
                this.do.close();
                this.do = null;
            }
            this.do = null;
            System.gc();
            return;
        }
        catch (Exception exception) {
            "".length();
            return;
        }
    }

    private static void for() {
        do = new int[5];
        ag_0.do[0] = (0xC8 ^ 0xC4) & ~(0xBC ^ 0xB0);
        ag_0.do[1] = 0xC4 ^ 0xAE ^ (0x41 ^ 0x23);
        ag_0.do[2] = 17 + 49 - 26 + 95 ^ 15 + 8 - -27 + 80;
        ag_0.do[3] = " ".length();
        ag_0.do[4] = (0x17 ^ 0x4E) + (182 + 139 - 143 + 9) - (139 + 200 - 255 + 119) + (154 + 42 - 29 + 15);
    }

    static byte do(ag_0 ag_02, byte by2) {
        byte[] byArray = ag_02.do;
        byte by3 = ag_02.do;
        ag_02.do = (byte)(by3 + do[3]);
        by2 = (byte)(byArray[by3] & do[4] ^ by2 & do[4]);
        if (ag_0.do(ag_02.do, ag_02.do.length)) {
            ag_02.do = (byte)(ag_02.do % ag_02.do.length);
        }
        return by2;
    }

    private synchronized void if(bm bm2) {
        byte[] byArray = bm2.do.toByteArray();
        try {
            if (ag_0.if(this.if ? 1 : 0)) {
                byte by2 = this.do(bm2.do);
                this.do.writeByte(by2);
                "".length();
                if ("  ".length() <= 0) {
                    return;
                }
            } else {
                this.do.writeByte(bm2.do);
            }
            if (ag_0.do(byArray)) {
                int n;
                int n2 = byArray.length;
                if (ag_0.if(this.if ? 1 : 0)) {
                    n = this.do((byte)(n2 >> do[1]));
                    this.do.writeByte(n);
                    n2 = this.do((byte)n2);
                    this.do.writeByte(n2);
                    "".length();
                    if ("   ".length() <= ((0x83 ^ 0x8E) & ~(0x87 ^ 0x8A))) {
                        return;
                    }
                } else {
                    this.do.writeShort(n2);
                }
                if (ag_0.if(this.if ? 1 : 0)) {
                    n = do[0];
                    while (ag_0.if(n, byArray.length)) {
                        byArray[n] = this.do(byArray[n]);
                        ++n;
                        "".length();
                        if ("  ".length() == "  ".length()) continue;
                        return;
                    }
                }
                this.do.write(byArray);
                this.do += do[2] + byArray.length;
                "".length();
                if ("   ".length() <= 0) {
                    return;
                }
            } else {
                this.do.writeShort(do[0]);
                this.do += do[2];
            }
            this.do.flush();
            return;
        }
        catch (IOException iOException) {
            "".length();
            return;
        }
    }

    private static boolean do(Object object) {
        return object != null;
    }

    static void do(ag_0 ag_02) {
        ag_02.if();
    }

    public final void do(String string) {
        if (ag_0.do(this.int ? 1 : 0) && ag_0.do(this.do ? 1 : 0)) {
            this.if = do[0];
            this.do = null;
            this.if = new Thread(new fe(this, string));
            this.if.start();
        }
    }

    private byte do(byte by2) {
        byte[] byArray = this.do;
        byte by3 = this.if;
        this.if = (byte)(by3 + do[3]);
        by2 = (byte)(byArray[by3] & do[4] ^ by2 & do[4]);
        if (ag_0.do(this.if, this.do.length)) {
            this.if = (byte)(this.if % this.do.length);
        }
        return by2;
    }

    static void do(ag_0 ag_02, SocketConnection socketConnection) {
        ag_02.do = socketConnection;
    }

    static SocketConnection do(ag_0 ag_02) {
        return ag_02.do;
    }

    public static ag_0 do() {
        return do;
    }
}

