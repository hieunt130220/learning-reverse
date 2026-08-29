/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class bg
extends fn_0 {
    private short if;
    private int do;
    private int if;
    private static final int[] do;
    private ao_0 do;

    static {
        bg.for();
    }

    public bg(String string, dN dN2, ao_0 ao_02, short s2, int n, int n2) {
        super(string, dN2);
        this.do = ao_02;
        this.if = s2;
        this.if = n;
        this.do = n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static void for() {
        do = new int[5];
        bg.do[0] = -" ".length();
        bg.do[1] = (0x13 ^ 0x4D) & ~(0x19 ^ 0x47);
        bg.do[2] = " ".length();
        bg.do[3] = "   ".length();
        bg.do[4] = "  ".length();
    }

    public final void do(Graphics graphics, int n, int n2) {
        ao_0 ao_02 = this.do;
        if (bg.do(this.do.for, do[0])) {
            ao_02 = ac_0.do(this.if);
        }
        if (bg.if(ao_02.for, do[0])) {
            ao_02.if(graphics, n + fs.if / do[4], n2 + fs.if / do[4], do[3]);
        }
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    public final void do() {
        if (bg.do(fs.do ? 1 : 0) && bg.do(this.if, fs.try)) {
            ao_0 ao_02 = this.do;
            if (bg.do(this.do.for, do[0])) {
                ao_02 = ac_0.do(this.if);
            }
            if (bg.if(ao_02.for, do[0])) {
                short s2;
                gs_0.if(ao_02);
                fs.else();
                StringBuffer stringBuffer = new StringBuffer().append("id ");
                if (bg.if(this.do.for, do[0])) {
                    s2 = this.do.for;
                    "".length();
                    if ("  ".length() >= (0xC6 ^ 0x90 ^ (0xD1 ^ 0x83))) {
                        return;
                    }
                } else {
                    s2 = this.if;
                }
                fs.do(stringBuffer.append(s2).append(": ").append(ao_02.do).toString());
                if (bg.do(this.do, do[0])) {
                    fs.do(bx.do(ao_02.do[do[1]], ao_02.do[do[2]], do[1]));
                }
                if (bg.do(ao_02.int, do[0])) {
                    fs.do(bT.long[do[1]] + ((da)ao_02).for);
                }
                fs.do(bT.bB + AngelChip.do.for);
                if (bg.do(gs_0.do ? 1 : 0)) {
                    fs.do(bT.au + AngelChip.do.do[do[3]] + " " + bT.do());
                }
            }
        }
    }
}

