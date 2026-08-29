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
 * Renamed from dE
 */
public final class de_0 {
    public int[] do;
    public byte do;
    public int do;
    public boolean do;
    public int if;
    public int for;
    public int int;
    public byte if;
    public int new;
    public int try;
    public boolean if;
    private static int[] if;
    public int byte;
    public int case;

    public final void do(Graphics graphics) {
        bx.do.for(graphics, this);
    }

    public de_0(byte by2, boolean bl) {
        this(by2);
        if (de_0.do(bl ? 1 : 0)) {
            int[] nArray = new int[if[0]];
            nArray[de_0.if[1]] = if[2];
            nArray[de_0.if[3]] = if[4];
            nArray[de_0.if[5]] = if[3];
            nArray[de_0.if[6]] = if[7];
            nArray[de_0.if[8]] = if[5];
            nArray[de_0.if[9]] = if[6];
            nArray[de_0.if[10]] = if[8];
            nArray[de_0.if[11]] = if[9];
            nArray[de_0.if[12]] = if[10];
            nArray[de_0.if[13]] = if[11];
            nArray[de_0.if[2]] = if[12];
            nArray[de_0.if[4]] = if[13];
            this.do = nArray;
        }
    }

    public final void if(Graphics graphics) {
        bx.do.if(graphics, this);
    }

    static {
        de_0.do();
    }

    public de_0(byte by2) {
        int n;
        this.if = by2;
        this.do = (byte)if[1];
        this.byte = this.if % if[6];
        this.int = this.if / if[6];
        if (de_0.if(this.byte, if[7])) {
            n = if[1];
            "".length();
            if (-"   ".length() >= 0) {
                throw null;
            }
        } else {
            n = if[3];
        }
        this.for = n;
        int[] nArray = new int[if[0]];
        nArray[de_0.if[3]] = if[3];
        nArray[de_0.if[7]] = if[7];
        nArray[de_0.if[5]] = if[5];
        nArray[de_0.if[6]] = if[6];
        nArray[de_0.if[8]] = if[8];
        nArray[de_0.if[9]] = if[9];
        nArray[de_0.if[10]] = if[10];
        nArray[de_0.if[11]] = if[11];
        nArray[de_0.if[12]] = if[12];
        nArray[de_0.if[13]] = if[13];
        nArray[de_0.if[2]] = if[2];
        nArray[de_0.if[4]] = if[4];
        this.do = nArray;
    }

    private static void do() {
        if = new int[15];
        de_0.if[0] = 0x37 ^ 0x3A;
        de_0.if[1] = (0x21 ^ 0x68) & ~(0x49 ^ 0);
        de_0.if[2] = 0xEA ^ 0xC5 ^ (0x83 ^ 0xA7);
        de_0.if[3] = " ".length();
        de_0.if[4] = 0x9B ^ 0x97;
        de_0.if[5] = "   ".length();
        de_0.if[6] = 155 + 104 - 164 + 66 ^ 29 + 39 - -49 + 48;
        de_0.if[7] = "  ".length();
        de_0.if[8] = 137 + 169 - 274 + 140 ^ 102 + 102 - 41 + 6;
        de_0.if[9] = 8 ^ 0xE;
        de_0.if[10] = 1 ^ 6;
        de_0.if[11] = 0xD ^ 5;
        de_0.if[12] = 0x28 ^ 0x21;
        de_0.if[13] = 25 + 97 - 33 + 52 ^ 134 + 69 - 166 + 98;
        de_0.if[14] = -" ".length();
    }

    private static boolean do(int n, int n2) {
        return n <= n2;
    }

    public final int do() {
        if (de_0.int(this.new, this.if) && de_0.int(this.case, this.do)) {
            return if[14];
        }
        if (de_0.do(Math.abs((this.if - this.new) / if[7]), if[3]) && de_0.do(Math.abs((this.do - this.case) / if[7]), if[3])) {
            this.new = this.if;
            this.case = this.do;
            return if[1];
        }
        if (de_0.for(this.new, this.if)) {
            this.new += (this.if - this.new) / if[7];
        }
        if (de_0.for(this.case, this.do)) {
            this.case += (this.do - this.case) / if[7];
        }
        if (de_0.do(hi.do(this.new, this.case, this.if, this.do), this.try / if[8])) {
            return if[7];
        }
        return if[3];
    }

    public final void for(Graphics graphics) {
        bx.do.do(graphics, this);
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    public final void do(Graphics graphics, boolean bl) {
        bx.do.do(graphics, this, bl);
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    private static boolean int(int n, int n2) {
        return n == n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }
}

