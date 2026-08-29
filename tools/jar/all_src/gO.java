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
public final class gO {
    private int if;
    private static int[] do;
    int do;
    private int for;
    private int int;

    private static boolean do(int n, int n2) {
        return n > n2;
    }

    private static boolean if(int n, int n2) {
        return n <= n2;
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    private static boolean do(int n) {
        return n > 0;
    }

    private static void do() {
        do = new int[7];
        gO.do[0] = (0xB2 ^ 0xB7) + (130 + 141 - 138 + 34) - (31 + 136 - 61 + 35) + (77 + 107 - 100 + 85);
        gO.do[1] = 0xFFFFCF6E & 0x33F7;
        gO.do[2] = 0xFFFFE3F7 & 0x1F6F;
        gO.do[3] = -" ".length();
        gO.do[4] = (217 + 13 - 194 + 183 ^ 4 + 114 - 36 + 47) & (0x12 ^ 0x22 ^ (0x6F ^ 5) ^ -" ".length());
        gO.do[5] = "   ".length();
        gO.do[6] = "  ".length();
    }

    public final void do(Graphics graphics) {
        int n;
        if (gO.do(bx.char, do[0])) {
            n = do[1];
            "".length();
            if ((0x36 ^ 0x32) <= ((1 ^ 0x55) & ~(0x5E ^ 0xA))) {
                return;
            }
        } else {
            n = do[2];
        }
        Object object = ac_0.if((short)n);
        if (gO.for(((e)object).do, do[3])) {
            graphics.drawRegion(((e)object).do, do[4], this.int * ab_0.long, ab_0.goto, ab_0.long, do[4], this.if, this.for, do[5]);
            object = bx.new;
            if (gO.if(bx.char, do[0])) {
                object = bx.if;
            }
            if (gO.do(bx.int)) {
                object = bx.byte;
            }
            object.do(graphics, String.valueOf(this.do), this.if, this.for - dH.new / do[6], do[6]);
        }
    }

    static {
        gO.do();
    }

    public gO(int n, int n2, int n3, int n4) {
        this.if = n;
        this.for = n2;
        this.do = n3;
        this.int = n4;
    }
}

