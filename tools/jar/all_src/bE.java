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
public final class bE
extends ff_0 {
    public boolean do;
    public short do;
    public short if;
    public byte do = do[0];
    private static int[] do;

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    public bE(int n, int n2, int n3, int n4, short s2) {
        this.char = (byte)n;
        this.int = n2;
        this.for = n3;
        this.if = (short)n4;
        this.do = s2;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    public final void do(Graphics object) {
        gw_0 gw_02;
        if (bE.do(this.do ? 1 : 0)) {
            gw_02 = fj.do(this.do);
            "".length();
            if (null != null) {
                return;
            }
        } else {
            gw_02 = ac_0.do((int)this.do);
        }
        if (bE.if(this.do ? 1 : 0) && bE.do(fj.new, do[1]) && bE.do(fj.new, do[2]) && bE.do(fj.new, do[3]) && bE.do(fj.new, do[4])) {
            m_0 m_02 = ac_0.do[gw_02.do];
            if (!bE.if((this.int + gw_02.int + m_02.try) * bp.if, fq.do().if) || !bE.for((this.int + gw_02.int - m_02.try) * bp.if, fq.do().if + bx.char) || !bE.if((this.for + m_02.for) * bp.if, fq.do().for) || bE.int((this.for + gw_02.try - m_02.for) * bp.if, fq.do().for + bx.new)) {
                return;
            }
            byte by2 = this.do;
            int n = (this.for + gw_02.try) * bp.if;
            int n2 = (this.int + gw_02.int) * bp.if;
            gw_02 = object;
            object = m_02;
            gw_02.drawRegion(ac_0.do((int)object.int).do, object.new * dH.this, object.do * dH.this, object.try * dH.this, object.for * dH.this, by2, n2, n, do[0]);
            return;
        }
        int n = (this.for + gw_02.try) * bp.if;
        int n3 = (this.int + gw_02.int) * bp.if;
        short s2 = gw_02.do;
        gw_02 = object;
        object = this;
        e e2 = ac_0.if(s2);
        if (!bE.if(n3 + e2.if, fq.do().if) || !bE.for(n3, fq.do().if + bx.char) || !bE.if(n + e2.do, fq.do().for) || bE.int(n, fq.do().for + bx.new)) {
            return;
        }
        if (bE.do(e2.do, do[5])) {
            gw_02.drawRegion(e2.do, do[0], do[0], e2.if, e2.do, object.do, n3, n, do[0]);
        }
    }

    private static boolean for(int n, int n2) {
        return n <= n2;
    }

    static {
        bE.if();
    }

    private static void if() {
        do = new int[6];
        bE.do[0] = (76 + 41 - 116 + 148 ^ 124 + 21 - 88 + 84) & (0x83 ^ 0xB9 ^ (0x61 ^ 0x43) ^ -" ".length());
        bE.do[1] = 0x7C ^ 0x38;
        bE.do[2] = 0x72 ^ 0x38 ^ (0x63 ^ 0x6C);
        bE.do[3] = 0x72 ^ 0x34;
        bE.do[4] = 0x18 ^ 0x76;
        bE.do[5] = -" ".length();
    }

    public bE() {
    }

    private static boolean do(int n) {
        return n != 0;
    }

    public final void do() {
    }

    private static boolean int(int n, int n2) {
        return n > n2;
    }

    private static boolean if(int n) {
        return n == 0;
    }
}

