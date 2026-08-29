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
public class hu
extends dF {
    public int this;
    public int void;
    public boolean for;
    public boolean int;
    public byte else;
    public byte goto;
    public int break = do[0];
    public byte long;
    public int catch;
    public int class;
    private static final int[] do;
    public int const;
    public boolean new;
    public int final;
    public int float;
    public boolean[] do;
    public int short;
    public fw for;

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    static {
        hu.char();
    }

    public hu() {
        this.int = do[0];
        this.do = new boolean[do[1]];
        this.class = do[0];
        this.new = do[0];
        this.final = do[0];
        this.if = do[1];
    }

    public void do(Graphics graphics) {
        if (hu.int(((dF)this).int * bp.if + do[5], fq.do().if) && hu.byte(((dF)this).int * bp.if - do[5], fq.do().if + bx.char) && hu.do(bx.do, fh_0.do())) {
            go_0 go_02 = bC.do((int)this.else);
            e e2 = ac_0.if(go_02.do[this.break]);
            if (hu.new(e2.do, do[6])) {
                int n;
                int n2;
                if (hu.do(((dF)this).new)) {
                    ((dF)this).new = (short)(e2.do / go_02.do);
                }
                if (hu.new(this.if ? 1 : 0, do[7])) {
                    this.long = go_02.do[this.byte][this.try];
                }
                Image image = e2.do;
                int n3 = do[0];
                short s2 = e2.if;
                if (hu.for(go_02.for, do[2])) {
                    n2 = ((dF)this).new / do[8] << do[3];
                    "".length();
                    if (null != null) {
                        return;
                    }
                } else {
                    n2 = do[0];
                }
                int n4 = ((dF)this).for * bp.if + this.goto - n2;
                if (hu.new(go_02.for, do[2])) {
                    n = do[9];
                    "".length();
                    if (-" ".length() < -" ".length()) {
                        return;
                    }
                } else {
                    n = do[10];
                }
                graphics.drawRegion(image, n3, this.long * ((dF)this).new, (int)s2, ((dF)this).new, (int)((dF)this).int, ((dF)this).int * bp.if, n4, n);
                super.do(graphics);
                this.do(graphics, ((dF)this).new + do[1], ((dF)this).int * bp.if, ((dF)this).for * bp.if);
            }
        }
    }

    private static boolean for(int n) {
        return n > 0;
    }

    private void do(Graphics graphics, int n, int n2, int n3) {
        int n4 = bC.do((int)this.else).do * do[11] - this.void;
        int n5 = this.break * do[12];
        if (hu.try(this.void, bC.do((int)this.else).do * do[11])) {
            w.do(n2 - (n5 + do[13]) * bp.if / do[1], n3 - (do[14] + this.goto) * bp.if - n, (n5 + do[13]) * bp.if, do[2] * bp.if, do[3], graphics);
            w.do(n2 - (n5 + do[15]) * bp.if / do[1], n3 - (do[10] + this.goto) * bp.if - n, this.float * (n5 + do[15]) / do[16] * bp.if, do[1] * bp.if, do[17], graphics);
            switch (this.else) {
                case 50: 
                case 56: {
                    n4 = do[7];
                    "".length();
                    if (-(80 + 75 - 125 + 105 ^ 89 + 126 - 118 + 34) <= 0) break;
                    return;
                }
                case 53: 
                case 59: {
                    n4 = do[18];
                    "".length();
                    if (-(125 + 119 - 227 + 131 ^ 123 + 104 - 223 + 141) < 0) break;
                    return;
                }
                case 52: {
                    n4 = do[15];
                    "".length();
                    if (" ".length() > ((19 + 144 - 87 + 104 ^ 0 + 63 - -50 + 17) & (0x4E ^ 0x26 ^ (0x26 ^ 0x78) ^ -" ".length()))) break;
                    return;
                }
                case 55: 
                case 60: 
                case 61: {
                    n4 = do[19];
                    "".length();
                    if (-"  ".length() <= 0) break;
                    return;
                }
                case 51: 
                case 54: 
                case 58: {
                    n4 = do[5];
                    "".length();
                    if (-" ".length() != " ".length()) break;
                    return;
                }
                default: {
                    n4 = do[6];
                }
            }
            if (hu.new(n4, do[6])) {
                String string;
                if (hu.try(n4 = n4 * do[20] * do[11] - this.void, do[21])) {
                    string = "-" + (n4 / do[21] + do[3]) + " ngay";
                    "".length();
                    if (null != null) {
                        return;
                    }
                } else {
                    string = "-" + n4 / do[11] + ":" + (n4 - n4 / do[11] * do[11]);
                }
                bx.if.do(graphics, string, n2, n3 - (do[22] + this.goto) * bp.if - n, do[1]);
            }
            "".length();
            if (null != null) {
                return;
            }
        } else {
            w.do(n2 - (n5 + do[13]) * bp.if / do[1], n3 - (do[14] + this.goto) * bp.if - n, (n5 + do[13]) * bp.if, do[2] * bp.if, do[3], graphics);
            w.do(n2 - (n5 + do[15]) * bp.if / do[1], n3 - (do[10] + this.goto) * bp.if - n, this.float * (n5 + do[15]) / do[16] * bp.if, do[1] * bp.if, do[17], graphics);
            bx.if.do(graphics, n4 / do[11] + ":" + (n4 - n4 / do[11] * do[11]), n2, n3 - (do[22] + this.goto) * bp.if - n, do[1]);
        }
        if (hu.for(this.if ? 1 : 0, do[7])) {
            n = do[19];
        }
        if (hu.if(this.do[do[0]])) {
            dT.try.do(do[0], n2 - do[19] * bp.if, n3 - (do[13] + this.goto) * bp.if - n, do[0], do[8], graphics);
        }
        if (hu.if(this.do[do[3]])) {
            dT.try.do(do[3], n2 + do[19] * bp.if, n3 - (do[13] + this.goto) * bp.if - n, do[0], do[8], graphics);
        }
    }

    public hu(int n, byte by2) {
        this.int = do[0];
        this.do = new boolean[do[1]];
        this.class = do[0];
        this.new = do[0];
        this.final = do[0];
        go_0 go_02 = bC.do((int)by2);
        ((dF)this).do = go_02.if;
        this.if = do[1];
        this.do(do[0], do[0]);
        ((dF)this).int = (byte)do[0];
        this.byte = (byte)do[0];
        this.char = n;
        this.break = do[0];
        this.try = (byte)do[2];
        ((dF)this).new = this.try;
        this.case = do[3];
        this.else = by2;
        this.try = hi.for(do[4]);
    }

    private static void char() {
        do = new int[25];
        hu.do[0] = (0x86 ^ 0x8B ^ (0x65 ^ 0x46)) & (1 + 40 - -38 + 110 ^ 105 + 25 - 22 + 39 ^ -" ".length());
        hu.do[1] = "  ".length();
        hu.do[2] = 0x87 ^ 0x83;
        hu.do[3] = " ".length();
        hu.do[4] = 0x17 ^ 0x1B;
        hu.do[5] = 0x56 ^ 0x48;
        hu.do[6] = -" ".length();
        hu.do[7] = 0x84 ^ 0x83;
        hu.do[8] = "   ".length();
        hu.do[9] = 0x33 ^ 0x12;
        hu.do[10] = 146 + 104 - 89 + 7 ^ 57 + 182 - 67 + 13;
        hu.do[11] = 0x12 ^ 0x2E;
        hu.do[12] = 0x6A ^ 0x6F;
        hu.do[13] = 0xB0 ^ 0xA6;
        hu.do[14] = 0x9F ^ 0x8D;
        hu.do[15] = 0xD7 ^ 0xC3;
        hu.do[16] = 0x66 ^ 0x14 ^ (0x7C ^ 0x6A);
        hu.do[17] = 0xFFFFFF41 & 0xFFBE;
        hu.do[18] = 0x23 ^ 5 ^ (0x7F ^ 0x56);
        hu.do[19] = 0x1F ^ 0x5D ^ (0x46 ^ 0xE);
        hu.do[20] = 0x90 ^ 0x88;
        hu.do[21] = -(0xFFFFEE2B & 0x3BF4) & (0xFFFFAFFF & 0x7FBF);
        hu.do[22] = 56 + 106 - -12 + 27 ^ 145 + 41 - 85 + 95;
        hu.do[23] = 0x17 ^ 0x60 ^ (0xF5 ^ 0xB0);
        hu.do[24] = 40 + 55 - -51 + 0 ^ 128 + 3 - -10 + 7;
    }

    private static boolean for(int n, int n2) {
        return n == n2;
    }

    public void for() {
    }

    public final void do(Graphics graphics, int n, int n2, boolean bl) {
        go_0 go_02 = bC.do((int)this.else);
        e e2 = ac_0.if(go_02.do[this.break]);
        if (hu.new(e2.do, do[6])) {
            int n3;
            if (hu.do(((dF)this).new)) {
                ((dF)this).new = (short)(e2.do / go_02.do);
            }
            if (hu.new(this.if ? 1 : 0, do[7])) {
                this.long = go_02.do[this.byte][this.try];
            }
            Image image = e2.do;
            int n4 = do[0];
            short s2 = e2.if;
            if (hu.new(go_02.for, do[2])) {
                n3 = do[9];
                "".length();
                if (-" ".length() > "   ".length()) {
                    return;
                }
            } else {
                n3 = do[10];
            }
            graphics.drawRegion(image, n4, this.long * ((dF)this).new, (int)s2, ((dF)this).new, (int)((dF)this).int, n, n2 + this.goto, n3);
            this.do(graphics, ((dF)this).new + do[1], n, n2);
        }
    }

    public void int() {
        this.byte = (byte)do[0];
        ((dF)this).else = ((dF)this).int;
        this.byte = ((dF)this).for;
        ((dF)this).goto = do[0];
        ((dF)this).new = do[0];
        this.const = do[0];
    }

    private static boolean int(int n, int n2) {
        return n >= n2;
    }

    private static boolean new(int n, int n2) {
        return n != n2;
    }

    public void case() {
        this.catch = hi.do(((dF)this).int, ((dF)this).for, this.for.if, this.for.for);
        this.short = hi.do(this.for.if - ((dF)this).int, -(this.for.for - ((dF)this).for));
    }

    private static boolean do(Object object, Object object2) {
        return object != object2;
    }

    public void try() {
    }

    private static boolean try(int n, int n2) {
        return n > n2;
    }

    public void byte() {
    }

    public void do() {
        if (hu.if(this.new ? 1 : 0)) {
            if (hu.try(bx.do() - this.final, do[19])) {
                this.new = do[0];
                return;
            }
        } else {
            this.try += do[3];
            if (hu.int(this.try, do[4])) {
                this.try = do[0];
            }
            this.byte();
            if (hu.new(this.byte, do[3])) {
                if (hu.do(this.try)) {
                    this.byte = (byte)hi.for(do[12] + (this.else - do[23]) * do[12]);
                    if (hu.new(this.byte, do[1])) {
                        this.byte = (byte)do[0];
                        "".length();
                        if ((0x3A ^ 0x3F) <= 0) {
                            return;
                        }
                    } else {
                        ((dF)this).int = (byte)hi.if(do[0], dF.case);
                    }
                }
                if (hu.for(this.this)) {
                    this.this -= do[3];
                    return;
                }
                this.for();
                if (hu.try(this.for.if, ((dF)this).int)) {
                    ((dF)this).int = (byte)do[0];
                    "".length();
                    if (null != null) {
                        return;
                    }
                } else {
                    ((dF)this).int = dF.case;
                }
                this.case();
                this.byte = (byte)do[3];
                "".length();
                if ("  ".length() < " ".length()) {
                    return;
                }
            } else {
                this.if();
            }
            super.do();
        }
    }

    public void if() {
        int n;
        int n2 = this.case * (this.const * hi.do(hi.new(this.short)) >> do[19]);
        if (hu.if(this.if(n2, n = -this.case * this.const * hi.if(hi.new(this.short)) >> do[19]) ? 1 : 0)) {
            if (hu.if(this.do(n2, n) ? 1 : 0)) {
                ((dF)this).int = (byte)(((dF)this).int + ((dF)this).goto);
                ((dF)this).for = (byte)(((dF)this).for + ((dF)this).new);
            }
            this.int();
            return;
        }
        ((dF)this).int = (byte)(((dF)this).else + n2);
        ((dF)this).for = (byte)(this.byte + n);
        n2 = hi.do(((dF)this).else, this.byte, ((dF)this).int, ((dF)this).for);
        this.const += do[3];
        if (hu.try(n2, this.catch)) {
            this.int();
        }
    }

    private static boolean byte(int n, int n2) {
        return n <= n2;
    }

    public void new() {
        fw fw2;
        this.for = fw2 = new fw(hi.for(fj.if * do[24]) << do[1], hi.for(fj.do * do[24]) << do[1]);
    }
}

