/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from cS
 */
public final class cs_0 {
    private int do;
    private static int[] do;
    private int if;
    private int for;
    private boolean do = do[0];
    private int int;
    private int new;
    private static cs_0 do;
    private int try;

    public final void do(Graphics graphics, int n) {
        if (cs_0.for(this.do ? 1 : 0) && (!cs_0.do(hi.int(this.do - this.if), do[2]) || !cs_0.for(bx.do.void) || cs_0.if(bx.do.do ? 1 : 0))) {
            graphics.setColor(do[4]);
            graphics.setClip(n - do[1], do[5], do[6], this.try + do[7]);
            graphics.fillRect(n, do[0] + this.new / do[3], do[8], this.for);
        }
    }

    public final void do(int n, int n2) {
        if (cs_0.if(n, n2)) {
            this.do = do[1];
            return;
        }
        this.do = do[0];
        this.int = n;
        this.try = n2;
        this.for = n2 * n2 / n;
        if (cs_0.do(this.for)) {
            this.for = do[1];
        }
    }

    private static boolean do(int n) {
        return n <= 0;
    }

    private static void do() {
        do = new int[9];
        cs_0.do[0] = (0x9C ^ 0x8E) & ~(7 ^ 0x15);
        cs_0.do[1] = " ".length();
        cs_0.do[2] = 0x88 ^ 0x8D;
        cs_0.do[3] = 0xFE ^ 0x9A;
        cs_0.do[4] = -(0xFFFFDF2F & 0x7DF5) & (0xFFFFFFBF & 0x5EFDFF);
        cs_0.do[5] = -" ".length();
        cs_0.do[6] = 0x66 ^ 0x60;
        cs_0.do[7] = "  ".length();
        cs_0.do[8] = 0xD9 ^ 0xAB ^ (0xE5 ^ 0x93);
    }

    static {
        cs_0.do();
    }

    public static cs_0 do() {
        if (cs_0.do(do)) {
            do = new cs_0();
            return do;
        }
        return do;
    }

    private static boolean do(int n, int n2) {
        return n <= n2;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static boolean do(Object object) {
        return object == null;
    }

    public final void if(int n, int n2) {
        this.if = n;
        this.do = n2;
        if (cs_0.for(this.do ? 1 : 0) && (!cs_0.do(hi.int(n2 - n), do[2]) || !cs_0.for(bx.do.void) || cs_0.if(bx.do.do ? 1 : 0))) {
            n2 = this.int * do[3] / do[3];
            n = n * do[3] / n2;
            n2 = this.try * do[3] / do[3];
            this.new = n * n2;
        }
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    private static boolean for(int n) {
        return n == 0;
    }
}

