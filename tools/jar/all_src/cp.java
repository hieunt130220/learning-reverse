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
public final class cp
extends ff_0 {
    private byte do;
    private String do;
    private static int[] do;

    static {
        cp.if();
    }

    public cp(String string, int n, int n2) {
        this.if = (byte)do[0];
        this.int = n;
        this.for = n2;
        this.do = string;
        this.do = (byte)hi.for(do[0]);
    }

    private static boolean do(int n, int n2) {
        return n <= n2;
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public final void do(Graphics graphics) {
        if (!cp.for(gC.do().do[do[1]], do[1]) || cp.do(bx.do)) {
            return;
        }
        if (!(cp.if(this.int * bp.if, fq.do().if) && cp.do(this.int * bp.if, fq.do().if + bx.char) && cp.if(this.for * bp.if, fq.do().for) && cp.do(this.for * bp.if, fq.do().for + bx.new + do[3]) && !cp.do(bx.do, fh_0.do()))) {
            return;
        }
        graphics.drawImage(fj.do, this.int * bp.if, this.for * bp.if, do[4]);
        if (cp.do(gQ.do().do)) {
            gQ.do().do.do(do[2], this.int * bp.if, (this.for - do[3] + this.do / do[5]) * bp.if, do[2], do[6], graphics);
        }
        bx.if.do(graphics, this.do, this.int * bp.if, (this.for - do[7] + this.do / do[5]) * bp.if, do[5]);
    }

    private static void if() {
        do = new int[8];
        cp.do[0] = 51 + 112 - 156 + 134 ^ 67 + 114 - 179 + 131;
        cp.do[1] = " ".length();
        cp.do[2] = (0x64 ^ 6 ^ (0xC3 ^ 0xAF)) & (91 + 54 - 70 + 97 ^ 102 + 73 - 37 + 24 ^ -" ".length());
        cp.do[3] = 0xCD ^ 0xC7;
        cp.do[4] = "   ".length();
        cp.do[5] = "  ".length();
        cp.do[6] = 9 ^ 0x48 ^ (5 ^ 0x65);
        cp.do[7] = 0xD9 ^ 0xA3 ^ (0x59 ^ 3);
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    public final void do() {
        this.do = (byte)(this.do + do[1]);
        if (cp.if(this.do, do[0])) {
            this.do = (byte)do[2];
        }
    }
}

