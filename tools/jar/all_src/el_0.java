/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import java.util.Vector;
import javax.microedition.lcdui.Graphics;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from eL
 */
public final class el_0
extends ep {
    private int int;
    private Vector do;
    private static int[] do;
    public int do;
    private static el_0 do;
    private int new;
    private Vector if;
    private byte do = do[1];
    private Vector for;
    public int if;
    public int for;

    private static boolean do(int n) {
        return n != 0;
    }

    public final void do(int n) {
        switch (n) {
            case 0: {
                el_0.for();
                return;
            }
            case 1: {
                el_0.for();
            }
        }
    }

    public final void do(Graphics graphics) {
        bx.do.do(graphics);
        bx.do.if(graphics);
        bx.if(graphics);
        w.do().do(graphics);
        graphics.translate(w.do().byte, w.do().int);
        bx.do.do(graphics, this.do, (int)this.do, this.for, this.if);
        super.do(graphics);
    }

    /*
     * Unable to fully structure code
     */
    private void if() {
        var1_1 = el_0.do[1];
        "".length();
        if ("   ".length() != 0) ** GOTO lbl15
        return;
lbl-1000:
        // 1 sources

        {
            var2_2 = (cj)AngelChip.do.int.elementAt(var1_1);
            var3_3 = (da)ac_0.do(var2_2.do);
            if (el_0.if(var3_3.do, el_0.do[7]) && el_0.do(this.for.size()) && el_0.do(this.int, this.for.size())) {
                var2_2.do = ((da)this.for.elementAt((int)this.int)).for;
            }
            if (el_0.if(var3_3.do, el_0.do[8]) && el_0.do(this.do.size()) && el_0.do(this.int, this.do.size())) {
                var2_2.do = ((da)this.do.elementAt((int)this.int)).for;
            }
            if (el_0.if(var3_3.do, el_0.do[9]) && el_0.do(this.if.size()) && el_0.do(this.int, this.if.size())) {
                var2_2.do = ((da)this.if.elementAt((int)this.int)).for;
            }
            ++var1_1;
lbl15:
            // 2 sources

            ** while (!el_0.for((int)var1_1, (int)AngelChip.do.int.size()))
        }
lbl16:
        // 1 sources

        AngelChip.do.for();
    }

    public el_0() {
        this.new = do[1];
    }

    public final void for(int n) {
        this.do = n;
        if (el_0.int(this.do)) {
            this.do = do[0];
        }
        if (el_0.int(this.do, do[0])) {
            this.do = do[1];
        }
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    public final void byte() {
        if (el_0.if(this.for)) {
            this.for -= do[0];
        }
        if (el_0.if(this.if)) {
            this.if -= do[0];
        }
        this.new += do[0];
        if (el_0.int(this.new, do[7])) {
            this.new = do[1];
            int n = hi.do.nextInt(do[10]);
            if (el_0.new(((dF)AngelChip.do).byte, do[9])) {
                if (el_0.for(n)) {
                    AngelChip.do.if(do[0]);
                    "".length();
                    if ("  ".length() >= (0x70 ^ 0x74)) {
                        return;
                    }
                } else {
                    AngelChip.do.if(do[1]);
                }
            }
        }
        AngelChip.do.if();
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private static void for() {
        bx.case = do[0];
        bx.for(String.valueOf(bT.M) + "...");
        fv_0.do().do();
    }

    private static boolean for(int n) {
        return n == 0;
    }

    private static boolean int(int n) {
        return n < 0;
    }

    public static void if(boolean bl) {
        bx.case();
        if (el_0.do(bl ? 1 : 0)) {
            gs_0.do().throw();
            return;
        }
        bx.int(bT.ar);
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    public final void try() {
        int n;
        ((dF)AngelChip.do).int = (byte)do[1];
        AngelChip.do.int = new Vector();
        this.case();
        ((dH)this).new = new fn_0(bT.cn, do[1]);
        cj cj2 = new cj();
        int n2 = hi.do.nextInt(this.if.size());
        cj2.do = ((ao_0)((da)this.if.elementAt((int)n2))).for;
        AngelChip.do.do(cj2);
        cj2 = new cj();
        n2 = hi.do.nextInt(this.do.size());
        cj2.do = ((ao_0)((da)this.do.elementAt((int)n2))).for;
        AngelChip.do.do(cj2);
        cj2 = new cj();
        new cj().do = (short)do[2];
        AngelChip.do.do(cj2);
        cj2 = new cj();
        n2 = hi.do.nextInt(this.for.size());
        cj2.do = ((ao_0)((da)this.for.elementAt((int)n2))).for;
        AngelChip.do.do(cj2);
        AngelChip.do.do(new cj(do[1]));
        AngelChip.do.for();
        w w2 = w.do();
        int n3 = do[3] * dH.this;
        int n4 = do[4];
        if (el_0.if(dH.this, do[5])) {
            n = do[6];
            "".length();
            if ((0x95 ^ 0x91) == " ".length()) {
                return;
            }
        } else {
            n = do[1];
        }
        w2.do(bT.M, n3, n4 + n, do[0]);
        super.try();
    }

    /*
     * Enabled aggressive block sorting
     */
    private void case() {
        AngelChip.do.else = this.do;
        if (el_0.do(this.for)) {
            this.for.removeAllElements();
            this.do.removeAllElements();
            this.if.removeAllElements();
        }
        this.for = new Vector();
        this.do = new Vector();
        this.if = new Vector();
        int n = do[1];
        "".length();
        while (!el_0.for(n, ac_0.do.length)) {
            da da2;
            if (el_0.do(ac_0.do[n] instanceof da) && el_0.do(da2 = (da)ac_0.do[n]) && (!el_0.new(da2.int, this.do) || el_0.for(da2.int)) && el_0.for(da2.for)) {
                if (el_0.if(((ao_0)da2).do, do[7])) {
                    this.for.addElement(da2);
                    "".length();
                    if (-"  ".length() > 0) {
                        return;
                    }
                } else if (el_0.if(((ao_0)da2).do, do[8])) {
                    this.do.addElement(da2);
                    "".length();
                    if ((0x10 ^ 0x14) == " ".length()) {
                        return;
                    }
                } else if (el_0.if(((ao_0)da2).do, do[9])) {
                    this.if.addElement(da2);
                }
            }
            ++n;
        }
        this.int = do[1];
        this.if();
        if (el_0.new(((dF)AngelChip.do).byte, do[9])) {
            AngelChip.do.if(do[0]);
        }
        AngelChip.do.for();
    }

    public final void if(int n, int n2) {
        switch (n) {
            case 0: {
                Vector<fn_0> vector = new Vector<fn_0>();
                vector.addElement(new fn_0(bT.t, do[1], this));
                vector.addElement(new fn_0(bT.cW, do[0], this));
                bx.do(bT.aa, vector);
            }
        }
    }

    public final void new() {
        bx.do.byte();
        super.new();
    }

    public static el_0 do() {
        if (el_0.if(do)) {
            do = new el_0();
        }
        return do;
    }

    public final void int(int n) {
        this.int += n;
        if (el_0.int(this.int)) {
            this.int = do[0];
        }
        if (el_0.int(this.int, do[0])) {
            this.int = do[1];
        }
        if (el_0.for(this.do)) {
            if (el_0.if(this.do, do[0])) {
                this.do = (byte)do[5];
                "".length();
                if ("  ".length() < 0) {
                    return;
                }
            } else {
                this.do = (byte)do[0];
            }
            this.case();
            return;
        }
        this.if();
    }

    private static boolean do(Object object) {
        return object != null;
    }

    static {
        el_0.char();
    }

    private static boolean for(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(Object object) {
        return object == null;
    }

    private static boolean int(int n, int n2) {
        return n > n2;
    }

    private static void char() {
        do = new int[11];
        el_0.do[0] = " ".length();
        el_0.do[1] = (0xE1 ^ 0xAE) & ~(0xEF ^ 0xA0);
        el_0.do[2] = 0x29 ^ 0x2D;
        el_0.do[3] = (0xFA ^ 0x96) + (78 + 28 - -39 + 1) - (93 + 56 - 99 + 124) + (0x58 ^ 0x1E);
        el_0.do[4] = (0xF6 ^ 0xA6) + (0x8D ^ 0xC6) - -(0xBD ^ 0xB2) + ((0x45 ^ 5) & ~(0x49 ^ 9));
        el_0.do[5] = "  ".length();
        el_0.do[6] = 0x4F ^ 0x37;
        el_0.do[7] = 0x64 ^ 0x56;
        el_0.do[8] = 0xE ^ 0x1A;
        el_0.do[9] = 0x1D ^ 0x6D ^ (0xFD ^ 0x87);
        el_0.do[10] = "   ".length();
    }

    private static boolean new(int n, int n2) {
        return n != n2;
    }
}

