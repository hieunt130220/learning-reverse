/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from fD
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class fd_0 {
    public String do;
    public byte do;
    public short do;
    public short if;
    public String if;
    public short for = (short)do[0];
    public short int;
    public boolean do;
    public byte[] do;
    public short new;
    public short[] do;
    private static int[] do;
    public short try;
    public short[] if = new short[do[1]];

    private static void do() {
        do = new int[4];
        fd_0.do[0] = -" ".length();
        fd_0.do[1] = "  ".length();
        fd_0.do[2] = (0xF7 ^ 0x95) & ~(0xB ^ 0x69);
        fd_0.do[3] = " ".length();
    }

    public final void do(Graphics object, int n, int n2, int n3, int n4) {
        if (fd_0.do(this.do ? 1 : 0)) {
            bC.do(object, this.do[n], n2, n3, n4);
            return;
        }
        Graphics graphics = object;
        object = bC.do[this.do[n]];
        graphics.drawRegion(bC.do[object.int], object.new * dH.this, object.do * dH.this, object.try * dH.this, object.for * dH.this, do[2], n2, n3, n4);
    }

    public fd_0() {
        this.do = do[2];
        this.do = (byte)do[3];
    }

    private static boolean do(int n) {
        return n != 0;
    }

    static {
        fd_0.do();
    }
}

