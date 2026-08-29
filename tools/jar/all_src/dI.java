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
 */
public final class dI {
    private static int[] do;
    public short do;
    public int do;
    public short if;
    public byte do;
    public byte if;
    public boolean do;
    public String do;
    public int if;

    private static void do() {
        do = new int[3];
        dI.do[0] = -" ".length();
        dI.do[1] = (0x13 ^ 0x1F) & ~(0x84 ^ 0x88);
        dI.do[2] = "   ".length();
    }

    static {
        dI.do();
    }

    public final void do(Graphics graphics, int n, int n2) {
        e e2 = bC.do(this.do);
        if (dI.do(e2.do, do[0])) {
            graphics.drawRegion(e2.do, do[1], do[1], (int)e2.if, (int)e2.do, do[1], n, n2, do[2]);
        }
    }

    private static boolean do(int n, int n2) {
        return n != n2;
    }
}

