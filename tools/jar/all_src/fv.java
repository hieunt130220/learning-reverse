/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import java.util.Vector;
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class fv
extends bU {
    private static int if;
    private static int for;
    private byte do;
    public int do;
    private Vector do;
    private static cx_0 do;
    private static int[] do;
    private int int;
    private static cx_0 if;
    private int new;
    private static int try;

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public final void do() {
        super.do();
    }

    private static boolean do(Object object) {
        return object == null;
    }

    private static void int() {
        do = new int[18];
        fv.do[0] = (0x99 ^ 0x89) & ~(0x91 ^ 0x81) ^ (0x51 ^ 0x54);
        fv.do[1] = " ".length();
        fv.do[2] = -" ".length();
        fv.do[3] = "  ".length() & ~"  ".length();
        fv.do[4] = 87 + 100 - 62 + 41 ^ 16 + 160 - 89 + 85;
        fv.do[5] = -(0x9C ^ 0x9A) & (0xFFFF9BFF & 0x67ED);
        fv.do[6] = 0x90 ^ 0xA2;
        fv.do[7] = 0x2A ^ 0x34;
        fv.do[8] = 0x5A ^ 0x39 ^ (0xB7 ^ 0xC4);
        fv.do[9] = "  ".length();
        fv.do[10] = "   ".length();
        fv.do[11] = 0x70 ^ 0x12 ^ (0x79 ^ 0x1F);
        fv.do[12] = 0x41 ^ 0x38 ^ (0x69 ^ 4);
        fv.do[13] = 0xFFFFFDFD & 0xDDDFDF;
        fv.do[14] = 0xB8 ^ 0xC0;
        fv.do[15] = 7 ^ 0x4D ^ (0x6E ^ 0x22);
        fv.do[16] = 0x64 ^ 0x6E ^ (0xB7 ^ 0xB2);
        fv.do[17] = 4 ^ 0x7A ^ (0x9D ^ 0x87);
    }

    private static boolean if(Object object) {
        return object != null;
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    /*
     * Enabled aggressive block sorting
     */
    public final void if() {
        int n = do[1];
        if (fv.new(bx.break % do[15], do[10])) {
            n = hi.for(do[16]);
        }
        if (fv.for(n) && fv.new(for, do[0])) {
            for = do[0] + hi.for(do[12]);
            try = do[6] + hi.for(do[17]);
        }
        if (fv.do(try)) {
            try -= do[1];
        }
        if (fv.for(try) && fv.if(for, do[0]) && fv.new(bx.break % do[11], do[9])) {
            for -= do[1];
        }
        switch (this.do) {
            case 0: {
                fv fv2 = this;
                int n2 = do[3];
                "".length();
                if ("   ".length() < 0) {
                    return;
                }
                while (true) {
                    int n3;
                    if (fv.int(n2, fv2.int)) {
                        return;
                    }
                    gd_0 gd_02 = (gd_0)fv2.do.elementAt(n2);
                    ((bp)gd_02).for += (gd_02.case + do[1]) * do[16] + (do[10] - gd_02.case) * do[10];
                    gd_02.char += do[1];
                    ((bp)gd_02).int += gd_02.case + do[1] << do[9];
                    if (fv.if(((bp)gd_02).for / do[4], fq.do().for + bx.new - (do[11] - gd_02.case) * do[6])) {
                        fv2.do(gd_02);
                    }
                    if (fv.do(((bp)gd_02).int / do[4] + (n3 = fq.do().if * ((do[9] - gd_02.case) * do[12]) / do[14]), fq.do().if - do[4])) {
                        ((bp)gd_02).int += (bx.char + do[12]) * do[4];
                    }
                    if (fv.if(((bp)gd_02).int / do[4] + n3, fq.do().if + bx.char + do[4])) {
                        ((bp)gd_02).int -= (bx.char + do[12]) * do[4];
                    }
                    ++n2;
                }
            }
            case 1: {
                fv fv3 = this;
                int n4 = do[3];
                "".length();
                if ("   ".length() < 0) {
                    return;
                }
                while (true) {
                    if (fv.int(n4, fv3.int)) {
                        return;
                    }
                    gd_0 gd_03 = (gd_0)fv3.do.elementAt(n4);
                    ((bp)gd_03).for += do[4];
                    ((bp)gd_03).int += gd_03.try * do[4] + for * if;
                    gd_03.new += do[1];
                    if (fv.int(gd_03.new, gd_03.byte)) {
                        gd_03.new = do[3];
                    }
                    if (fv.if(((bp)gd_03).for / do[4], fj.do * fj.char - (do[11] - gd_03.case) * do[12])) {
                        fv3.do(gd_03);
                    }
                    ++n4;
                }
            }
            case 2: {
                int n5;
                fv fv4 = this;
                if (fv.do(fv.do(System.currentTimeMillis() / 1000L - (long)fv4.new, (long)fv4.do))) {
                    fv4.do += do[1];
                    n5 = do[3];
                    "".length();
                    while (!fv.int(n5, do[0])) {
                        fv4.do.removeElementAt(do[3]);
                        fv4.int = fv4.do.size();
                        if (fv.for(fv4.int)) {
                            super.do();
                            return;
                        }
                        ++n5;
                    }
                }
                n5 = do[3];
                "".length();
                while (true) {
                    if (fv.int(n5, fv4.int)) {
                        return;
                    }
                    gd_0 gd_04 = (gd_0)fv4.do.elementAt(n5);
                    ((bp)gd_04).for += (gd_04.case + do[9]) * do[0];
                    ((bp)gd_04).int += (gd_04.case + do[1] << do[1]) + for * if;
                    if (fv.if(((bp)gd_04).for / do[4], fj.do * fj.char - (do[11] - gd_04.case) * do[12])) {
                        fv4.do(gd_04);
                    }
                    ++n5;
                }
            }
            case 3: {
                fv fv5 = this;
                int n6 = do[3];
                "".length();
                if ("  ".length() < ((0x73 ^ 0x53) & ~(5 ^ 0x25))) {
                    return;
                }
                while (!fv.int(n6, fv5.int)) {
                    gd_0 gd_05 = (gd_0)fv5.do.elementAt(n6);
                    ((bp)gd_05).for += (gd_05.case + do[11]) * do[10];
                    ((bp)gd_05).int += (gd_05.case + do[1] << do[1]) + for * if;
                    if (fv.if(((bp)gd_05).for / do[4], fj.do * fj.char - (do[11] - gd_05.case) * do[12])) {
                        fv5.do(gd_05);
                    }
                    ++n6;
                }
                return;
            }
        }
    }

    private static boolean do(int n) {
        return n > 0;
    }

    static {
        fv.int();
        for = do[0];
        if = hi.if(do[1], do[2]);
    }

    /*
     * Enabled aggressive block sorting
     */
    public final void do(Graphics object) {
        bx.if(object);
        object.translate(-fq.do().if, -fq.do().for);
        switch (this.do) {
            case 0: {
                Object object2 = object;
                fv fv2 = this;
                object2.setColor(do[13]);
                int n = do[3];
                "".length();
                if ("   ".length() >= (0xA9 ^ 0xAD)) {
                    return;
                }
                while (true) {
                    if (fv.int(n, fv2.int)) {
                        return;
                    }
                    gd_0 gd_02 = (gd_0)fv2.do.elementAt(n);
                    int n2 = fq.do().if * ((do[9] - gd_02.case) * do[12]) / do[14];
                    object2.fillRect(n2 + ((bp)gd_02).int / do[4], ((bp)gd_02).for / do[4], do[1], gd_02.case + do[1]);
                    ++n;
                }
            }
            case 1: {
                Object object3 = object;
                fv fv3 = this;
                int n = do[3];
                "".length();
                while (true) {
                    if (fv.int(n, fv3.int)) {
                        return;
                    }
                    gd_0 gd_03 = (gd_0)fv3.do.elementAt(n);
                    if (fv.if(((bp)gd_03).int * dH.this / do[4], fq.do().if) && fv.do(((bp)gd_03).int * dH.this / do[4], fq.do().if + bx.char) && fv.if(((bp)gd_03).for * dH.this / do[4], fq.do().for)) {
                        do.do(gd_03.new / (gd_03.byte / do[11]), ((bp)gd_03).int * dH.this / do[4], ((bp)gd_03).for * dH.this / do[4], do[3], do[10], (Graphics)object3);
                    }
                    ++n;
                }
            }
            case 2: {
                if (fv.new(((bU)this).do, do[2])) {
                    return;
                }
                ho ho2 = ac_0.do(((bU)this).do);
                int n = do[3];
                "".length();
                while (true) {
                    if (fv.int(n, this.int)) {
                        return;
                    }
                    gd_0 gd_04 = (gd_0)this.do.elementAt(n);
                    gd_04.do += do[1];
                    if (fv.if(((bp)gd_04).int * dH.this / do[4], fq.do().if) && fv.do(((bp)gd_04).int * dH.this / do[4], fq.do().if + bx.char) && fv.if(((bp)gd_04).for * dH.this / do[4], fq.do().for) && fv.do(((bp)gd_04).for * dH.this / do[4], fq.do().for + bx.goto)) {
                        if (fv.if(ho2)) {
                            if (fv.int(gd_04.do, ho2.do.length)) {
                                gd_04.do = do[3];
                            }
                            ho2.do((Graphics)object, ((bp)gd_04).int / do[4], ((bp)gd_04).for / do[4], gd_04.do);
                        }
                        gd_04.do = (byte)(gd_04.do + do[1]);
                        if (fv.int(gd_04.do, do[12])) {
                            gd_04.do = (byte)do[3];
                        }
                    }
                    ++n;
                }
            }
            case 3: {
                int n = do[3];
                "".length();
                while (!fv.int(n, this.int)) {
                    gd_0 gd_05 = (gd_0)this.do.elementAt(n);
                    if (fv.if(((bp)gd_05).int * dH.this / do[4], fq.do().if) && fv.do(((bp)gd_05).int * dH.this / do[4], fq.do().if + bx.char) && fv.if(((bp)gd_05).for * dH.this / do[4], fq.do().for)) {
                        if.if(do[9] - gd_05.case, ((bp)gd_05).int * dH.this / do[4], ((bp)gd_05).for * dH.this / do[4], do[3], (Graphics)object);
                    }
                    ++n;
                }
                return;
            }
        }
    }

    private static boolean if(int n, int n2) {
        return n > n2;
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    private static boolean int(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static boolean for(int n) {
        return n == 0;
    }

    private void do(gd_0 gd_02) {
        if (fv.if(((bU)this).do ? 1 : 0)) {
            this.do.removeElement(gd_02);
            "".length();
            this.int = this.do.size();
            if (fv.for(this.do.size())) {
                super.do();
                return;
            }
        } else {
            ((bp)gd_02).for = (fq.do().for - bx.else + hi.for(bx.new << do[1])) * do[4];
            ((bp)gd_02).int = (-bx.char / do[9] + hi.for(fj.if * fj.char + bx.char)) * do[4];
        }
    }

    private static boolean new(int n, int n2) {
        return n == n2;
    }

    /*
     * Unable to fully structure code
     */
    public fv(int var1_1, int var2_2) {
        block13: {
            super();
            this.do = (byte)fv.do[3];
            this.int = fv.do[3];
            this.do = new Vector<E>();
            this.do = (byte)var1_1;
            this.int = var2_2 * fv.do[4];
            if (fv.new(dH.this, fv.do[1])) {
                this.int = var2_2 * fv.do[0];
            }
            this.new = (int)(System.currentTimeMillis() / 1000L);
            switch (var1_1) {
                case 0: {
                    this.int = bx.char * bx.new / fv.do[5] + fv.do[6];
                    "".length();
                    if ("   ".length() != ((80 ^ 0 ^ (48 ^ 35)) & (205 ^ 186 ^ (127 ^ 75) ^ -" ".length()))) break;
                    throw null;
                }
                case 1: {
                    this.int = fv.do[7];
                    if (!fv.do(fv.do)) break;
                    f_0.do(bT.dm);
                    fv.do = cx_0.do("cobay", fv.do[8] * dH.this, fv.do[4] * dH.this);
                    f_0.do();
                    "".length();
                    if ((95 ^ 91) > 0) break;
                    throw null;
                }
                case 3: {
                    this.int = bx.char * bx.new / fv.do[5];
                    f_0.do(bT.dm);
                    cx_0.do("tuyet", fv.do[0] * dH.this, fv.do[0] * dH.this);
                    "".length();
                    f_0.do();
                    fv.if = fv.do;
                }
            }
            var2_2 = fv.do[3];
            "".length();
            if ("  ".length() == "  ".length()) ** GOTO lbl57
            throw null;
lbl-1000:
            // 1 sources

            {
                var3_3 = new gd_0(fv.do[3], (fq.do().for - (bx.new << fv.do[1]) + hi.for(bx.new << fv.do[1])) * fv.do[4]);
                new gd_0(fv.do[3], (fq.do().for - (bx.new << fv.do[1]) + hi.for(bx.new << fv.do[1])) * fv.do[4]).int = (-bx.char / fv.do[9] + hi.for(fj.if * fj.char + bx.char)) * fv.do[4];
                if (!fv.for(var1_1, fv.do[10]) || fv.new(this.do, fv.do[9])) {
                    var3_3.case = hi.for(fv.do[10]);
                    "".length();
                    if (-" ".length() != -" ".length()) {
                        throw null;
                    }
                } else {
                    var3_3.case = hi.for(fv.do[11]);
                }
                var3_3.byte = fv.do[8] + (hi.for(fv.do[10]) << fv.do[9]);
                var3_3.try = hi.if(fv.do[2], fv.do[1]);
                var3_3.new = hi.for(var3_3.byte);
                var3_3.do = (byte)hi.for(fv.do[12]);
                this.do.addElement(var3_3);
                ++var2_2;
lbl57:
                // 2 sources

                ** while (!fv.int((int)var2_2, (int)this.int))
            }
lbl58:
            // 1 sources

            if (!fv.new(var1_1, fv.do[9])) break block13;
            var2_2 = fv.do[3];
            "".length();
            if (" ".length() < (167 ^ 179 ^ (172 ^ 188))) ** GOTO lbl78
            throw null;
lbl-1000:
            // 1 sources

            {
                var3_3 = (gd_0)this.do.elementAt(var2_2);
                var1_1 = var2_2 + fv.do[1];
                "".length();
                if ("  ".length() < "   ".length()) ** GOTO lbl76
                throw null;
lbl-1000:
                // 1 sources

                {
                    var4_4 = (gd_0)this.do.elementAt(var1_1);
                    if (fv.if(var3_3.case, var4_4.case)) {
                        this.do.setElementAt(var3_3, var1_1);
                        this.do.setElementAt(var4_4, var2_2);
                        var3_3 = var4_4;
                    }
                    ++var1_1;
lbl76:
                    // 2 sources

                    ** while (!fv.int((int)var1_1, (int)this.do.size()))
                }
lbl77:
                // 1 sources

                ++var2_2;
lbl78:
                // 2 sources

                ** while (!fv.int((int)var2_2, (int)(this.do.size() - fv.do[1])))
            }
        }
    }
}

