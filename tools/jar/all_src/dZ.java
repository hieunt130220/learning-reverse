/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import java.util.Vector;
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class dZ
extends dL {
    public Vector do;
    public int do;
    public int if = do[0];
    public int for;
    public int int;
    public int new;
    private static dZ do;
    private static int[] do;
    public String do = "";

    public static dZ do() {
        if (dZ.if(do)) {
            do = new dZ();
        }
        return do;
    }

    private static void for() {
        do = new int[6];
        dZ.do[0] = "   ".length() & ~"   ".length();
        dZ.do[1] = 0x76 ^ 0x39 ^ (0x8F ^ 0xC5);
        dZ.do[2] = "  ".length();
        dZ.do[3] = " ".length();
        dZ.do[4] = "   ".length();
        dZ.do[5] = 0x21 ^ 0x2E;
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    /*
     * Unable to fully structure code
     */
    public final void do(Graphics var1_1) {
        bx.do.if(var1_1, this.for, this.if, this.int, this.do, dZ.do[0]);
        var2_2 = this.if + w.do + (dZ.do[1] + dH.break - dH.new / dZ.do[2]);
        var3_3 = dZ.do[0];
        "".length();
        if (" ".length() >= 0) ** GOTO lbl19
        return;
lbl-1000:
        // 1 sources

        {
            var4_4 = (String)this.do.elementAt(var3_3);
            if (dZ.if((int)var4_4.substring(dZ.do[0], dZ.do[3]).equals("0"))) {
                bx.if.do(var1_1, var4_4.substring(dZ.do[3]), this.for + this.int / dZ.do[2], var2_2 + dZ.do[4] + dH.new / dZ.do[2] - dH.byte / dZ.do[2], dZ.do[2]);
                "".length();
                if (null != null) {
                    return;
                }
            } else {
                bx.byte.do(var1_1, var4_4, this.for + dZ.do[5], var2_2 + dZ.do[4], dZ.do[0]);
            }
            var2_2 += dH.new;
            ++var3_3;
lbl19:
            // 2 sources

            ** while (!dZ.do((int)var3_3, (int)this.do.size()))
        }
lbl20:
        // 1 sources

        super.do(var1_1);
    }

    public final void do(int n) {
        switch (n) {
            case 0: {
                bx.case();
                do = null;
            }
        }
    }

    private static boolean if(Object object) {
        return object == null;
    }

    public final void if() {
        if (dZ.do(this.do) && dZ.do(this.do.size())) {
            bx.do = this;
        }
    }

    public dZ() {
        ((dH)this).new = new fn_0(bT.bq, do[0]);
    }

    public final void byte() {
    }

    private static boolean do(int n) {
        return n > 0;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    static {
        dZ.for();
    }
}

