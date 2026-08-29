/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from eD
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class ed_0
extends dL {
    private int do;
    private int if;
    private int for;
    private int int;
    private int new;
    private int try;
    private int byte;
    private static int[] do;
    private int case;
    private boolean do;
    private int char = ed_0.do[0];
    private int else;
    private String[] do;
    private int goto;
    private int long;
    private short[] do = ed_0.do[0];
    private int catch;

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean for(int n, int n2) {
        return n <= n2;
    }

    private static boolean int(int n, int n2) {
        return n > n2;
    }

    public final void new() {
        this.byte += do[6];
        int n = do[0];
        if (ed_0.do(bx.if ? 1 : 0) && ed_0.do(bx.do((bx.char - this.goto) / do[7], (bx.new - this.new) / do[7], this.goto, this.new) ? 1 : 0) && ed_0.int(this.do ? 1 : 0)) {
            this.char = this.long;
            this.do = do[6];
            this.catch = do[0];
        }
        if (ed_0.do(this.do ? 1 : 0)) {
            int n2 = bx.if();
            if (ed_0.do(bx.try ? 1 : 0)) {
                if (ed_0.int(bx.break % do[8])) {
                    this.do = bx.this;
                    this.case = this.byte;
                }
                this.if = this.char + n2;
                this.catch = do[0];
                if (!ed_0.new(this.if) || ed_0.int(this.if, this.try)) {
                    this.if = this.char + n2 / do[7];
                }
                this.long = this.if;
            }
            if (ed_0.do(bx.byte ? 1 : 0)) {
                this.do = do[0];
                int n3 = this.byte - this.case;
                int n4 = this.do - bx.this;
                if (ed_0.int(hi.int(n4), do[3]) && ed_0.do(n3, do[5]) && ed_0.if(this.if) && ed_0.do(this.if, this.try)) {
                    this.catch = n4 / n3 * do[5];
                }
                this.case = do[9];
                if (ed_0.do(Math.abs(n2), do[5])) {
                    this.if = this.char + n2;
                }
            }
        }
        if (ed_0.do(bx.do[do[7]])) {
            this.if -= dH.try;
            n = do[6];
            "".length();
            if (-"   ".length() >= 0) {
                return;
            }
        } else if (ed_0.do(bx.do[do[10]])) {
            n = do[6];
            this.if += dH.try;
        }
        if (ed_0.do(n)) {
            if (ed_0.for(this.if)) {
                this.if = do[0];
            }
            if (ed_0.int(this.if, this.try)) {
                this.if = this.try;
            }
        }
        if (ed_0.do(this.catch)) {
            if (!ed_0.new(this.long) || ed_0.int(this.long, this.try)) {
                this.catch -= this.catch / do[11];
                this.long += this.catch / do[12];
                if (ed_0.for(this.catch / do[5], do[6])) {
                    this.catch = do[0];
                }
            }
            if (ed_0.for(this.long)) {
                if (ed_0.do(this.long, -this.new / do[7])) {
                    this.long = -this.new / do[7];
                    this.if = do[0];
                    this.catch = do[0];
                    "".length();
                    if (" ".length() >= (0x16 ^ 0x12)) {
                        return;
                    }
                }
            } else if (ed_0.int(this.long, this.try)) {
                if (ed_0.do(this.long, this.try + this.new / do[7])) {
                    this.long = this.try + this.new / do[7];
                    this.if = this.try;
                    this.catch = do[0];
                    "".length();
                    if (-(0x6B ^ 0x6F) > 0) {
                        return;
                    }
                }
            } else {
                this.long += this.catch / do[5];
            }
            this.if = this.long;
            this.catch -= this.catch / do[5];
            if (ed_0.int(this.catch / do[5])) {
                this.catch = do[0];
                "".length();
                if ((0x88 ^ 0x8C) != (0xAA ^ 0xAE)) {
                    return;
                }
            }
        } else if (ed_0.for(this.long)) {
            this.if = do[0];
            "".length();
            if (null != null) {
                return;
            }
        } else if (ed_0.int(this.long, this.try)) {
            this.if = this.try;
        }
        if (ed_0.new(this.long, this.if)) {
            this.for = this.if - this.long << do[7];
            this.int += this.for;
            this.long += this.int >> do[11];
            this.int &= do[13];
        }
        super.new();
    }

    /*
     * Unable to fully structure code
     */
    public final void do(Graphics var1_1) {
        bx.do.do(var1_1, (bx.char - this.goto) / ed_0.do[7], (bx.goto - this.new) / ed_0.do[7] - (w.do + ed_0.do[8] * dH.this), this.new + (w.do + ed_0.do[8] * dH.this), this.goto, ed_0.do[0], ed_0.do[0], w.do().for, w.do().do, w.do, ed_0.do[6], ed_0.do[6], w.do().if, w.do().for, "L\u1ecbch s\u1eed");
        bx.if(var1_1);
        var1_1.translate((bx.char - this.goto) / ed_0.do[7], (bx.goto - this.new) / ed_0.do[7]);
        var1_1.setClip(ed_0.do[0], ed_0.do[4] * dH.this, this.goto, this.new - ed_0.do[5] * dH.this);
        var1_1.translate(ed_0.do[0], -this.long);
        var2_2 = ed_0.do[0];
        "".length();
        if (-" ".length() <= "  ".length()) ** GOTO lbl14
        return;
lbl-1000:
        // 1 sources

        {
            ac_0.do(var1_1, this.do[var2_2], ed_0.do[13] * dH.this, ed_0.do[13] * dH.this + var2_2 * this.else, ed_0.do[8]);
            bx.byte.do(var1_1, this.do[var2_2], ed_0.do[14] * dH.this, ed_0.do[13] * dH.this + var2_2 * this.else - dH.try / ed_0.do[7], ed_0.do[0]);
            ++var2_2;
lbl14:
            // 2 sources

            ** while (!ed_0.if((int)var2_2, (int)this.do.length))
        }
lbl15:
        // 1 sources

        super.do(var1_1);
    }

    static {
        ed_0.if();
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private static void if() {
        do = new int[15];
        ed_0.do[0] = (0xF3 ^ 0xB4) & ~(5 ^ 0x42);
        ed_0.do[1] = 74 + 22 - 28 + 82;
        ed_0.do[2] = 37 + 192 - 85 + 56;
        ed_0.do[3] = 0x13 ^ 0x3B;
        ed_0.do[4] = 0x70 ^ 0x75;
        ed_0.do[5] = 0x7D ^ 0x54 ^ (0x9B ^ 0xB8);
        ed_0.do[6] = " ".length();
        ed_0.do[7] = "  ".length();
        ed_0.do[8] = "   ".length();
        ed_0.do[9] = -" ".length();
        ed_0.do[10] = 0x6F ^ 0x1E ^ (0x10 ^ 0x69);
        ed_0.do[11] = 0x18 ^ 0x1C;
        ed_0.do[12] = 0xAF ^ 0xA2 ^ (0x49 ^ 0x50);
        ed_0.do[13] = 0x95 ^ 0x9A;
        ed_0.do[14] = 0x4B ^ 0x68;
    }

    /*
     * Unable to fully structure code
     */
    public ed_0(short[] var1_1, String[] var2_2) {
        super();
        this.do = var1_1;
        this.do = var2_2;
        this.new = new fn_0(bT.bq, null);
        this.new = ed_0.do[1] * dH.this;
        this.goto = ed_0.do[2] * dH.this;
        this.goto = ed_0.do[0];
        var3_3 = ed_0.do[0];
        "".length();
        if (" ".length() >= 0) ** GOTO lbl19
        throw null;
lbl-1000:
        // 1 sources

        {
            var4_4 = bx.byte.do(var2_2[var3_3]) + ed_0.do[3] * dH.this;
            if (ed_0.int(var4_4, this.goto)) {
                this.goto = var4_4;
            }
            ++var3_3;
lbl19:
            // 2 sources

            ** while (!ed_0.if((int)var3_3, (int)var2_2.length))
        }
lbl20:
        // 1 sources

        this.else = dH.try + ed_0.do[4] * dH.this;
        this.try = var1_1.length * this.else - (this.new - ed_0.do[5] * dH.this);
        if (ed_0.for(this.try)) {
            this.try = ed_0.do[0];
        }
    }

    private static boolean for(int n) {
        return n < 0;
    }

    private static boolean new(int n, int n2) {
        return n != n2;
    }

    private static boolean int(int n) {
        return n == 0;
    }

    private static boolean new(int n) {
        return n >= 0;
    }
}

