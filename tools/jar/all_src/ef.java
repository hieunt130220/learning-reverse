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
public final class ef
extends dF {
    public int do;
    private static int[] do;
    byte do;
    private byte goto;
    public int long;
    private byte long;
    short do;
    public short if;
    public byte char;
    byte else;
    public int this;
    private byte this = (byte)do[0];

    public ef(byte by2, short s2, int n) {
        this.do = n;
        ((bp)this).if = (byte)do[1];
        this.char = by2;
        this.if = s2;
        this.goto = (byte)do[2];
        ao_0 ao_02 = ac_0.do(this.if);
        if (ef.new(ao_02.if, ac_0.do.length)) {
            ((bp)this).new = ac_0.do[ao_02.if].for;
        }
        this.long = (byte)hi.for(do[3]);
    }

    public final void do() {
        switch (this.do) {
            case 0: 
            case 1: {
                ((bp)this).int += (short)(this.long - ((bp)this).int >> do[4]);
                ((bp)this).for += (short)(this.this - ((bp)this).for >> do[4]);
                if (ef.for(this.else, do[5])) {
                    this.do = (short)(this.do + this.else);
                    this.else = (byte)(this.else - do[0]);
                }
                if (ef.for(hi.int(((bp)this).int - this.long), do[6]) && !ef.new(hi.int(((bp)this).for - this.this), do[6]) || !ef.try(this.do, do[0])) break;
                ((bp)this).int = this.long;
                ((bp)this).for = this.this;
                this.do = (short)do[2];
                this.else = (byte)do[2];
                if (ef.int(this.do, do[0])) {
                    fj.do(this);
                }
                this.do = (byte)do[4];
                return;
            }
            case 3: {
                this.do = (short)(this.do + do[7]);
                if (!ef.byte(this.do, do[8])) break;
                fj.do(this);
                return;
            }
            case 4: {
                if (ef.if(this.do)) {
                    this.do = (short)(this.do - this.else);
                    this.else = (byte)(this.else + do[0]);
                    return;
                }
                this.do = (short)do[2];
                this.do = (byte)do[4];
            }
        }
    }

    private static void if() {
        do = new int[10];
        ef.do[0] = " ".length();
        ef.do[1] = 0x57 ^ 0x52;
        ef.do[2] = (0xC9 ^ 0x8C) & ~(0x27 ^ 0x62);
        ef.do[3] = 0x62 ^ 0x46 ^ (0x37 ^ 0x19);
        ef.do[4] = "  ".length();
        ef.do[5] = -(163 + 5 - 39 + 58 ^ 162 + 133 - 112 + 6);
        ef.do[6] = 0x9F ^ 0x9B;
        ef.do[7] = "   ".length();
        ef.do[8] = 48 + 55 - -19 + 37 ^ 147 + 49 - 190 + 167;
        ef.do[9] = 0xBA ^ 0x9B;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean for(int n, int n2) {
        return n >= n2;
    }

    private static boolean int(int n, int n2) {
        return n == n2;
    }

    public final void do(Graphics graphics) {
        graphics.drawImage(fj.do, ((bp)this).int, ((bp)this).for + do[0], do[9]);
        if (ef.do(this.char)) {
            ac_0.do(this.if).do(graphics, ((bp)this).int, ((bp)this).for + this.long / do[3] - this.do, do[9]);
            "".length();
            if (" ".length() >= "  ".length()) {
                return;
            }
        } else {
            ((bp)this).new = (short)(ac_0.if((short)this.if).do + do[3]);
            ac_0.do(graphics, this.if, ((bp)this).int, ((bp)this).for + this.long / do[3] - this.do, do[9]);
        }
        this.long = (byte)(this.long + this.this);
        if (ef.for(hi.int(this.long), do[3])) {
            this.goto = -this.goto;
        }
    }

    private static boolean new(int n, int n2) {
        return n < n2;
    }

    public ef() {
        ((bp)this).if = (byte)do[1];
    }

    private static boolean if(int n) {
        return n > 0;
    }

    static {
        ef.if();
    }

    private static boolean try(int n, int n2) {
        return n <= n2;
    }

    private static boolean byte(int n, int n2) {
        return n > n2;
    }
}

