/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Command
 *  javax.microedition.lcdui.CommandListener
 *  javax.microedition.lcdui.Displayable
 */
import javax.microedition.lcdui.Command;
import javax.microedition.lcdui.CommandListener;
import javax.microedition.lcdui.Displayable;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from bZ
 * Duplicate member names - consider using --renamedupmembers true
 */
final class bz_0
implements CommandListener {
    private final j_0 do;
    private static final int[] do;

    private static void do() {
        do = new int[1];
        bz_0.do[0] = " ".length();
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    private static boolean do(int n) {
        return n >= 0;
    }

    public final void commandAction(Command command, Displayable displayable) {
        if (bz_0.do(command, j_0.do(this.do)) && bz_0.do(j_0.do(this.do)) && bz_0.do(j_0.do(this.do), j_0.do(this.do).length)) {
            int n = j_0.do(this.do);
            if (bz_0.if(n) && bz_0.if(n, j_0.do(this.do).length - do[0])) {
                j_0 j_02 = this.do;
                j_0.do(j_02, j_0.do(j_02) - do[0]);
                "".length();
            }
            k.do();
            "".length();
            k.for(j_0.do((j_0)this.do)[n].if);
        }
        this.do.do();
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    bz_0(j_0 j_02) {
        this.do = j_02;
    }

    private static boolean if(int n) {
        return n > 0;
    }

    static {
        bz_0.do();
    }
}

