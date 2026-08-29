/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class gC
extends ep {
    private ep do;
    public int[] do;
    public static boolean do;
    public static gC do;
    private int if = if[0];
    private boolean[] do;
    public int do;
    private int for;
    public static boolean if;
    private int int;
    private int new;
    private static int[] if;
    private int try = if[0];

    private static boolean do(int n, int n2) {
        return n > n2;
    }

    /*
     * Unable to fully structure code
     */
    public final void if() {
        block5: {
            this.try = new fn_0(bT.by, gC.if[0]);
            this.new = ep.short;
            this.for = bx.new;
            var1_1 = w.do + (dH.break << gC.if[2]);
            if (!gC.do(this.do)) break block5;
            var2_2 = gC.if[0];
            "".length();
            if (" ".length() != 0) ** GOTO lbl14
            return;
lbl-1000:
            // 1 sources

            {
                if (gC.for(this.do[var2_2])) {
                    var1_1 += this.new;
                }
                ++var2_2;
lbl14:
                // 2 sources

                ** while (!gC.if((int)var2_2, (int)this.do.length))
            }
lbl15:
            // 1 sources

            var2_2 = gC.if[3];
            if (gC.int(bx.char, gC.if[3])) {
                var2_2 = bx.char;
            }
            w.do().do(bT.cp, var2_2 * dH.this, var1_1, gC.if[2]);
            if (!gC.do(bx.do, this)) break block5;
            var1_1 = gC.if[0];
            "".length();
            if (null == null) ** GOTO lbl27
            return;
lbl-1000:
            // 1 sources

            {
                this.do[var1_1] = gC.if[2];
                ++var1_1;
lbl27:
                // 2 sources

                ** while (!gC.if((int)var1_1, (int)gC.if[4]))
            }
lbl28:
            // 1 sources

            if (gC.for((int)bx.int)) {
                this.do[gC.if[4]] = gC.if[2];
            }
            this.do = new int[this.int];
        }
    }

    private void int(int n) {
        block3: {
            do {
                this.try += n;
                if (gC.do(this.try)) {
                    this.try = this.int - if[2];
                }
                if (gC.if(this.try, this.int)) {
                    this.try = if[0];
                }
                if (!gC.if(this.do[this.try])) break block3;
                n /= hi.int(n);
                "".length();
            } while (-"  ".length() <= 0);
            return;
        }
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void for() {
        block9: {
            this.if();
            DataInputStream dataInputStream = ac_0.do("avatarShowName");
            do = if[0];
            if (gC.if(dataInputStream)) {
                return;
            }
            try {
                this.do = dataInputStream.readByte();
                this.do = new int[this.int];
                int n = if[0];
                "".length();
                if (-" ".length() >= 0) {
                    return;
                }
                while (true) {
                    if (gC.if(n, this.int)) {
                        dataInputStream.close();
                        "".length();
                        break;
                    }
                    this.do[n] = dataInputStream.readByte();
                    if (gC.do(this.do[n], if[2])) {
                        this.do[n] = if[0];
                    }
                    ++n;
                }
            }
            catch (Exception exception) {
                "".length();
                ac_0.do("avatarShowName");
                break block9;
            }
            if (-" ".length() == " ".length()) {
                return;
            }
        }
        this.char();
        dr_0.do.do(this.do / if[5]);
    }

    static {
        gC.case();
        do = if[0];
        if = if[0];
    }

    private static boolean for(int n, int n2) {
        return n == n2;
    }

    /*
     * Unable to fully structure code
     */
    public final void if(Graphics var1_1) {
        var1_1.translate(-var1_1.getTranslateX(), -var1_1.getTranslateY());
        var1_1.translate(gC.if[0], this.for);
        w.do().do(var1_1);
        var1_1.translate(bx.long - gC.if[12], w.do().int + w.do + dH.break);
        if (gC.if(this.if, gC.if[9])) {
            this.if = gC.if[0];
        }
        var2_2 = -dH.new / gC.if[6] + this.new / gC.if[6];
        var3_3 = gC.if[0];
        var4_4 = gC.if[0];
        "".length();
        if (-(" ".length() ^ (136 ^ 140)) < 0) ** GOTO lbl28
        return;
lbl-1000:
        // 1 sources

        {
            if (gC.for(this.do[var4_4])) {
                bx.byte.do(var1_1, bT.for[var4_4][gC.if[6]], gC.if[13] * (dH.this - gC.if[2]), var3_3 + var2_2, gC.if[0]);
                bx.byte.do(var1_1, bT.for[var4_4][this.do[var4_4]], gC.if[14] + gC.if[15] * dH.this, var3_3 + var2_2 - gC.if[2], gC.if[6]);
                var5_5 = gC.if[0];
                var6_6 = bx.byte.do(bT.for[var4_4][this.do[var4_4]]) + gC.if[5] + gC.if[16] * (bx.int + gC.if[2]) + w.if.do;
                if (gC.int(var6_6, gC.if[17] * dH.this)) {
                    var6_6 = gC.if[17] * dH.this;
                }
                if (gC.for(var4_4, this.try)) {
                    var5_5 = gC.if[2];
                }
                var7_7 = var3_3 + var2_2 + dH.new / gC.if[6] - w.if.if / gC.if[6];
                w.if.if(var5_5, gC.if[14] + gC.if[15] * dH.this - var6_6 / gC.if[6], var7_7, gC.if[0], var1_1);
                w.if.if(var5_5, gC.if[14] + gC.if[15] * dH.this + var6_6 / gC.if[6] - w.if.do, var7_7, gC.if[6], var1_1);
                var3_3 += this.new;
            }
            ++var4_4;
lbl28:
            // 2 sources

            ** while (!gC.if((int)var4_4, (int)this.int))
        }
lbl29:
        // 1 sources

        bx.byte.do(var1_1, String.valueOf(this.do), gC.if[14] + gC.if[15] * dH.this, gC.if[6] * this.new + var2_2, gC.if[6]);
        this.if += gC.if[2];
    }

    private static boolean do(Object object, Object object2) {
        return object != object2;
    }

    private void new(int n) {
        if (gC.for(this.try, if[6])) {
            this.do += n * if[5];
            if (gC.do(this.do)) {
                this.do = if[11];
            }
            if (gC.do(this.do, if[11])) {
                this.do = if[0];
                return;
            }
        } else {
            if (gC.if(this.do[this.try])) {
                this.do[this.try] = if[2];
                return;
            }
            this.do[this.try] = if[0];
        }
    }

    private static boolean do(int n) {
        return n < 0;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void for(int n) {
        block11: {
            DataOutputStream dataOutputStream;
            ByteArrayOutputStream byteArrayOutputStream;
            block10: {
                this.do = n;
                byteArrayOutputStream = new ByteArrayOutputStream();
                dataOutputStream = new DataOutputStream(byteArrayOutputStream);
                try {
                    dataOutputStream.writeByte(n);
                    int n2 = if[0];
                    "".length();
                    if (" ".length() != " ".length()) {
                        return;
                    }
                    while (true) {
                        if (gC.if(n2, this.int)) {
                            "".length();
                            break;
                        }
                        dataOutputStream.writeByte(this.do[n2]);
                        ++n2;
                    }
                }
                catch (IOException iOException) {
                    iOException.printStackTrace();
                    break block10;
                }
                if (" ".length() >= "   ".length()) {
                    return;
                }
            }
            try {
                hi.do("avatarShowName", byteArrayOutputStream.toByteArray());
                dataOutputStream.close();
                "".length();
            }
            catch (Exception exception) {
                exception.printStackTrace();
                break block11;
            }
            if ("   ".length() < " ".length()) {
                return;
            }
        }
        this.char();
        dr_0.do.do(n / if[5]);
    }

    public static gC do() {
        if (gC.if(do)) {
            do = new gC();
        }
        return do;
    }

    /*
     * Unable to fully structure code
     */
    public final void new() {
        block17: {
            super.new();
            if (gC.for((int)bx.do(gC.if[6]))) {
                this.int(gC.if[7]);
                "".length();
                if ("   ".length() <= 0) {
                    return;
                }
            } else if (gC.for((int)bx.do(gC.if[8]))) {
                this.int(gC.if[2]);
                "".length();
                if (null != null) {
                    return;
                }
            } else if (gC.for((int)bx.do(gC.if[9]))) {
                this.new(gC.if[7]);
                "".length();
                if ((107 ^ 110) <= 0) {
                    return;
                }
            } else if (gC.for((int)bx.do(gC.if[10]))) {
                this.new(gC.if[2]);
            }
            if (!gC.for((int)bx.if) || !gC.for((int)bx.do(w.do().byte, w.do().int, w.do().try, w.do().new))) break block17;
            bx.if = gC.if[0];
            if (!gC.for((int)bx.do(w.do().byte, w.do().int, w.do().try, w.do().new))) break block17;
            var2_2 = var1_1 = (bx.this - (w.do().int + w.do + dH.break)) / this.new;
            "".length();
            if (" ".length() >= 0) ** GOTO lbl36
            return;
lbl-1000:
            // 1 sources

            {
                if (gC.if(this.do[var2_2])) {
                    ++var1_1;
                }
                --var2_2;
lbl36:
                // 2 sources

                ** while (!gC.do((int)var2_2))
            }
lbl37:
            // 1 sources

            if (gC.for(var1_1, this.try)) {
                if (gC.for(this.do[this.try], gC.if[2])) {
                    this.new(gC.if[7]);
                    "".length();
                    if ("  ".length() <= -" ".length()) {
                        return;
                    }
                } else {
                    this.new(gC.if[2]);
                }
            }
            if (gC.if(var1_1, this.int)) {
                var1_1 = this.int - gC.if[2];
            }
            this.try = var1_1;
        }
    }

    public final void if(int n, int n2) {
        switch (n) {
            case 0: {
                gC gC2 = this;
                gC2.for(gC2.do);
                gC2.do.try();
            }
        }
    }

    public gC() {
        this.int = if[1];
        this.do = if[0];
        this.do = new boolean[this.int];
    }

    private static boolean int(int n, int n2) {
        return n < n2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public final void byte() {
        this.do.byte();
        if (gC.for(this.for)) {
            this.for += -this.for >> if[2];
            if (gC.do(this.for)) {
                this.for = if[0];
            }
        }
    }

    private static void case() {
        if = new int[18];
        gC.if[0] = (0x40 ^ 0x39 ^ (0x45 ^ 0x1D)) & (46 + 55 - -25 + 12 ^ 7 + 71 - 4 + 97 ^ -" ".length());
        gC.if[1] = 0x1E ^ 0x1B;
        gC.if[2] = " ".length();
        gC.if[3] = 16 + 96 - 29 + 48 + (0x72 ^ 0x2D) - (0xE5 ^ 0x8A) + (0x5D ^ 0x60);
        gC.if[4] = "   ".length();
        gC.if[5] = 0x3A ^ 0x27 ^ (0x1F ^ 8);
        gC.if[6] = "  ".length();
        gC.if[7] = -" ".length();
        gC.if[8] = 0x62 ^ 0x6C ^ (0x2F ^ 0x29);
        gC.if[9] = 169 + 128 - 246 + 142 ^ 81 + 55 - 120 + 181;
        gC.if[10] = 0x7A ^ 0x22 ^ (0xE8 ^ 0xB6);
        gC.if[11] = 191 + 22 - 164 + 172 ^ 155 + 150 - 288 + 168;
        gC.if[12] = 0x29 ^ 0x68;
        gC.if[13] = -(0x70 ^ 0x42);
        gC.if[14] = 0xB8 ^ 0xB2 ^ (0x55 ^ 0x6B);
        gC.if[15] = 0x3B ^ 9;
        gC.if[16] = 0xBD ^ 0xB2;
        gC.if[17] = 2 ^ 0x1B;
    }

    public final void do(Graphics graphics) {
        this.do.if(graphics);
        this.if(graphics);
        super.do(graphics);
    }

    public final void try() {
        this.if();
        this.do = bx.do;
        super.try();
        this.for();
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private void char() {
        if (gC.for(bx.int ? 1 : 0)) {
            int n;
            if (gC.for(this.do[if[4]], if[2])) {
                n = if[2];
                "".length();
                if (((0x74 ^ 0x65 ^ (0x71 ^ 0x58)) & (0x50 ^ 7 ^ (0xC4 ^ 0xAB) ^ -" ".length())) != 0) {
                    return;
                }
            } else {
                n = if[0];
            }
            if = n;
        }
        bx.char();
    }

    private static boolean for(int n) {
        return n != 0;
    }

    private static boolean if(Object object) {
        return object == null;
    }
}

