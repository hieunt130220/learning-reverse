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
public final class cV
extends dH {
    public static cV do;
    public fc do;
    public static boolean do;
    public gn do;
    private long do;
    private static final int[] do;

    public final void do(Graphics graphics) {
        if (cV.if(aO.do ? 1 : 0)) {
            aO.do(graphics, this.try, this.new, this.int);
            "".length();
            if (((0x1F ^ 0x32 ^ (0xC6 ^ 0xB2)) & (0xBB ^ 0xB3 ^ (0x15 ^ 0x44) ^ -" ".length())) <= -" ".length()) {
                return;
            }
        } else {
            super.do(graphics);
        }
        this.do.do(graphics);
    }

    static {
        cV.int();
        do = do[0];
    }

    protected cV() {
        this.try = new fn_0(bT.finally, do[0]);
        this.new = new fn_0(bT.dj, do[1]);
        this.do = new fc();
        this.do.if = do[0];
        this.do.do(do[1]);
        this.if();
        this.do.long = (bx.char - this.do.case) / do[3];
        this.do.int();
        this.int = this.do.do();
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(Object object) {
        return object == null;
    }

    public final void if() {
        this.do.goto = bx.goto - bx.if - this.do.for - do[4];
        if (cV.if(aO.do ? 1 : 0)) {
            this.do.goto -= do[3] * dH.this;
        }
        this.do.case = bx.char - do[5];
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static void int() {
        do = new int[6];
        cV.do[0] = (0xDD ^ 0x8B ^ (0x1B ^ 0x10)) & (0x18 ^ 0x39 ^ (0xBB ^ 0xC7) ^ -" ".length());
        cV.do[1] = " ".length();
        cV.do[2] = 0xDF ^ 0x8D ^ (0x38 ^ 0x6E);
        cV.do[3] = "  ".length();
        cV.do[4] = 0x30 ^ 0x35;
        cV.do[5] = 0x61 ^ 0x77 ^ (0x60 ^ 0x7C);
    }

    public final void for(int n) {
        if (cV.if(do ? 1 : 0)) {
            this.do.do(n);
            "".length();
        }
    }

    public final void for() {
        this.do.do("");
        do = do[0];
        this.do.do(do[1]);
        if (cV.if(aO.do ? 1 : 0) && cV.if(gC.do ? 1 : 0)) {
            gC.do = do[0];
            gC.do().do[cV.do[2]] = do[0];
            bx.do.for();
        }
    }

    public final void do(int n, gn gn2) {
        if (cV.do(bx.do)) {
            this.do.do(n);
            "".length();
            if (cV.for(this.do.do().equals("") ? 1 : 0)) {
                this.do = gn2;
                do = do[1];
            }
            this.if();
        }
    }

    public final void new() {
        this.do.do();
        if (!cV.if(ad.do, do[1]) || cV.do(ad.do, do[3])) {
            this.do.do(ad.do(this.do.do()));
        }
        if (cV.if(aO.do ? 1 : 0) && cV.if(bx.int)) {
            bx.do.do(this.try, this.new, this.int);
            return;
        }
        super.new();
    }

    public final void if(int n, int n2) {
        switch (n) {
            case 0: {
                this.do.do("");
                do = do[0];
                this.do.do(do[1]);
                return;
            }
            case 1: {
                long l = System.currentTimeMillis();
                if (cV.do(cV.do(l - this.do, 2000L))) {
                    return;
                }
                if (!cV.if(this.do)) break;
                this.do.for(this.do.do());
                this.do.do("");
                do = do[0];
                this.do.do(do[1]);
                this.do = l;
            }
        }
    }

    private static boolean do(int n) {
        return n < 0;
    }

    private static boolean if(Object object) {
        return object != null;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    public static cV do() {
        if (cV.do(do)) {
            do = new cV();
            return do;
        }
        return do;
    }

    private static boolean for(int n) {
        return n == 0;
    }
}

