/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 */
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class ae
extends ff_0 {
    private static int[] do;
    private Image do;

    private static boolean do(int n) {
        return n <= 0;
    }

    public final void do() {
    }

    private static void if() {
        do = new int[10];
        ae.do[0] = (0x58 ^ 0x1C ^ (0xDC ^ 0xAD)) & (" ".length() ^ (0x24 ^ 0x10) ^ -" ".length());
        ae.do[1] = 0xD ^ 0x2C;
        ae.do[2] = 0xFFFF9FFE & 0x634F;
        ae.do[3] = 101 + 130 - 176 + 76 ^ 0 + 0 - -62 + 95;
        ae.do[4] = "  ".length();
        ae.do[5] = -(0xFFFFFFF7 & 0x79DB) & (0xFFFFFFD7 & 0x7DFF);
        ae.do[6] = 0xFFFFEF35 & 0x1EDA;
        ae.do[7] = 0x82 ^ 0xBE;
        ae.do[8] = 0x15 ^ 0x1F;
        ae.do[9] = "   ".length();
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private static boolean do(Object object) {
        return object == null;
    }

    public final void do(Graphics graphics) {
        if (ae.do(this.do)) {
            this.try = ac_0.if((short)((short)this.char)).if;
            ac_0.do(graphics, this.char, this.int * bp.if, this.for * bp.if, do[1]);
            "".length();
            if (null != null) {
                return;
            }
        } else {
            graphics.drawImage(this.do, this.int * bp.if, this.for * bp.if, do[1]);
        }
        if (ae.do(this.char, do[2])) {
            bx.for.do(graphics, String.valueOf(gs_0.int), this.int * bp.if, this.for * bp.if - do[3] * bp.if, do[4]);
            return;
        }
        if (ae.do(this.char, do[5]) && ae.for(dT.do)) {
            int n;
            dI dI2 = dT.do(bC.do((short)dT.do).for);
            String string = "";
            int n2 = dT.int / do[6];
            if (ae.int(n2)) {
                string = String.valueOf(n2) + ":";
            }
            if (!ae.do(n = (dT.int - n2 * do[6]) / do[7]) || ae.int(n2)) {
                string = String.valueOf(string) + n + ":";
            }
            n2 = dT.int - n2 * do[6] - n * do[7];
            string = String.valueOf(string) + n2;
            if (ae.if(dT.int)) {
                string = "hoan thanh";
            }
            dT.else = this.int - bx.if.do(string) / do[4] / bp.if;
            dT.if = this.for - ac_0.if((short)((short)this.char)).do / bp.if - do[8];
            bC.do(graphics, dI2.do, this.int * bp.if - bx.if.do(string) / do[4], this.for * bp.if - ac_0.if((short)((short)this.char)).do - do[8] * bp.if, do[9]);
            bx.if.do(graphics, string, this.int * bp.if - bx.if.do(string) / do[4] + do[8] * bp.if, this.for * bp.if - ac_0.if((short)((short)this.char)).do - do[8] * bp.if - dH.byte / do[4] + do[4], do[0]);
        }
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    static {
        ae.if();
    }

    private static boolean if(Object object) {
        return object != null;
    }

    private static boolean for(int n) {
        return n != 0;
    }

    public ae(int n, int n2, int n3) {
        super(n, n2, n3, do[0]);
        f_0.do(bT.cA);
        this.do = f_0.do("" + n);
        if (ae.if(this.do)) {
            this.do.getWidth();
            "".length();
        }
        f_0.do();
    }

    private static boolean int(int n) {
        return n > 0;
    }
}

