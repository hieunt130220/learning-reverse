/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 */
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.util.Vector;
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from gF
 */
public final class gf_0
extends ep
implements gn {
    private static final int[] do;
    private fn_0 do;
    private int int;
    public static gf_0 do;
    private Vector do;
    private short[] do;
    public int do;
    private int new;
    private int try;
    private int byte;
    public static boolean do;
    private fn_0 if;
    public byte do;
    private int case;
    private short do;
    private fw do;
    private short if;
    private byte if;
    private ev[] do;
    public int if;
    private int char;
    private int else = do[0];
    private Vector if;
    private int[] if;
    private Vector for;
    private static short for;
    private fn_0 for;
    private Image do;
    public static boolean if;
    public int for;
    private fw if;
    private int goto;
    private int long;
    private ht do = (byte)do[0];

    private boolean do(gw_0 gw_02) {
        if (gf_0.do(gw_02.do, do[1]) && gf_0.do(gw_02.do, do[9])) {
            if (gf_0.do(fj.do[this.case * fj.if + this.goto], do[16])) {
                bx.int(bT.aj);
                return do[4];
            }
            int n = do[2];
            while (gf_0.if(n, gw_02.do.size())) {
                fw fw2 = (fw)gw_02.do.elementAt(n);
                if (gf_0.do(fj.do[(this.case + fw2.for) * fj.if + this.goto + fw2.if], do[16])) {
                    bx.int(bT.aj);
                    return do[4];
                }
                ++n;
                "".length();
                if ((0xA0 ^ 0xA4) > 0) continue;
                return ((0x9E ^ 0x86) & ~(0xB9 ^ 0xA1)) != 0;
            }
            "".length();
            if (" ".length() < ((0x41 ^ 0x73 ^ (0x57 ^ 0x2B)) & (0xC2 ^ 0xAD ^ (0x89 ^ 0xA8) ^ -" ".length()))) {
                return ((0x12 ^ 0x1A ^ (0x38 ^ 0x6E)) & (19 + 100 - 102 + 190 ^ 116 + 37 - 102 + 94 ^ -" ".length())) != 0;
            }
        } else {
            String string = "";
            int n = do[2];
            while (gf_0.if(n, this.if.size())) {
                bE bE2 = (bE)this.if.elementAt(n);
                if (gf_0.do(n, this.do) && gf_0.new(bE2.do, (int)gw_02.if) && gf_0.new(this.goto, bE2.int / do[10]) && gf_0.new(this.case, bE2.for / do[10])) {
                    string = bT.bu;
                    "".length();
                    if ("   ".length() != 0) break;
                    return ((0xC2 ^ 0xA4 ^ (0x71 ^ 0x58)) & (0x17 ^ 0x60 ^ (0x1A ^ 0x22) ^ -" ".length())) != 0;
                }
                ++n;
                "".length();
                if (-"   ".length() < 0) continue;
                return ((126 + 144 - 217 + 131 ^ 142 + 37 - 24 + 4) & (0x8B ^ 0xAE ^ "  ".length() ^ -" ".length())) != 0;
            }
            if (gf_0.if(string.equals("") ? 1 : 0)) {
                bx.int(string);
                return do[4];
            }
            if (!(gf_0.do(gw_02.do, do[1]) && !gf_0.new(gw_02.do, do[9]) || gf_0.int(fj.if[n = (this.case - do[4]) * fj.if + this.goto], (int)for) && !gf_0.int(fj.if[this.case * fj.if + this.goto], (int)for))) {
                bx.int(bT.dn);
                return do[4];
            }
        }
        return do[2];
    }

    public final void int() {
        gs_0.do().final();
    }

    public final void do(Graphics graphics) {
        this.if(graphics);
        super.do(graphics);
    }

    private static void else() {
        Vector<fn_0> vector = new Vector<fn_0>();
        int n = do[2];
        while (gf_0.if(n, fj.if.size())) {
            dF dF2 = (dF)fj.if.elementAt(n);
            if (gf_0.if(dF2.if ? 1 : 0) && gf_0.do(dF2.char, (int)AngelChip.do.char)) {
                vector.addElement(new fn_0(dF2.do, do[11], n));
            }
            ++n;
            "".length();
            if ((151 + 33 - 46 + 56 ^ 93 + 65 - -26 + 14) > 0) continue;
            return;
        }
        as.do().do(vector, do[2]);
    }

    static int do(gf_0 gf_02) {
        return gf_02.goto;
    }

    private void do(Graphics graphics, int n, int n2, int n3, int n4) {
        graphics.setColor(this.if[n3]);
        graphics.drawRect(n * dH.this, n2 * dH.this, (n4 - do[4]) * dH.this, (n4 - do[4]) * dH.this);
    }

    static void do(gf_0 gf_02, String string) {
        gf_02.do(string);
    }

    private ht do() {
        DataInputStream dataInputStream = ac_0.do("avatarTileMap");
        if (gf_0.do(dataInputStream)) {
            return null;
        }
        this.do = new ht();
        try {
            this.do.do = dataInputStream.readShort();
            for = dataInputStream.readShort();
            byte[] byArray = new byte[dataInputStream.available()];
            dataInputStream.read(byArray);
            "".length();
            this.do.do = hi.do(byArray);
            dataInputStream.close();
            "".length();
        }
        catch (Exception exception) {
            exception.printStackTrace();
        }
        if ((0x17 ^ 0x13) != (0x50 ^ 0x54)) {
            return null;
        }
        return this.do;
    }

    /*
     * WARNING - void declaration
     */
    public final void do(boolean bl, String string) {
        if (gf_0.if(bl ? 1 : 0)) {
            void n;
            bx.int((String)n);
            return;
        }
        int cj2 = fs.int;
        int n = fs.try;
        if (gf_0.if(cj2)) {
            cj cj3 = (cj)this.do.elementAt(n);
            this.for.addElement(cj3);
            this.do.removeElement(cj3);
            "".length();
            "".length();
            if ("   ".length() < ((0xDE ^ 0xB4 ^ (0x7C ^ 0x4F)) & (185 + 36 - 218 + 192 ^ 151 + 99 - 192 + 96 ^ -" ".length()))) {
                return;
            }
        } else {
            cj cj3 = (cj)this.for.elementAt(n);
            this.do.addElement(cj3);
            this.for.removeElement(cj3);
            "".length();
        }
        this.for();
        bx.case();
    }

    public final void if(int n, int n2) {
        switch (n) {
            case 0: {
                if (gf_0.new(this.else, do[0])) {
                    return;
                }
                n2 = this.case * fj.if + this.goto;
                if (gf_0.new(this.do[fj.if[n2]].if, do[0]) && gf_0.new(this.do[fj.if[n2]].do, do[0])) {
                    bx.int(bT.aj);
                    return;
                }
                if (!(gf_0.if(this.else, (int)for) && !gf_0.if(fj.if[n2], (int)for) || gf_0.int(this.else, (int)for) && !gf_0.int(fj.if[n2], (int)for))) {
                    this.try = this.goto;
                    this.char = this.case;
                    fj.if[this.case * fj.if + this.goto] = (short)this.else;
                    return;
                }
                bx.int(bT.aj);
                return;
            }
            case 1: {
                this.else = do[0];
                this.byte = do[0];
                this.try = do[0];
                this.char = do[0];
                n = do[2];
                n2 = do[2];
                while (gf_0.if(n2, this.do.length)) {
                    if (gf_0.do(this.do[n2], (int)fj.if[n2])) {
                        n = do[4];
                        "".length();
                        if ("  ".length() != 0) break;
                        return;
                    }
                    ++n2;
                    "".length();
                    if (((0x7F ^ 0x67) & ~(0x69 ^ 0x71)) < " ".length()) continue;
                    return;
                }
                if (gf_0.do(n)) {
                    er_0.do().do(fj.if, do[2]);
                    bx.int();
                }
                this.catch();
                do = do[2];
                this.void();
                ((ep)this).int = null;
                return;
            }
            case 2: {
                Vector<fn_0> vector = new Vector<fn_0>();
                if (gf_0.if(bx_0.do)) {
                    vector.addElement(new fn_0("T\u1eaft Auto", do[9], gs_0.do()));
                }
                if (gf_0.new(this.int, (int)AngelChip.do.char)) {
                    vector.addElement(new fn_0(bT.bd, do[4]));
                    vector.addElement(new fn_0(bT.be, do[1]));
                    n = do[2];
                    n2 = do[2];
                    while (gf_0.if(n2, fj.if.size())) {
                        if (gf_0.if(((bp)fj.if.elementAt((int)n2)).if)) {
                            ++n;
                        }
                        ++n2;
                        "".length();
                        if (" ".length() != "  ".length()) continue;
                        return;
                    }
                    if (gf_0.for(n, do[4])) {
                        vector.addElement(new fn_0(bT.O, do[8]));
                    }
                    vector.addElement(new fn_0(bT.bO, do[9]));
                }
                if (gf_0.do(bx_0.do)) {
                    vector.addElement(new fn_0("Auto H\u00f4n", do[28], gs_0.do()));
                    vector.addElement(new fn_0("Auto \u0110\u00e1nh", do[7], gs_0.do()));
                }
                vector.addElement(new fn_0(bT.bg, do[12]));
                as.do().do(vector, do[2]);
                return;
            }
            case 3: {
                Vector<fn_0> vector = new Vector<fn_0>();
                vector.addElement(new fn_0(bT.bj, do[29]));
                vector.addElement(new fn_0(bT.throw, do[19]));
                vector.addElement(new fn_0(bT.cg, do[30]));
                as.do().do(vector, do[1]);
                as as2 = as.do();
                n2 = this.goto * do[10] * dH.this - fq.do().if - as.do().for / do[1] + do[19];
                int n3 = this.case * do[10] * dH.this - fq.do().for - as.do().int - do[19];
                as as3 = as2;
                as2.do = n2;
                as3.if = n3;
                if (gf_0.for(as3.do)) {
                    as3.do = do[2];
                }
                if (gf_0.for(as3.if)) {
                    as3.if = do[2];
                }
                return;
            }
            case 4: {
                this.class();
                return;
            }
            case 5: {
                this.goto();
                return;
            }
            case 8: {
                en.do();
                "".length();
                bx.do = null;
                return;
            }
            case 50: {
                er_0.do().do(fj.if, do[4]);
                bx.int();
                return;
            }
            case 51: {
                fj.if = this.do;
                this.do = null;
                fw_0.do();
                return;
            }
            case 53: {
                fv_0.do().else(do[2]);
                bx.int();
                return;
            }
            case 100: {
                er_0.do().do(bx.do.do.do(), do[2], do[2]);
                bx.case();
                return;
            }
            case 101: {
                fv_0.do().if(bx.do.do.do());
            }
        }
    }

    static void do(gf_0 gf_02) {
        gf_02.this();
    }

    /*
     * Unable to fully structure code
     */
    public final void do(int var1_1, int var2_2, short var3_4, Vector var4_7) {
        if (gf_0.do(var1_1)) {
            var1_1 = gf_0.do[2];
            while (gf_0.if(var1_1, var4_7.size())) {
                var2_3 = (eh)var4_7.elementAt(var1_1);
                var3_5 = fx_0.do(var2_3.char);
                if (gf_0.if(var2_3) && gf_0.if(var3_5)) {
                    var3_5.catch = var2_3.catch;
                }
                ++var1_1;
                "".length();
                if ("  ".length() == "  ".length()) continue;
                return;
            }
            bx.case();
            this.char();
            return;
        }
        AngelChip.do.catch = (byte)var2_2;
        gs_0.do().try();
        if (!gf_0.do(this.do)) ** GOTO lbl-1000
        this.do();
        "".length();
        if (!gf_0.if(this.do) || gf_0.do(var3_4, (int)this.do.do)) {
            if (gf_0.do(this.do)) {
                this.do = new ht();
                this.do.do = var3_4;
            }
            var3_6 = er_0.do();
            var3_6.do(gf_0.do[35]);
            var3_6.if();
            var2_2 = gf_0.do[2];
            "".length();
            if (" ".length() < ((215 ^ 147) & ~(86 ^ 18))) {
                return;
            }
        } else lbl-1000:
        // 2 sources

        {
            var2_2 = gf_0.do[4];
        }
        if (gf_0.do(var2_2)) {
            if (gf_0.do(gs_0.do, gf_0.do[0])) {
                er_0.do().case(gs_0.do);
                gs_0.do = gf_0.do[0];
                return;
            }
            bx.byte = gf_0.do[4];
            bx.case();
            return;
        }
        bx.byte = gf_0.do[4];
    }

    public static void if() {
        bx.do.do(bT.else, do[41], do[1]);
    }

    public final void do(bE bE2) {
        if (gf_0.do(gf_0.if(bE2) ? 1 : 0)) {
            bE2.for += do[4];
        }
        this.if.addElement(bE2);
        fj.char.addElement(bE2);
        this.if(bE2);
        fj.do(fj.char);
        "".length();
    }

    static void do(gf_0 gf_02, int n, String string) {
        gw_0 gw_02 = (gw_0)ac_0.do.elementAt(n);
        if (gf_0.if(gf_02.do(gw_02) ? 1 : 0)) {
            bx.do(gw_02.do, (int)gw_02.new, new fz_0(gf_02, gw_02, string), new gj(gf_02, gw_02, string), new em_0(gf_02));
        }
    }

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    public final void do(int n, int n2) {
        bE bE2;
        int n3 = do[0];
        int n4 = do[2];
        while (gf_0.if(n4, this.if.size())) {
            bE2 = (bE)this.if.elementAt(n4);
            if (gf_0.new(bE2.int / do[10], this.goto) && gf_0.new(bE2.for / do[10], this.case)) {
                n3 = n4;
                "".length();
                if ((0x4F ^ 0x4B) <= (0xBD ^ 0xB9)) break;
                return;
            }
            ++n4;
            "".length();
            if ((0x19 ^ 0x1C) != 0) continue;
            return;
        }
        bE2 = null;
        if (gf_0.do(n3, do[0])) {
            bE2 = (bE)this.if.elementAt(n3);
        }
        switch (n) {
            case 1: {
                fv_0 fv_02 = fv_0.do();
                fv_02.do(do[36]);
                fv_02.if();
                return;
            }
            case 2: {
                Vector<fn_0> vector = new Vector<fn_0>();
                vector.addElement(new fn_0(bT.cx, do[17]));
                vector.addElement(new fn_0(bT.bU, do[37]));
                if (gf_0.int(this.if.size())) {
                    vector.addElement(new fn_0(bT.bZ, do[18]));
                }
                as.do().do(vector, do[1]);
                return;
            }
            case 3: {
                gf_0.else();
                return;
            }
            case 4: {
                bx.do.do(bT.else + ":", do[38], do[1]);
                return;
            }
            case 5: {
                gs_0.do().final();
                return;
            }
            case 6: {
                this.this();
                return;
            }
            case 7: {
                do = do[4];
                if (gf_0.do(this.do)) {
                    if (gf_0.do(this.do)) {
                        eo_0.do();
                        er_0 er_02 = er_0.do();
                        er_02.do(do[39]);
                        er_02.if();
                        bx.int();
                    }
                    return;
                }
                this.goto();
                return;
            }
            case 8: {
                this.break();
                return;
            }
            default: {
                return;
            }
            case 11: {
                if (gf_0.new(n3, do[0])) {
                    bx.int(bT.cQ);
                    return;
                }
                this.do = n3;
                n = do[2];
                while (gf_0.if(n, ac_0.do.size())) {
                    if (gf_0.new(((gw_0)ac_0.do.elementAt((int)n)).if, (int)bE2.do)) {
                        this.else = n;
                        "".length();
                        if ("   ".length() != 0) break;
                        return;
                    }
                    ++n;
                    "".length();
                    if (null == null) continue;
                    return;
                }
                ((ep)this).try = null;
                ((ep)this).int = null;
                this.int(bE2);
                this.do = new fw(this.goto, this.case, bE2.do);
                ((ep)this).new = new fn_0(bT.bq, new bR(this, bE2));
                return;
            }
            case 12: {
                if (gf_0.new(n3, do[0])) {
                    bx.int(bT.cQ);
                    return;
                }
                if (gf_0.if(bE2.do)) {
                    bE2.do = (byte)do[1];
                    "".length();
                    if (-" ".length() > (0xD2 ^ 0xA9 ^ 126 + 97 - 97 + 1)) {
                        return;
                    }
                } else {
                    bE2.do = (byte)do[2];
                }
                er_0.do().do(bE2.do, this.goto, this.case, this.goto, this.case, bE2.do);
                return;
            }
            case 13: {
                if (gf_0.do(n3, do[0]) && gf_0.do(bE2.do, (int)this.if)) {
                    bx.do(bT.throws, new aa_0(bE2));
                    return;
                }
                bx.int(bT.cQ);
                return;
            }
            case 14: {
                fs.do().int();
                bx.do(bT.bv, do[40]);
                return;
            }
            case 15: {
                fc[] fcArray = new fc[do[8]];
                n2 = do[2];
                while (gf_0.if(n2, do[8])) {
                    fcArray[n2] = new fc();
                    fcArray[n2].if(do[1]);
                    ++n2;
                    "".length();
                    if (" ".length() >= 0) continue;
                    return;
                }
                fcArray[do[2]].do(do[4]);
                fn_0 fn_02 = new fn_0(bT.cS, new bq_0(fcArray));
                fs.do().int();
                en.do().do(fcArray, bT.cb, bT.if, fn_02);
                bx.do = en.do();
                en.do().try = (int)new fn_0(bT.finally, do[18]);
                return;
            }
            case 16: {
                if (!gf_0.if(n2, fj.if.size())) break;
                dF dF2 = (dF)fj.if.elementAt(n2);
                er_0.do().try(dF2.char);
                return;
            }
            case 17: {
                n = do[2];
                while (gf_0.if(n, this.do.length)) {
                    if (gf_0.new(n, n2)) {
                        if (gf_0.do(this.try, do[0])) {
                            this.goto = this.try;
                            this.case = this.char;
                            AngelChip.do.int = (Vector)(this.try * do[10]);
                            AngelChip.do.for = this.char * do[10];
                            fq.do().do((int)(AngelChip.do.int * dH.this), AngelChip.do.for * dH.this);
                        }
                        this.else = n;
                        if (gf_0.if(this.else, (int)for)) {
                            this.byte = do[4];
                            "".length();
                            if ((0x20 ^ 0x24) <= ((2 ^ 0x2E) & ~(0x93 ^ 0xBF))) {
                                return;
                            }
                        } else {
                            this.byte = do[2];
                        }
                    }
                    ++n;
                    "".length();
                    if (-"   ".length() <= 0) continue;
                    return;
                }
                return;
            }
            case 18: {
                n = do[2];
                while (gf_0.if(n, ac_0.do.size())) {
                    if (gf_0.new(n, n2)) {
                        Object object = (gw_0)ac_0.do.elementAt(n);
                        if (gf_0.do(((gw_0)object).do) && (gf_0.do(this.do, do[9]) && (!gf_0.do(((gw_0)object).do, do[4]) || !gf_0.do(((gw_0)object).do, do[1])) || gf_0.new(this.do, do[9])) && gf_0.do(n4 = ((gw_0)object).do.indexOf(":"), do[0])) {
                            object = ((gw_0)object).do.substring(do[2], n4);
                            this.do((String)object);
                        }
                    }
                    ++n;
                    "".length();
                    if ("   ".length() > -" ".length()) continue;
                    return;
                }
                break block0;
            }
        }
    }

    public final void do(short s2, String string) {
        bx.case();
        if (gf_0.if(s2)) {
            Vector<fn_0> vector = new Vector<fn_0>();
            vector.addElement(new fn_0(bT.t, do[31]));
            vector.addElement(new fn_0(bT.cW, do[32]));
            bx.do(string, vector);
            return;
        }
        bx.int(string);
        if (gf_0.new(s2, do[1])) {
            fj.if = this.do;
        }
        this.do = null;
        fw_0.do();
        AngelChip.do.int = (Vector)this.if.if;
        AngelChip.do.for = this.if.for;
        ((ep)this).new = gs_0.do().if;
        fq.do().do(do[27] + this.do);
    }

    public final void try() {
        super.try();
        this.void();
    }

    static boolean do(bE bE2) {
        return gf_0.if(bE2);
    }

    private void goto() {
        this.long();
        if (gf_0.do(this.do)) {
            this.do = new short[fj.if.length];
            int n = do[2];
            while (gf_0.if(n, fj.if.length)) {
                this.do[n] = fj.if[n];
                ++n;
                "".length();
                if (((92 + 31 - -25 + 62 ^ 80 + 92 - 56 + 76) & (3 ^ 0x60 ^ (0x40 ^ 0x31) ^ -" ".length())) == 0) continue;
                return;
            }
        }
        if = do[2];
        ((ep)this).new = this.do;
        ((ep)this).int = this.if;
        ((ep)this).try = new fn_0(bT.class, do[12]);
        Vector<bh_0> vector = new Vector<bh_0>();
        int n = do[2];
        while (gf_0.if(n, this.do.length)) {
            if (!gf_0.new(this.do[n].do, do[0]) || gf_0.do(this.do[n].if, do[0])) {
                vector.addElement(new bh_0(this.do[n].do + "(" + bx.do(this.do[n].do, this.do[n].if, do[4]) + ")", n, n));
            }
            ++n;
            "".length();
            if (((0x1B ^ 0x16) & ~(5 ^ 8)) <= (0x66 ^ 0x62)) continue;
            return;
        }
        if (gf_0.int(vector.size())) {
            as.do().do(vector, bx.long, do[13] * dH.this, do[13] * dH.this);
        }
    }

    public final void do(ev[] evArray) {
        this.do = evArray;
        this.goto();
        bx.case();
    }

    private static boolean do(int n) {
        return n != 0;
    }

    public final void new() {
        super.new();
        if (gf_0.if(do ? 1 : 0)) {
            bx.do.for();
            AngelChip.do.else();
            return;
        }
        int n = do[2];
        if (gf_0.do(bx.do(do[1]) ? 1 : 0)) {
            if (gf_0.if(gf_0.try(this.goto, this.case - do[4]) ? 1 : 0)) {
                this.case -= do[4];
            }
            if (gf_0.for(this.case)) {
                this.case = do[2];
            }
            n = do[4];
            "".length();
            if (((0x56 ^ 0x73) & ~(0x44 ^ 0x61)) != 0) {
                return;
            }
        } else if (gf_0.do(bx.do(do[9]) ? 1 : 0)) {
            if (gf_0.if(gf_0.try(this.goto - do[4], this.case) ? 1 : 0)) {
                this.goto -= do[4];
            }
            if (gf_0.for(this.goto)) {
                this.goto = do[2];
            }
            n = do[4];
            AngelChip.do.int = (Vector)dF.case;
            "".length();
            if ("  ".length() < 0) {
                return;
            }
        } else if (gf_0.do(bx.do(do[17]) ? 1 : 0)) {
            if (gf_0.if(gf_0.try(this.goto + do[4], this.case) ? 1 : 0)) {
                this.goto += do[4];
            }
            if (gf_0.int(this.goto, (int)fj.if)) {
                this.goto = fj.if - do[4];
            }
            n = do[4];
            AngelChip.do.int = (Vector)do[2];
            "".length();
            if (((0x1A ^ 0x4A ^ (0x11 ^ 0x1A)) & (69 + 233 - 78 + 17 ^ 19 + 9 - -73 + 69 ^ -" ".length())) != ((0x9E ^ 0xB5 ^ (0xB0 ^ 0x9E)) & (0x7B ^ 0x76 ^ (0x99 ^ 0x91) ^ -" ".length()))) {
                return;
            }
        } else if (gf_0.do(bx.do(do[18]) ? 1 : 0)) {
            if (gf_0.if(gf_0.try(this.goto, this.case + do[4]) ? 1 : 0)) {
                this.case += do[4];
            }
            if (gf_0.int(this.case, (int)fj.do)) {
                this.case = fj.do - do[4];
            }
            n = do[4];
        }
        if (gf_0.do(bx.byte ? 1 : 0)) {
            n = (fq.do().if + bx.do) / (fj.char * dH.this);
            int n2 = (fq.do().for + bx.this) / (fj.char * dH.this);
            if (gf_0.new(n, this.goto) && gf_0.new(n2, this.case) && gf_0.if(((ep)this).new)) {
                ((ep)this).new.if();
            }
            this.goto = n;
            this.case = n2;
            n = do[4];
            bx.byte = do[2];
        }
        if (gf_0.do(n)) {
            AngelChip.do.int = (Vector)(this.goto * do[10] + do[19]);
            AngelChip.do.for = this.case * do[10] + do[19];
            if (gf_0.do(this.do, do[0]) && gf_0.int(this.if.size())) {
                bE bE2 = (bE)this.if.elementAt(this.do);
                ((bE)this.if.elementAt(this.do)).int = this.goto * do[10];
                bE2.for = this.case * do[10];
                fj.do(fj.char);
                "".length();
            }
        }
    }

    static int if(gf_0 gf_02) {
        return gf_02.try;
    }

    private static boolean if(int n) {
        return n == 0;
    }

    static fw do(gf_0 gf_02) {
        return gf_02.do;
    }

    static void if(gf_0 gf_02) {
        gf_02.break();
    }

    private void long() {
        eo_0.do();
        this.goto = (int)(AngelChip.do.int / do[10]);
        this.case = AngelChip.do.for / do[10];
        fj.do(AngelChip.do);
    }

    public final void do(byte by2, int n, short[] sArray, byte by3, Vector vector, Vector object) {
        this.do = by2;
        this.int = n;
        this.if = vector;
        fj.if = by3;
        fj.do = (short)(sArray.length / by3);
        fj.if = sArray;
        if (gf_0.new(this.do, do[9])) {
            bx.do.do(do[23]);
            "".length();
            if ("  ".length() == 0) {
                return;
            }
        } else {
            bx.do.do(do[7] + this.do);
        }
        fj.for = do[0];
        by2 = (byte)do[0];
        n = do[2];
        int n2 = do[2];
        while (gf_0.if(n2, (int)by3)) {
            int n3 = do[2];
            while (gf_0.if(n3, (int)fj.do)) {
                if (gf_0.if(fj.if[n3 * by3 + n2], (int)for)) {
                    fj.do[n3 * by3 + n2] = do[16];
                    "".length();
                    if ("   ".length() != "   ".length()) {
                        return;
                    }
                } else {
                    fj.do[n3 * by3 + n2] = do[24];
                }
                ++n3;
                "".length();
                if ("   ".length() != -" ".length()) continue;
                return;
            }
            if (gf_0.new(fj.if[(fj.do - do[4]) * by3 + n2], this.do.do.getHeight() / (do[10] * dH.this) - do[4])) {
                fj.if[(fj.do - gf_0.do[4]) * by3 + n2] = fj.if[(fj.do - do[1]) * by3 + n2];
                fj.do[(fj.do - gf_0.do[4]) * by3 + n2] = do[25];
                ++n;
                if (gf_0.new(by2, do[0])) {
                    by2 = (byte)(n2 * do[10]);
                }
            }
            ++n2;
            "".length();
            if (((0x24 ^ 0x74) & ~(0x75 ^ 0x25)) == 0) continue;
            return;
        }
        this.if = new fw(by2 + n * do[10] / do[1], fj.do * do[10] - do[26]);
        AngelChip.do.int = (Vector)this.if.if;
        AngelChip.do.for = this.if.for;
        dj_0 dj_02 = fj.do((int)AngelChip.do.char);
        if (gf_0.if(dj_02)) {
            dj_02.do((int)AngelChip.do.int, AngelChip.do.for ? 1 : 0);
            dj_02.int();
        }
        fq.do().do(do[27] + this.do);
        fj.do = new cx_0(this.do.do, do[10] * dH.this, do[10] * dH.this);
        int n4 = do[2];
        while (gf_0.if(n4, ((Vector)object).size())) {
            eh eh2 = (eh)((Vector)object).elementAt(n4);
            eh2.else = (byte)eh2.int;
            eh2.byte = (short)(eh2.for ? 1 : 0);
            if (gf_0.do(eh2.char, (int)AngelChip.do.char)) {
                fj.if(eh2);
            }
            ++n4;
            "".length();
            if (null == null) continue;
            return;
        }
        n4 = do[2];
        int n5 = do[2];
        n = do[2];
        while (gf_0.if(n, this.if.size())) {
            bE bE2 = (bE)this.if.elementAt(n);
            if (gf_0.if(bE2.int) && gf_0.if(bE2.for)) {
                int n6 = do[2];
                int n7 = do[2];
                while (gf_0.if(n7, fj.if.length)) {
                    if (gf_0.new(fj.do[n7], do[16])) {
                        bE2.int = n7 % fj.if * do[10];
                        bE2.for = n7 / fj.if * do[10];
                        n4 = bE2.int;
                        n5 = bE2.for;
                        n6 = do[4];
                        this.if(bE2);
                        er_0.do().do(bE2.do, do[2], do[2], bE2.int / do[10], bE2.for / do[10], bE2.do);
                        "".length();
                        if (null == null) break;
                        return;
                    }
                    ++n7;
                    "".length();
                    if (null == null) continue;
                    return;
                }
                if (gf_0.if(n6)) {
                    bE2.int = n4;
                    bE2.for = n5;
                    er_0.do().do(bE2.do, do[2], do[2], bE2.int / do[10], bE2.for / do[10], bE2.do);
                }
            }
            if (gf_0.do(gf_0.if(bE2) ? 1 : 0)) {
                bE2.for += do[4];
            }
            ++n;
            "".length();
            if (((55 + 200 - 133 + 96 ^ 70 + 90 - 99 + 77) & (0xAE ^ 0xB3 ^ (0x6B ^ 0x26) ^ -" ".length())) >= 0) continue;
            return;
        }
        gs_0.do();
        "".length();
        gs_0.const();
        Vector vector2 = this.if;
        object = this;
        n2 = do[2];
        while (gf_0.if(n2, vector2.size())) {
            bE bE3 = (bE)vector2.elementAt(n2);
            fj.char.addElement(bE3);
            ((gf_0)object).if(bE3);
            ++n2;
            "".length();
            if (-(0x75 ^ 0 ^ (0x76 ^ 6)) < 0) continue;
            return;
        }
        fj.do(fj.char);
        "".length();
        this.try();
        bx.case();
    }

    private void this() {
        Vector<fn_0> vector = new Vector<fn_0>();
        int n = do[2];
        while (gf_0.if(n, ac_0.do.size())) {
            int n2;
            Object object = (gw_0)ac_0.do.elementAt(n);
            if (gf_0.do(((gw_0)object).do) && (gf_0.do(this.do, do[9]) && (!gf_0.do(((gw_0)object).do, do[4]) || !gf_0.do(((gw_0)object).do, do[1])) || gf_0.new(this.do, do[9])) && gf_0.do(n2 = ((gw_0)object).do.indexOf(":"), do[0])) {
                int n3 = do[2];
                object = ((gw_0)object).do.substring(do[2], n2);
                n2 = do[2];
                while (gf_0.if(n2, vector.size())) {
                    if (gf_0.do(((fn_0)vector.elementAt((int)n2)).do.equals(object) ? 1 : 0)) {
                        n3 = do[4];
                    }
                    ++n2;
                    "".length();
                    if ("  ".length() != 0) continue;
                    return;
                }
                if (!gf_0.do(n3) || gf_0.do(vector.isEmpty() ? 1 : 0)) {
                    vector.addElement(new fn_0((String)object, do[14], n));
                }
            }
            ++n;
            "".length();
            if (null == null) continue;
            return;
        }
        as.do().do(vector, do[1]);
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    public final void for() {
        int n = fs.int;
        int n2 = fs.try;
        fs.do().int();
        this.do(this.do, this.for, this.long, this.if);
        fs.int = n;
        fs.do().goto();
        n = fs.do().do[n].size();
        if (gf_0.int(n2, n)) {
            if (gf_0.int(n)) {
                n2 = n - do[4];
                "".length();
                if ("   ".length() <= -" ".length()) {
                    return;
                }
            } else {
                n2 = do[2];
            }
        }
        fs.try = n2;
        fs.do().case();
        bx.do.do(fs.try);
    }

    static void do(gf_0 gf_02, int n) {
        gf_02.else = n;
    }

    private static boolean if(bE bE2) {
        int n;
        if (gf_0.do(ac_0.do((int)bE2.do).do, do[1]) && gf_0.do(ac_0.do((int)bE2.do).do, do[9]) && gf_0.int(fj.if[n = (bE2.for / do[10] - do[4]) * fj.if + bE2.int / do[10]], (int)for) && gf_0.if(fj.if[bE2.for / do[10] * fj.if + bE2.int / do[10]], (int)for)) {
            return do[4];
        }
        return do[2];
    }

    private static boolean for(int n, int n2) {
        return n > n2;
    }

    public final void case() {
        this.for = null;
        this.do = null;
        fp.do().do(do[25], do[2]);
        fj.for = do[0];
    }

    static boolean do(gf_0 gf_02, gw_0 gw_02) {
        return gf_02.do(gw_02);
    }

    static int for(gf_0 gf_02) {
        return gf_02.case;
    }

    public final void do(Vector object, Vector object2, int n, byte by2) {
        this.do = object;
        this.for = object2;
        this.long = n;
        this.if = by2;
        gs_0.do();
        "".length();
        Vector vector = gs_0.do((Vector)object, AngelChip.do.char, do[8]);
        gs_0.do();
        "".length();
        object2 = gs_0.do((Vector)object2, AngelChip.do.char, do[1]);
        if (gf_0.if(bx.do, fh_0.do)) {
            fs.do().for = do[4];
            String[] stringArray = new String[do[1]];
            stringArray[gf_0.do[2]] = bT.cO;
            stringArray[gf_0.do[4]] = bT.bd;
            Vector[] vectorArray = new Vector[do[1]];
            vectorArray[gf_0.do[2]] = vector;
            vectorArray[gf_0.do[4]] = object2;
            fs.do().do(stringArray, vectorArray, null);
            object = gs_0.do().do((Vector)object, do[4], do[4], do[2]);
            object2 = new fn_0(bT.bo, new ek_0());
            fs.do().do((fn_0)object, do[2]);
            fs.do().do((fn_0)object2, do[4]);
            if (gf_0.if(bx.do, fs.do())) {
                fs.do().try();
            }
        }
    }

    private static boolean do(Object object) {
        return object == null;
    }

    static void if(gf_0 gf_02, int n) {
        gf_02.case = n;
    }

    private static boolean for(int n) {
        return n < 0;
    }

    public final void byte() {
        gs_0.do().byte();
        if (gf_0.if(do ? 1 : 0) && gf_0.if(if ? 1 : 0) && gf_0.do(((ep)this).int) && gf_0.if(gs_0.do().int)) {
            ((ep)this).int = fj.do;
        }
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    public static void do(byte by2, String string, String[] stringArray, short[] sArray, short[] sArray2, String[] stringArray2, String[] stringArray3, int[] nArray, short[] sArray3) {
        gs_0.do();
        "".length();
        gs_0.do(AngelChip.do);
        Vector<dq> vector = new Vector<dq>();
        int n = do[2];
        while (gf_0.if(n, stringArray.length)) {
            int n2;
            ew ew2 = new ew(by2, sArray2[n], stringArray3[n]);
            String string2 = stringArray[n];
            short s2 = sArray[n];
            String string3 = stringArray2[n];
            if (gf_0.do(nArray)) {
                n2 = do[0];
                "".length();
                if (-(0x6C ^ 0x69) >= 0) {
                    return;
                }
            } else {
                n2 = nArray[n];
            }
            vector.addElement(new dq(bT.class, ew2, n, string2, s2, string3, n2, sArray3[n]));
            ++n;
            "".length();
            if ("   ".length() != 0) continue;
            return;
        }
        if (gf_0.int(vector.size())) {
            fs.do().try();
            fs.if = do[4];
            String[] stringArray4 = new String[do[4]];
            stringArray4[gf_0.do[2]] = string;
            Vector[] vectorArray = new Vector[do[4]];
            vectorArray[gf_0.do[2]] = vector;
            fs.do().do(stringArray4, vectorArray, null);
        }
    }

    private void void() {
        if (gf_0.new(this.int, (int)AngelChip.do.char)) {
            ((ep)this).new = gs_0.do().if;
            ((ep)this).new.do = bT.class;
            ((ep)this).try = this.for;
            return;
        }
        ((ep)this).try = this.for;
        if (gf_0.if(bx.int)) {
            ((ep)this).new = gs_0.do().if;
        }
    }

    private void break() {
        ((ep)this).new = new fn_0(bT.class, do[8]);
        ((ep)this).int = new fn_0(bT.cS, do[9]);
        ((ep)this).try = null;
        do = do[4];
        this.goto = (int)(AngelChip.do.int / do[10]);
        this.case = AngelChip.do.for / do[10];
        fj.do(AngelChip.do);
    }

    private static boolean int(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(Object object, Object object2) {
        return object != object2;
    }

    public final void do(byte[] byArray, int n) {
        for = (short)n;
        this.do.do = hi.do(byArray);
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeShort(this.do.do);
            dataOutputStream.writeShort(n);
            dataOutputStream.write(byArray);
            hi.do("avatarTileMap", byteArrayOutputStream.toByteArray());
            dataOutputStream.close();
            "".length();
        }
        catch (Exception exception) {
            exception.printStackTrace();
        }
        if (" ".length() < " ".length()) {
            return;
        }
        if (gf_0.do(gs_0.do, do[0])) {
            er_0.do().case(gs_0.do);
            gs_0.do = do[0];
            return;
        }
        bx.case();
    }

    private void catch() {
        fj.if(AngelChip.do);
        AngelChip.do.int = (Vector)this.if.if;
        AngelChip.do.for = this.if.for;
        AngelChip.do.byte = (short)do[2];
        fq.do().do(this.if.if * dH.this, this.if.for * dH.this);
    }

    public final void char() {
        if (gf_0.do(fx_0.do)) {
            bx.int();
            eb_0.do().for();
            fx_0.do = (byte)do[1];
            return;
        }
        if (gf_0.do(fx_0.do ? 1 : 0)) {
            fx_0.do = do[2];
            bx.int();
            er_0.do().char(do[4]);
            return;
        }
        Vector<eh> vector = new Vector<eh>();
        int n = do[2];
        while (gf_0.if(n, fx_0.do.size())) {
            eh eh2 = (eh)fx_0.do.elementAt(n);
            if (gf_0.new(eh2.catch, (int)this.do)) {
                vector.addElement(eh2);
            }
            ++n;
            "".length();
            if (((0x2A ^ 0xC ^ (0x3E ^ 0x13)) & (0x3B ^ 0x19 ^ (0x39 ^ 0x10) ^ -" ".length())) < " ".length()) continue;
            return;
        }
        if (gf_0.do(vector.isEmpty() ? 1 : 0)) {
            if (gf_0.do(bx.do, fx_0.do())) {
                fx_0.do().do.try();
            }
            bx.int(bT.aC);
            return;
        }
        fx_0.do().try();
        fx_0.if = vector;
        fx_0.do().case();
        fx_0.do().for();
    }

    private static boolean if(Object object) {
        return object != null;
    }

    private void int(bE bE2) {
        int n = do[2];
        int n2 = do[2];
        while (gf_0.if(n2, this.if.size())) {
            bE bE3 = (bE)this.if.elementAt(n2);
            if (gf_0.new(bE3.int / do[10], bE2.int / do[10]) && gf_0.new(bE3.for / do[10], bE2.for / do[10])) {
                ++n;
            }
            ++n2;
            "".length();
            if ("   ".length() >= "  ".length()) continue;
            return;
        }
        if (gf_0.new(n, do[4])) {
            gw_0 gw_02 = ac_0.do((int)bE2.do);
            int n3 = do[2];
            while (gf_0.if(n3, gw_02.do.size())) {
                fw fw2 = (fw)gw_02.do.elementAt(n3);
                fj.do[(bE2.for / gf_0.do[10] + fw2.for) * fj.if + bE2.int / gf_0.do[10] + fw2.if] = do[16];
                ++n3;
                "".length();
                if (" ".length() != 0) continue;
                return;
            }
        }
    }

    public static gf_0 do() {
        if (gf_0.do((Object)do)) {
            do = new gf_0();
        }
        return do;
    }

    static int int(gf_0 gf_02) {
        return gf_02.char;
    }

    private void do(String string) {
        this.class();
        Vector<be_0> vector = new Vector<be_0>();
        int n = do[2];
        while (gf_0.if(n, ac_0.do.size())) {
            gw_0 gw_02 = (gw_0)ac_0.do.elementAt(n);
            int n2 = gw_02.do.indexOf(string);
            if (gf_0.do(gw_02.do) && gf_0.do(n2, do[0]) && (gf_0.do(this.do, do[9]) && (!gf_0.do(gw_02.do, do[4]) || !gf_0.do(gw_02.do, do[1])) || gf_0.new(this.do, do[9]))) {
                String string2 = gw_02.do.substring(gw_02.do.indexOf(":") + do[4]);
                String string3 = bx.do(gw_02.do, (int)gw_02.new, do[4]);
                vector.addElement(new be_0("", new bz(this, n, string), gw_02, string3, string2));
            }
            ++n;
            "".length();
            if (" ".length() >= " ".length()) continue;
            return;
        }
        if (gf_0.int(vector.size())) {
            as.do().do(vector, bx.long, do[15], do[15]);
            as.do = new bb_0(this);
        }
    }

    private static boolean int(int n) {
        return n > 0;
    }

    public final void if(bE bE2) {
        gw_0 gw_02 = ac_0.do((int)bE2.do);
        int n = do[24];
        if (gf_0.new(gw_02.if, (int)this.do)) {
            n = do[33];
            "".length();
            if ("  ".length() == 0) {
                return;
            }
        } else if (gf_0.new(gw_02.if, (int)this.if)) {
            n = do[23];
            "".length();
            if ("   ".length() < ((0xB1 ^ 0x8D ^ (0x32 ^ 0x55)) & (0x56 ^ 0x6C ^ (0xDB ^ 0xBA) ^ -" ".length()))) {
                return;
            }
        } else if (gf_0.new(gw_02.for, do[4])) {
            n = do[34];
            "".length();
            if (null != null) {
                return;
            }
        } else if (gf_0.new(gw_02.for, do[1])) {
            n = do[28];
        }
        int n2 = do[2];
        while (gf_0.if(n2, gw_02.do.size())) {
            fw fw2 = (fw)gw_02.do.elementAt(n2);
            fj.do[(bE2.for / gf_0.do[10] + fw2.for) * fj.if + bE2.int / gf_0.do[10] + fw2.if] = (short)n;
            ++n2;
            "".length();
            if ((0x76 ^ 0x7E ^ (0x39 ^ 0x35)) > ((0x16 ^ 0x58 ^ (0x55 ^ 0)) & (0x60 ^ 4 ^ 114 + 105 - 191 + 99 ^ -" ".length()))) continue;
            return;
        }
    }

    static void for(gf_0 gf_02, int n) {
        gf_02.char = n;
    }

    static void int(gf_0 gf_02, int n) {
        gf_02.goto = n;
    }

    private static boolean new(int n, int n2) {
        return n == n2;
    }

    static {
        gf_0.const();
        for = (short)do[2];
        if = do[2];
        do = do[2];
    }

    static void new(gf_0 gf_02, int n) {
        gf_02.try = n;
    }

    public final void for(String string) {
        if (gf_0.if(string.trim().equals("") ? 1 : 0)) {
            fp.do().if(string);
        }
    }

    public final void for(bE bE2) {
        block5: {
            gf_0 gf_02 = this;
            int n = do[2];
            do {
                if (gf_0.int(n, gf_02.if.size())) {
                    bE2 = null;
                    "".length();
                    if (-"  ".length() >= 0) {
                        return;
                    }
                    break block5;
                }
                bE bE3 = (bE)gf_02.if.elementAt(n);
                if (gf_0.new(bE3.int / do[10], bE2.int) && gf_0.new(bE3.for / do[10], bE2.for) && gf_0.new(bE3.do, (int)bE2.do)) {
                    bE2 = bE3;
                    "".length();
                    if ("  ".length() > (0x4C ^ 0x48)) {
                        return;
                    }
                    break block5;
                }
                ++n;
                "".length();
            } while ("  ".length() >= " ".length());
            return;
        }
        fj.char.removeElement(bE2);
        "".length();
        this.if.removeElement(bE2);
        "".length();
        this.int(bE2);
        fw_0.do();
        bx.case();
    }

    public final void if(Graphics graphics) {
        Object object;
        bx.do.do(graphics);
        if (gf_0.do(do ? 1 : 0) && gf_0.do(bx.do)) {
            gf_0 gf_02;
            block20: {
                object = graphics;
                gf_02 = this;
                if (gf_0.if(if ? 1 : 0) && gf_0.new(this.do, do[0])) {
                    if (gf_0.do(this.else, do[0])) {
                        int n = do[2];
                        do {
                            if (gf_0.int(n, fj.do.length)) {
                                fj.do.do(gf_02.else, gf_02.goto * do[10] * dH.this, gf_02.case * do[10] * dH.this, do[2], do[2], (Graphics)object);
                                "".length();
                                if ("   ".length() <= 0) {
                                    return;
                                }
                                break block20;
                            }
                            if (gf_0.if(gf_02.byte) && gf_0.int(fj.if[n], (int)for) && gf_0.if(fj.if[n], gf_02.do.length) && (!gf_0.new(gf_02.do[fj.if[n]].if, do[0]) || !gf_0.new(gf_02.do[fj.if[n]].do, do[0])) || gf_0.new(gf_02.byte, do[4]) && gf_0.if(fj.if[n], (int)for)) {
                                gf_02.do((Graphics)object, do[1] + n % fj.if * do[10], do[1] + n / fj.if * do[10], do[2], do[20]);
                            }
                            ++n;
                            "".length();
                        } while (-"   ".length() <= 0);
                        return;
                    }
                } else if (gf_0.do(this.else, do[0])) {
                    gw_0 gw_02 = (gw_0)ac_0.do.elementAt(this.else);
                    if (gf_0.do(gw_02.do, do[1]) && gf_0.do(gw_02.do, do[9])) {
                        int n = do[2];
                        while (gf_0.if(n, fj.do.length)) {
                            if (gf_0.new(fj.do[n], do[16]) && (!gf_0.new(n % fj.if, gf_02.goto) || gf_0.do(n / fj.if, gf_02.case))) {
                                gf_02.do((Graphics)object, do[1] + n % fj.if * do[10], do[1] + n / fj.if * do[10], do[2], do[20]);
                            }
                            ++n;
                            "".length();
                            if ("  ".length() > 0) continue;
                            return;
                        }
                    } else {
                        int n = do[2];
                        while (gf_0.if(n, fj.if.length)) {
                            if (gf_0.int(n) && gf_0.if(fj.if[n], (int)for) && gf_0.int(fj.if[n - fj.if], (int)for)) {
                                gf_02.do((Graphics)object, do[1] + n % fj.if * do[10], do[1] + n / fj.if * do[10], do[2], do[20]);
                            }
                            ++n;
                            "".length();
                            if (" ".length() >= 0) continue;
                            return;
                        }
                    }
                }
            }
            gf_02.do((Graphics)object, gf_02.goto * do[10], gf_02.case * do[10], do[4], do[10]);
        }
        bx.do.if(graphics);
        if (gf_0.do(do ? 1 : 0)) {
            if (gf_0.do(if ? 1 : 0) && gf_0.do(this.else, do[0])) {
                object = (gw_0)ac_0.do.elementAt(this.else);
                ac_0.do(graphics, object.do, (this.goto * do[10] + object.int) * dH.this, (this.case * do[10] + object.try) * dH.this, do[2]);
            }
            if (gf_0.do(bx.do)) {
                graphics.drawImage(this.do, (this.goto * do[10] + do[19]) * dH.this, (this.case * do[10] + this.new) * dH.this, do[21]);
            }
            if (gf_0.do(this.byte, do[0])) {
                bx.int.do(graphics, this.do[this.else].do + "(" + bx.do(this.do[this.else].do, this.do[this.else].if, do[4]) + ")", (this.goto * do[10] + do[19]) * dH.this, (this.case * do[10] - do[22]) * dH.this, do[1]);
            }
            this.new += do[4];
            if (gf_0.for(this.new, do[12])) {
                this.new = do[2];
            }
        }
        bx.if(graphics);
        fj.for(graphics);
        aq_0.do(graphics);
    }

    static void for(gf_0 gf_02) {
        gf_02.long();
    }

    private void class() {
        this.do = do[0];
        this.else = do[0];
        do = do[2];
        if = do[2];
        this.void();
        ((ep)this).int = null;
        if (gf_0.do(fj.do((int)AngelChip.do.char))) {
            this.catch();
        }
    }

    public gf_0() {
        this.byte = do[0];
        this.do = do[0];
        this.try = do[0];
        this.char = do[0];
        int[] nArray = new int[do[1]];
        nArray[gf_0.do[2]] = do[3];
        nArray[gf_0.do[4]] = do[5];
        this.if = nArray;
        this.if = (short)do[6];
        this.do = (short)do[7];
        this.new = do[2];
        this.do = new fn_0(bT.at, do[2]);
        this.if = new fn_0(bT.cS, do[4]);
        this.for = new fn_0(bT.bo, do[1]);
        f_0.do(bT.dm);
        this.do = f_0.do("hand");
        f_0.do();
    }

    private static boolean try(int n, int n2) {
        if (!gf_0.do(fj.if[n2 * fj.if + n], fj.do.for - do[1]) || gf_0.new(fj.if[n2 * fj.if + n], do[0])) {
            return do[4];
        }
        return do[2];
    }

    public final void if(int n) {
        cV.do().do(n, this);
        super.if(n);
    }

    private static void const() {
        do = new int[42];
        gf_0.do[0] = -" ".length();
        gf_0.do[1] = "  ".length();
        gf_0.do[2] = (0x7E ^ 0x6D) & ~(0x9F ^ 0x8C);
        gf_0.do[3] = -(0xFFFF9FFD & 0x6B4B) & (0xFFFFFFFF & 0x19CF4F);
        gf_0.do[4] = " ".length();
        gf_0.do[5] = -(0xFFFFF975 & 0x7FB) & (0xFFFFFB79 & 0xE0FFF7);
        gf_0.do[6] = 0x56 ^ 0x13;
        gf_0.do[7] = 30 + 162 - 143 + 196 ^ 142 + 124 - 161 + 72;
        gf_0.do[8] = "   ".length();
        gf_0.do[9] = 0x18 ^ 0x2C ^ (0xE ^ 0x3E);
        gf_0.do[10] = 0x57 ^ 0x6F ^ (0x7A ^ 0x5A);
        gf_0.do[11] = 0x59 ^ 0x62 ^ (0x60 ^ 0x4B);
        gf_0.do[12] = 0x6D ^ 0x68;
        gf_0.do[13] = 0x60 ^ 0x7B;
        gf_0.do[14] = 0x63 ^ 0x56 ^ (0xE1 ^ 0xC6);
        gf_0.do[15] = 0xDB ^ 0xA9 ^ (0x32 ^ 0x1A);
        gf_0.do[16] = 0x70 ^ 0x20;
        gf_0.do[17] = 0xB7 ^ 0xB1;
        gf_0.do[18] = 0xB6 ^ 0x90 ^ (0x65 ^ 0x4B);
        gf_0.do[19] = 8 ^ 4;
        gf_0.do[20] = 0x3D ^ 0x29;
        gf_0.do[21] = 0xE0 ^ 0xA8 ^ (0xED ^ 0x84);
        gf_0.do[22] = 0x42 ^ 0x31 ^ (7 ^ 0x5C);
        gf_0.do[23] = 0x21 ^ 0x3C ^ (0x4F ^ 0x3D);
        gf_0.do[24] = 58 + 107 - -24 + 42 ^ 130 + 58 - 126 + 129;
        gf_0.do[25] = 7 + 144 - 65 + 83 ^ 166 + 110 - 223 + 135;
        gf_0.do[26] = 0x3E ^ 0x20;
        gf_0.do[27] = 0x6F ^ 0x29;
        gf_0.do[28] = 0x55 ^ 0x16;
        gf_0.do[29] = 0x15 ^ 0x1D ^ "   ".length();
        gf_0.do[30] = 0x2A ^ 0x27;
        gf_0.do[31] = 0x3B ^ 9;
        gf_0.do[32] = 0x3B ^ 8;
        gf_0.do[33] = 0x7D ^ 0x20 ^ (0x40 ^ 0x6D);
        gf_0.do[34] = 0xE6 ^ 0xA9;
        gf_0.do[35] = -(49 + 29 - -56 + 2 ^ 80 + 119 - 43 + 37);
        gf_0.do[36] = -(0x31 ^ 0x66);
        gf_0.do[37] = 0xAD ^ 0xAA;
        gf_0.do[38] = 0x74 ^ 0x10;
        gf_0.do[39] = -(91 + 116 - 194 + 125 ^ 130 + 58 - 182 + 155);
        gf_0.do[40] = 0xF1 ^ 0xC4;
        gf_0.do[41] = 0x3C ^ 0x5F ^ (0x62 ^ 0x64);
    }

    static void int(gf_0 gf_02) {
        gf_02.class();
    }
}

