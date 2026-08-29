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
final class gW
extends fn_0 {
    private static int[] do;
    private int do;
    private bQ do;
    private int if;

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    static {
        gW.for();
    }

    private static void for() {
        do = new int[2];
        gW.do[0] = "  ".length();
        gW.do[1] = "   ".length();
    }

    private static boolean do(int n) {
        return n != 0;
    }

    public final void do(Graphics graphics, int n, int n2) {
        ac_0.do(graphics, this.do.do, n + fs.if / do[0], n2 + fs.if / do[0], do[1]);
    }

    public final void do() {
        if (gW.do(fs.do ? 1 : 0) && gW.do(fs.try - this.do, this.if)) {
            String string;
            fs.else();
            fs.do(String.valueOf(bT.ay) + this.do.do);
            StringBuffer stringBuffer = new StringBuffer(String.valueOf(bT.bD)).append(this.do.do);
            if (gW.if(this.do.do)) {
                string = bT.i;
                "".length();
                if (((0x38 ^ 0x62) & ~(0xCD ^ 0x97)) != 0) {
                    return;
                }
            } else {
                string = bT.interface;
            }
            fs.do(stringBuffer.append(string).toString());
        }
    }

    public gW(String string, ai_0 ai_02, int n, bQ bQ2, int n2) {
        super(string, ai_02);
        this.if = n;
        this.do = bQ2;
        this.do = n2;
    }

    private static boolean if(int n) {
        return n == 0;
    }
}

