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
public final class da
extends ao_0 {
    public byte[] do;
    public short[] do;
    private static int[] if;
    public byte[] if;
    public byte for;
    public byte int;

    private static void do() {
        if = new int[4];
        da.if[0] = -" ".length();
        da.if[1] = -(0xFFFFBFDF & 0x6028) & (0xFFFFEFF7 & 0x37DF);
        da.if[2] = (110 + 108 - 107 + 56 ^ 85 + 41 - 28 + 50) & (0xF9 ^ 0xAF ^ (0xD5 ^ 0xB0) ^ -" ".length());
        da.if[3] = " ".length();
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    public final void do(Graphics graphics, int n, int n2, int n3, int n4) {
        if (da.if(((ao_0)this).for, if[0])) {
            if (da.for(((ao_0)this).for, if[1])) {
                e e2 = ac_0.do(this.do[n]);
                if (da.if(e2.do, if[0])) {
                    int n5;
                    Image image = e2.do;
                    int n6 = if[2];
                    int n7 = if[2];
                    short s2 = e2.if;
                    short s3 = e2.do;
                    int n8 = n2 + this.if[n] * dH.this;
                    if (da.do(n4, dF.case)) {
                        n5 = (this.if[n] * dH.this << if[3]) + e2.if;
                        "".length();
                        if (((47 + 62 - 22 + 92 ^ 153 + 82 - 62 + 7) & (0x62 ^ 0x7B ^ (0x88 ^ 0x96) ^ -" ".length())) != ((0x6D ^ 0x79 ^ (0xCF ^ 0xBA)) & (0x7E ^ 6 ^ (6 ^ 0x1F) ^ -" ".length()))) {
                            return;
                        }
                    } else {
                        n5 = if[2];
                    }
                    graphics.drawRegion(image, n6, n7, (int)s2, (int)s3, n4, n8 - n5, n3 + this.do[n] * dH.this, if[2]);
                    return;
                }
            } else {
                int n9;
                m_0 m_02 = ac_0.do[this.do[n]];
                short s4 = m_02.int;
                short s5 = m_02.new;
                short s6 = m_02.do;
                short s7 = m_02.try;
                short s8 = m_02.for;
                int n10 = n2 + this.if[n] * dH.this;
                if (da.do(n4, dF.case)) {
                    n9 = (this.if[n] * dH.this << if[3]) + m_02.try * dH.this;
                    "".length();
                    if (null != null) {
                        return;
                    }
                } else {
                    n9 = if[2];
                }
                ac_0.do(graphics, s4, s5, s6, s7, s8, n10 - n9, n3 + this.do[n] * dH.this, n4);
            }
        }
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    static {
        da.do();
    }

    private static boolean for(int n, int n2) {
        return n >= n2;
    }
}

