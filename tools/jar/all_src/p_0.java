/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from p
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class p_0
extends dF {
    private byte char;
    public short do;
    public byte do;
    private static int[] do;
    public short if;
    public short for;
    public int do;

    private static boolean do(Object object) {
        return object != null;
    }

    private void if() {
        switch (this.do) {
            case 0: {
                fj.if.removeElement(this);
                "".length();
                return;
            }
            case 1: {
                fj.char.removeElement(this);
                "".length();
                return;
            }
            case 2: {
                fj.try.removeElement(this);
                "".length();
                return;
            }
            case 3: {
                fj.new.removeElement(this);
                "".length();
            }
        }
    }

    static {
        p_0.for();
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    public final void do() {
        block3: {
            block2: {
                ho ho2 = ac_0.do(this.for);
                if (!p_0.do(ho2)) break block2;
                this.char = (byte)(this.char + do[2]);
                if (!p_0.for(this.char, ho2.do.length)) break block3;
            }
            this.if();
        }
    }

    private static boolean do(int n) {
        return n > 0;
    }

    public final void do(Graphics graphics) {
        if (p_0.do(bx.int) && p_0.do(bx.do, fh_0.do())) {
            return;
        }
        ho ho2 = ac_0.do(this.for);
        if (p_0.do(ho2)) {
            if (p_0.if(this.do)) {
                eh eh2 = fj.do(this.do);
                if (p_0.do(eh2)) {
                    ((bp)this).int = ((bp)eh2).int + this.do;
                    ((bp)this).for = ((bp)eh2).for + this.if;
                    "".length();
                    if (null != null) {
                        return;
                    }
                } else {
                    this.if();
                    return;
                }
            }
            ho2.do(graphics, ((bp)this).int, ((bp)this).for, this.char);
        }
    }

    private static void for() {
        do = new int[3];
        p_0.do[0] = (0x17 ^ 0x1B) & ~(0x68 ^ 0x64);
        p_0.do[1] = 0xFB ^ 0xB4 ^ (0x75 ^ 0x3C);
        p_0.do[2] = " ".length();
    }

    private static boolean for(int n, int n2) {
        return n >= n2;
    }

    public p_0() {
        int n = do[0];
        this.if = (short)n;
        this.do = (short)n;
        ((bp)this).if = (byte)do[1];
        this.char = (byte)do[0];
    }

    private static boolean if(int n) {
        return n == 0;
    }
}

