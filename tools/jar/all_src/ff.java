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
public final class ff
extends fl {
    private byte char = (byte)do[1];
    public static int do;
    private static int[] do;
    private fw do;

    public ff(int n, byte by2) {
        super(n, by2);
        this.long = do[1];
        ((fl)this).do = (byte)do[2];
        ((bp)this).if = (byte)do[3];
        this.do = new fw(do[4], do[1], hi.for(do[5]));
    }

    private static boolean for(int n, int n2) {
        return n == n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    public final void try() {
        this.for = new fw();
        ((dF)this).else = this.for.if = dT.do.if + hi.for(dT.byte - do[2]) * do[14];
        ((bp)this).int = this.for.if;
        this.byte = this.for.for = dT.do.for + do[15] + hi.for(do[7]) * do[14];
        ((bp)this).for = this.for.for;
        String cfr_ignored_0 = "777777777777777777777: " + ((bp)this).int + "   " + ((bp)this).for;
        "".length();
    }

    public final void do() {
        if (!ff.new(this.do.do, do[6]) || ff.for(this.do.if, do[4])) {
            int n;
            if (ff.for(this.break, do[7]) && ff.if(((dF)this).int)) {
                n = do[8];
                "".length();
                if (-" ".length() > " ".length()) {
                    return;
                }
            } else {
                n = do[9];
            }
            this.do.if = ((bp)this).int + n;
            this.do.for = ((bp)this).for + do[7];
        }
        this.do.do += do[2];
        if (!ff.byte(this.do.do, do[10] * (do[8] - this.break)) || ff.for(this.char)) {
            this.do.do = do[1];
        }
        go_0 go_02 = bC.do((int)this.else);
        ((hu)this).long = go_02.do[this.byte][this.try];
        if (ff.for(hi.for(do[11]), do[7]) && ff.int(this.char) && ff.if(this.byte)) {
            this.char = (byte)do[5];
        }
        if (ff.for(this.char)) {
            ((hu)this).long = (byte)(do[7] - this.char / do[8] + do[7]);
            this.goto = this.char = (byte)(this.char - do[2]);
            if (ff.int(this.goto, do[12])) {
                this.goto = (byte)(do[12] - this.char % do[12]);
            }
            this.goto = (byte)(this.goto + do[0]);
            this.goto = -this.goto;
            "".length();
            if (-" ".length() >= (0x69 ^ 0x6D)) {
                return;
            }
        } else {
            this.goto = (byte)do[1];
        }
        super.do();
    }

    public final void do(Graphics graphics) {
        super.do(graphics);
        if (ff.try(this.do.do, do[13])) {
            graphics.setColor(ew_0.do[fj.do]);
            graphics.drawRoundRect((this.do.if - this.do.do / do[7]) * bp.if, (this.do.for - this.do.do / do[12]) * bp.if, this.do.do * bp.if, this.do.do / do[7] * bp.if, this.do.do * bp.if, this.do.do * bp.if);
        }
    }

    public final void new() {
        this.for = new fw(dT.do.if + do[16] + hi.for(dT.byte - do[7]) * do[14], dT.do.for + do[15] + hi.for(do[7]) * do[14]);
    }

    public final boolean if(int n, int n2) {
        if (ff.for(this.byte, do[19])) {
            ((dF)this).goto = do[1];
            ((dF)this).new = do[1];
            return do[2];
        }
        if (ff.do(this.byte) && ff.new(this.byte, do[2])) {
            ((dF)this).goto = do[1];
            ((dF)this).new = do[1];
            return do[2];
        }
        this.byte = (byte)do[2];
        int n3 = ((dF)this).else;
        int n4 = this.byte;
        if (ff.if(fj.if(n3 + n, n4 + n2) ? 1 : 0)) {
            if (ff.do(n)) {
                if (ff.for(n)) {
                    ((dF)this).goto = this.case;
                    "".length();
                    if (-(6 ^ 2) >= 0) {
                        return ((0x51 ^ 0x4E) & ~(0x2C ^ 0x33)) != 0;
                    }
                } else {
                    ((dF)this).goto = -this.case;
                }
            }
            if (ff.do(n2)) {
                if (ff.for(n2)) {
                    ((dF)this).new = this.case;
                    "".length();
                    if (-"  ".length() >= 0) {
                        return ((0x10 ^ 0x27 ^ (0x4B ^ 0x53)) & (0xCA ^ 0xAB ^ (0x1B ^ 0x55) ^ -" ".length())) != 0;
                    }
                } else {
                    ((dF)this).new = -this.case;
                }
            }
            return do[1];
        }
        ((dF)this).goto = do[1];
        ((dF)this).new = do[1];
        return do[2];
    }

    private static boolean int(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private static boolean for(int n) {
        return n > 0;
    }

    private static boolean new(int n, int n2) {
        return n != n2;
    }

    static {
        ff.char();
        do = do[0];
    }

    public final gd_0 do() {
        gd_0 gd_02 = (gd_0)dT.do[((fl)this).do].elementAt(hi.for(dT.do[((fl)this).do].size()));
        if (!ff.if(fj.if(((bp)gd_02).int, ((bp)gd_02).for) ? 1 : 0) || ff.do(gd_02.char)) {
            return null;
        }
        return gd_02;
    }

    private static boolean try(int n, int n2) {
        return n < n2;
    }

    private static boolean byte(int n, int n2) {
        return n <= n2;
    }

    private static boolean int(int n) {
        return n <= 0;
    }

    private static void char() {
        do = new int[20];
        ff.do[0] = 190 + 66 - 156 + 92 ^ 31 + 147 - 83 + 102;
        ff.do[1] = (0x74 ^ 0x35) & ~(0x5C ^ 0x1D);
        ff.do[2] = " ".length();
        ff.do[3] = 0x51 ^ 0x41 ^ (0x4A ^ 0x5D);
        ff.do[4] = -(0x80 ^ 0x8A);
        ff.do[5] = 0x22 ^ 0x2A;
        ff.do[6] = 0x30 ^ 0x52 ^ (0x6B ^ 0xF);
        ff.do[7] = "  ".length();
        ff.do[8] = "   ".length();
        ff.do[9] = -"   ".length();
        ff.do[10] = 0xA2 ^ 0x85 ^ (0x3B ^ 0xD);
        ff.do[11] = 0x82 ^ 0x8D ^ (2 ^ 0x69);
        ff.do[12] = 0x96 ^ 0x92;
        ff.do[13] = 0xA7 ^ 0xB7;
        ff.do[14] = 0x5D ^ 0x45;
        ff.do[15] = 0x2F ^ 0x23;
        ff.do[16] = 10 + 109 - 0 + 45 ^ 126 + 169 - 196 + 87;
        ff.do[17] = 0x3B ^ 0x31;
        ff.do[18] = 0x9D ^ 0x89;
        ff.do[19] = -" ".length();
    }

    public final void do(fw fw2) {
        this.for = new fw(fw2.if - do[17] + hi.for(do[18]), fw2.for - do[17] + hi.for(do[18]));
    }
}

