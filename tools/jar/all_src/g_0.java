/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from G
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class g_0
extends ff_0 {
    private int new = do[0];
    public short do;
    public int do;
    public byte[] do;
    private int try = do[0];
    private static int[] do;
    public byte[] if;
    public long do;
    public short if;
    public short for;
    public short int;

    static {
        g_0.if();
    }

    private static boolean do(int n, int n2) {
        return n > n2;
    }

    private static boolean do(int n) {
        return n < 0;
    }

    /*
     * Enabled aggressive block sorting
     */
    public final void do() {
        if (g_0.int(g_0.do(System.currentTimeMillis() - this.do, 1000L))) {
            Object object;
            if (g_0.for(this.do)) {
                this.do -= do[1];
                if (g_0.if(this.do)) {
                    object = ev_0.do();
                    ((bH)object).do(do[2]);
                    ((bH)object).if();
                }
            }
            this.do = System.currentTimeMillis();
            object = bC.do(this.int);
            if (g_0.for(((e)object).if) && g_0.if(this.new)) {
                this.new = ((e)object).if / do[3] << do[1];
                this.try = ((e)object).do / do[4];
                object = this;
                if (g_0.for(((g_0)object).if)) {
                    int n = hi.for(do[3]) + do[3];
                    ((g_0)object).if = new byte[n];
                    ((g_0)object).do = new byte[n];
                    int n2 = do[0];
                    "".length();
                    while (!g_0.if(n2, n)) {
                        ((g_0)object).if[n2] = (byte)(hi.for(((g_0)object).new - do[5]) - (((g_0)object).new - do[5]) / do[4]);
                        ((g_0)object).do[n2] = (byte)(hi.for(((g_0)object).try - do[5]) - (((g_0)object).try - do[5]) / do[4]);
                        ++n2;
                    }
                }
            }
        }
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private static void if() {
        do = new int[11];
        g_0.do[0] = (0x31 ^ 0x41 ^ (0x22 ^ 0x7D)) & (24 + 39 - -70 + 12 ^ 92 + 85 - 158 + 171 ^ -" ".length());
        g_0.do[1] = " ".length();
        g_0.do[2] = 0xC2 ^ 0x91;
        g_0.do[3] = "   ".length();
        g_0.do[4] = "  ".length();
        g_0.do[5] = 0x81 ^ 0x8B;
        g_0.do[6] = 0xB9 ^ 0xBE ^ (0xE1 ^ 0xC7);
        g_0.do[7] = 0x1A ^ 0x1F;
        g_0.do[8] = 0x87 ^ 0x8F;
        g_0.do[9] = 0xFFFF8F10 & 0x7EFF;
        g_0.do[10] = 0x72 ^ 0x30 ^ (0x73 ^ 0xD);
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean for(int n) {
        return n > 0;
    }

    private static boolean int(int n) {
        return n >= 0;
    }

    /*
     * Unable to fully structure code
     */
    public final void do(Graphics var1_1) {
        block4: {
            if (g_0.do(this.char) && (!g_0.if(this.int * bp.if + this.new / g_0.do[4], fq.do().if) || g_0.do(this.int * bp.if - this.new / g_0.do[4], fq.do().if + bx.char))) {
                return;
            }
            bC.do(var1_1, this.int, this.int * bp.if, this.for * bp.if, g_0.do[6]);
            if (!g_0.for(this.if) || !g_0.do(this.if)) break block4;
            var2_2 = g_0.do[0];
            "".length();
            if (-"   ".length() <= 0) ** GOTO lbl12
            return;
lbl-1000:
            // 1 sources

            {
                bC.do(var1_1, this.for, this.int * bp.if + this.if[var2_2], this.for * bp.if - (bC.do((short)this.int).do / g_0.do[4] + g_0.do[7]) + this.do[var2_2], g_0.do[3]);
                ++var2_2;
lbl12:
                // 2 sources

                ** while (!g_0.if((int)var2_2, (int)this.if.length))
            }
        }
        var2_2 = bC.do((short)this.int).do + dH.try;
        if (g_0.for(this.do)) {
            var2_2 += dH.byte;
        }
        bC.do(var1_1, this.for, (this.int - g_0.do[8]) * bp.if, this.for * bp.if - var2_2, g_0.do[3]);
        bx.int.do(var1_1, "Lv" + this.do, this.int * bp.if, this.for * bp.if - var2_2 - dH.try / g_0.do[4], g_0.do[0]);
        if (g_0.for(this.do)) {
            var3_3 = this.do / g_0.do[9];
            var4_4 = (this.do - var3_3 * g_0.do[9]) / g_0.do[10];
            var5_5 = this.do - var3_3 * g_0.do[9] - var4_4 * g_0.do[10];
            bx.if.do(var1_1, String.valueOf(var3_3) + ":" + var4_4 + ":" + var5_5, (this.int + g_0.do[3]) * bp.if, this.for * bp.if - var2_2 + bx.int.do() / g_0.do[4] + g_0.do[4] * bp.if, g_0.do[4]);
        }
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }
}

