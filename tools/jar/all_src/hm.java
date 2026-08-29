/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 */
final class hm
extends fn_0 {
    private static int[] do;

    public final void do(Graphics graphics, int n, int n2) {
        int n3;
        Object object = bC.do(dT.do);
        dI dI2 = dT.do(((ez)object).for);
        bC.do(graphics, dI2.do, bx.do.this / do[0], fs.do / do[0] - do[1], do[2]);
        bx.for.do(graphics, ((ez)object).do, bx.do.this / do[0], fs.do / do[0] - do[1] + do[3] + bC.do((short)dI2.do).do / do[0] + dH.byte + do[0], do[0]);
        object = "";
        int n4 = dT.int / do[4];
        gb gb2 = bx.do;
        if (hm.do(n4)) {
            object = String.valueOf(n4) + ":";
        }
        if (!hm.for(n3 = (dT.int - n4 * do[4]) / do[5]) || hm.do(n4)) {
            object = String.valueOf(object) + n3 + ":";
        }
        n4 = dT.int - n4 * do[4] - n3 * do[5];
        object = String.valueOf(object) + n4;
        if (hm.if(dT.int)) {
            object = bT.bH;
            gb2 = bx.for;
        }
        gb2.do(graphics, (String)object, bx.do.this / do[0], fs.do / do[0] - do[1] + do[3] + bC.do((short)dI2.do).do / do[0], do[0]);
    }

    hm(String string, dH dH2) {
        super(string, do[0], dH2);
    }

    private static boolean do(int n) {
        return n > 0;
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private static void for() {
        do = new int[6];
        hm.do[0] = "  ".length();
        hm.do[1] = 0x70 ^ 0x6E;
        hm.do[2] = "   ".length();
        hm.do[3] = 0x3B ^ 0x3E;
        hm.do[4] = -(0xFFFFB93F & 0x67CB) & (0xFFFFEFBF & 0x3F5A);
        hm.do[5] = 0x4D ^ 0x71;
    }

    static {
        hm.for();
    }

    private static boolean for(int n) {
        return n <= 0;
    }
}

