/*
 * Decompiled with CFR 0.152.
 */
import java.io.IOException;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public class bH {
    protected bm do;
    private bK do = ag_0.do();

    public final void if() {
        this.do.do(this.do);
        bm bm2 = this.do;
        try {
            if (bH.do(bm2.do)) {
                bm2.do.close();
            }
            if (bH.do(bm2.do)) {
                bm2.do.close();
                return;
            }
        }
        catch (IOException iOException) {
            "".length();
        }
    }

    public final void do(byte by2) {
        this.do = new bm(by2);
    }

    protected final void do(int n) {
        try {
            this.do.do.writeByte(n);
            return;
        }
        catch (IOException iOException) {
            iOException.printStackTrace();
            return;
        }
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public final void do(String string) {
        try {
            this.do.do.writeUTF(string);
            return;
        }
        catch (IOException iOException) {
            iOException.printStackTrace();
            return;
        }
    }

    protected final void if(int n) {
        try {
            this.do.do.writeInt(n);
            return;
        }
        catch (IOException iOException) {
            iOException.printStackTrace();
            return;
        }
    }

    protected final void for(int n) {
        try {
            this.do.do.writeShort(n);
            return;
        }
        catch (IOException iOException) {
            iOException.printStackTrace();
            return;
        }
    }
}

