/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from Q
 */
public final class q_0
extends ao_0 {
    private static int[] if;
    public short do;

    public final void do(Graphics graphics, int n, int n2, int n3) {
        Object object = (da)ac_0.do(this.int);
        if (q_0.do(((ao_0)this).if, ((da)object).do[if[0]])) {
            object = ac_0.do[((da)object).do[if[0]]];
            graphics.drawRegion(ac_0.do((int)this.do).do, ((m_0)object).new * dH.this, ((m_0)object).do * dH.this, ((m_0)object).try * dH.this, ((m_0)object).for * dH.this, if[0], n, n2, n3);
            return;
        }
        ((ao_0)object).if(graphics, n, n2, n3);
    }

    private static void do() {
        if = new int[2];
        q_0.if[0] = (129 + 103 - 176 + 105 ^ 57 + 69 - 49 + 62) & (121 + 36 - 73 + 96 ^ 60 + 41 - 73 + 130 ^ -" ".length());
        q_0.if[1] = " ".length();
    }

    public final void do(Graphics graphics, int n, int n2, int n3, int n4) {
        int n5;
        da da2 = (da)ac_0.do(this.int);
        m_0 m_02 = ac_0.do[da2.do[n]];
        short s2 = m_02.new;
        short s3 = m_02.do;
        short s4 = m_02.try;
        short s5 = m_02.for;
        int n6 = n2 + da2.if[n] * dH.this;
        if (q_0.do(n4, dF.case)) {
            n5 = (da2.if[n] * dH.this << if[1]) + m_02.try * dH.this;
            "".length();
            if (((0x5C ^ 2 ^ (0x91 ^ 0x8B)) & (4 ^ 0x5B ^ (0xA6 ^ 0xBD) ^ -" ".length())) >= "  ".length()) {
                return;
            }
        } else {
            n5 = if[0];
        }
        ac_0.do(graphics, this.do, s2, s3, s4, s5, n6 - n5, n3 + da2.do[n] * dH.this, n4);
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    static {
        q_0.do();
    }
}

