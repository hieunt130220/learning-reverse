/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from ao
 * Duplicate member names - consider using --renamedupmembers true
 */
public abstract class ao_0 {
    public byte do;
    public short if;
    private static int[] if;
    public String do;
    public byte if;
    public short for;
    public int[] do = new int[if[0]];
    public short int;

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    public void do(Graphics graphics, int n, int n2, int n3) {
        this.if(graphics, n, n2, n3);
    }

    public final void if(Graphics object, int n, int n2, int n3) {
        if (ao_0.for(this.for, if[1])) {
            if (ao_0.do(this.for, if[2])) {
                int n4 = n3;
                int n5 = n2;
                n3 = n;
                n2 = this.if;
                Graphics graphics = object;
                object = this;
                e e2 = ac_0.do((short)n2);
                if (!ao_0.if(e2.do, if[1]) || ao_0.if(object.for, if[1])) {
                    graphics.drawRegion(e2.do, if[3], if[3], (int)e2.if, (int)e2.do, if[3], n3, n5, n4);
                }
                return;
            }
            ac_0.do[this.if].do((Graphics)object, n, n2, n3);
        }
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    private static void do() {
        if = new int[4];
        ao_0.if[0] = "  ".length();
        ao_0.if[1] = -" ".length();
        ao_0.if[2] = 0xFFFFFFD8 & 0x7F7;
        ao_0.if[3] = (0x54 ^ 0x71 ^ (0xE1 ^ 0xB9) & ~(0x99 ^ 0xC1)) & (134 + 155 - 210 + 111 ^ 81 + 65 - 50 + 59 ^ -" ".length());
    }

    static {
        ao_0.do();
    }

    public void do(Graphics graphics, int n, int n2, int n3, int n4) {
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }
}

