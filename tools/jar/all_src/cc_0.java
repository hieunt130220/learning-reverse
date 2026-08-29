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
 * Renamed from cc
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class cc_0
extends dL {
    fc do;
    private dh_0 do;
    private int do;
    private Image do;
    private static final int[] do;
    private int if;
    private String[] do = new fc();

    static {
        cc_0.for();
    }

    public final void do(String string, int n, int n2) {
        this.do(string, n2);
        this.new = new fn_0(bT.bq, n);
        bx.do = this;
        this.do.do(do[4]);
    }

    private void do(String string, int n) {
        this.do = null;
        this.do = bx.char - do[5];
        this.if = do[6] * dH.this;
        if (cc_0.do(bx.byte.do(string) + do[7], this.do)) {
            this.do = bx.byte.do(string) + do[7];
        }
        if (cc_0.do(this.do, bx.char / do[1])) {
            this.do = bx.char / do[1];
        }
        this.do = bx.byte.do(string, this.do - do[7]);
        this.do = new fc();
        this.do.if = do[0];
        this.do.case = this.do - do[8];
        this.if();
        this.do.do("");
        this.do.if(n);
        this.try = new fn_0(bT.finally, do[9]);
        bx.do = this;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    public final String do() {
        return this.do.do();
    }

    public final void if() {
        this.do.long = bx.long - this.do.case / do[1];
        this.do.goto = bx.new - (bx.new - bx.do[cc_0.do[0]].for + do[2]) - this.do.for - do[3];
    }

    public final void do(String string, dh_0 dh_02, int n) {
        this.do(string, n);
        this.do = dh_02;
        this.new = new fn_0(bT.bq, this.do);
        bx.do = this;
    }

    public final void do(Image image) {
        this.do = image;
        this.if += image.getHeight();
        this.if();
    }

    public final void if(int n) {
        this.do.do(n);
        "".length();
    }

    private static void for() {
        do = new int[11];
        cc_0.do[0] = (0x7A ^ 0x69) & ~(0x22 ^ 0x31);
        cc_0.do[1] = "  ".length();
        cc_0.do[2] = 0x7A ^ 0x6B ^ (0x78 ^ 0x6C);
        cc_0.do[3] = 0xE1 ^ 0x8C ^ (0x18 ^ 0x7D);
        cc_0.do[4] = " ".length();
        cc_0.do[5] = 0x37 ^ 0x1F;
        cc_0.do[6] = 0xE6 ^ 0xA0;
        cc_0.do[7] = 0x74 ^ 0x60;
        cc_0.do[8] = 77 + 34 - 2 + 20 ^ 113 + 29 - 76 + 73;
        cc_0.do[9] = 0xF8 ^ 0x80;
        cc_0.do[10] = "   ".length();
    }

    public final void do(String string) {
        this.do.do(string);
    }

    public final void if(int n, int n2) {
        switch (n) {
            case 120: {
                bx.do = null;
                return;
            }
        }
        bx.do.if(n, n2);
    }

    public final void new() {
        this.do.do();
        if (cc_0.do(this.do.do() ? 1 : 0)) {
            this.int = this.do.do();
        }
        if (cc_0.do(aO.do ? 1 : 0) && cc_0.do(bx.int)) {
            bx.do.do(this.try, this.new, this.int);
            return;
        }
        super.new();
    }

    public cc_0() {
        this.do.if = do[0];
    }

    public final void do(Graphics graphics) {
        bx.if(graphics);
        bx.do.if(graphics, bx.long - this.do / do[1], bx.new - this.if - (bx.new - bx.do[cc_0.do[0]].for + do[2]), this.do, this.if, do[0]);
        int n = bx.new - this.if - (bx.new - bx.do[cc_0.do[0]].for + do[2]) + (this.if - this.do.for - do[3]) / do[1] - (this.do.length >> do[4]) * dH.new - dH.new / do[1];
        if (cc_0.do(this.do)) {
            graphics.drawImage(this.do, bx.long, this.do.goto - this.do.getHeight() / do[1] - do[2] * dH.this, do[10]);
            n -= this.do.getHeight() / do[1];
        }
        int n2 = do[0];
        while (cc_0.do(n2, this.do.length)) {
            bx.byte.do(graphics, this.do[n2], bx.long, n, do[1]);
            ++n2;
            n += dH.new;
            "".length();
            if (null == null) continue;
            return;
        }
        this.do.do(graphics);
        if (cc_0.do(aO.do ? 1 : 0)) {
            bx.if(graphics);
            bx.do.if(graphics);
            bx.do.do(graphics, this.try, this.new, this.int);
            return;
        }
        super.do(graphics);
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }
}

