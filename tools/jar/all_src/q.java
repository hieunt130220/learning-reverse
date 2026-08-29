/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 */
import java.io.IOException;
import java.util.Vector;
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class q
extends ep {
    private int if;
    int do;
    public static cx_0 do;
    public static byte do;
    private static Image if;
    private static Image for;
    private fn_0 do;
    private static Image char;
    private int for;
    public static Image do;
    private static Image else;
    private static final int[] do;
    public static byte if;
    Vector do;
    private int int;
    public static q do;
    public static byte for;
    private int new;
    private int try;
    public byte int;
    private short do;
    private int byte = do[0];

    public q() {
        this.int = do[0];
        this.if = do[2];
        this.do = new fn_0(bT.class, do[1]);
        ((ep)this).int = new fn_0(bT.finally, do[3]);
        if (q.new(bx.int)) {
            ((ep)this).new = new fn_0(bT.aG, do[4]);
            "".length();
            if ("  ".length() <= ((0x72 ^ 0x7F) & ~(0x27 ^ 0x2A))) {
                throw null;
            }
        } else {
            ((ep)this).new = this.do;
        }
        ((ep)this).try = new fn_0(bT.bo, do[5]);
        this.do = (short)(do[6] * dH.this);
        if (q.try(bx.int, do[1])) {
            this.do = (short)do[7];
            "".length();
            if ("  ".length() != "  ".length()) {
                throw null;
            }
        } else if (q.for(bx.int)) {
            this.do = (short)(bx.char / do[8]);
            if (q.do(this.do, do[9])) {
                this.do = (short)(bx.char / do[10]);
            }
            if (q.do(bx.char, do[11])) {
                this.do = (short)(bx.char / do[3]);
            }
        }
        this.for = bx.char / this.do + do[1];
        if (q.if(this.for * this.do, bx.char - this.do / do[3])) {
            this.for -= do[1];
        }
        this.try = this.do / do[3];
        this.new = this.do / do[3];
        this.new += do[12];
        if (q.if(bx.char, this.for * this.do)) {
            this.try = (bx.char - this.for * this.do) / do[3] + this.do / do[3];
        }
    }

    private static boolean do(int n) {
        return n > 0;
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    public final void do(int n, int n2) {
        switch (n) {
            case 1: {
                bx.for(bT.as);
                eb_0.do().for(this.int);
                return;
            }
            case 3: {
                bx.int();
                fv_0.do().catch(AngelChip.do.char);
                return;
            }
            case 4: {
                q.goto();
                return;
            }
            case 5: {
                bx.int();
                eb_0.do().byte();
                return;
            }
            case 6: {
                this.char();
                return;
            }
            case 7: {
                bx.int();
                fv_0.do().catch(AngelChip.do.char);
            }
        }
    }

    public static void do() {
        bx.do("Hi\u1ec7n t\u1ea1i b\u1ea1n kh\u00f4ng \u0111\u1ee7 X\u00e8ng \u0111\u1ec3 tham gia m\u00e0n ch\u01a1i, b\u1ea1n c\u00f3 mu\u1ed1n n\u1ea1p th\u00eam X\u00e8ng kh\u00f4ng?", new gv());
    }

    private void for(Graphics graphics) {
        int n;
        graphics.translate(this.try, this.new);
        graphics.translate(do[0], -cj_0.new);
        int n2 = cj_0.new / this.do * this.for - this.for;
        if (q.if(n2)) {
            n2 = do[0];
        }
        if (q.if(n = n2 + bx.new / this.do * this.for + (this.for << do[1]) + this.for, this.do.size())) {
            n = this.do.size();
        }
        while (q.do(n2, n)) {
            int n3 = n2 % this.for * this.do;
            int n4 = n2 / this.for * this.do;
            gA gA2 = (gA)this.do.elementAt(n2);
            if ((!q.new(bx.for ? 1 : 0) || q.for((int)((ep)this).new)) && q.try(n2, this.class)) {
                graphics.drawImage(do, n3, n4, do[10]);
            }
            do.do(gA2.if, n3, n4, do[0], do[10], graphics);
            graphics.drawImage(else, n3 - this.do / do[8], n4 - do[14] * dH.this, do[10]);
            bx.if.do(graphics, "" + gA2.for, n3 - this.do / do[8], n4 - do[14] * dH.this - dH.byte / do[3], do[3]);
            if (q.do(gA2.do)) {
                bx.if.do(graphics, gA2.do, n3, n4 - do[14] * dH.this - dH.byte / do[3], do[3]);
            }
            if (q.try(if, do) && q.do(gA2.do, do[8])) {
                graphics.drawImage(for, n3 + this.do / do[8], n4 - do[14] * dH.this, do[10]);
                bx.try.do(graphics, "" + gA2.do, n3 + this.do / do[8], n4 - do[14] * dH.this - dH.byte / do[3], do[3]);
            }
            if (q.new(gA2.do ? 1 : 0)) {
                graphics.drawImage(for, n3 - this.do / do[8], n4 + this.do / do[10], do[10]);
                graphics.drawImage(char, n3 - this.do / do[8], n4 + this.do / do[10], do[10]);
            }
            if (q.new(gA2.if ? 1 : 0)) {
                graphics.drawImage(for, n3 + this.do / do[8], n4 + this.do / do[10], do[10]);
                graphics.drawImage(if, n3 + this.do / do[8], n4 + this.do / do[10], do[10]);
            }
            ++n2;
            "".length();
            if ((0xA3 ^ 0xA7) >= 0) continue;
            return;
        }
    }

    public final void if() {
        if (q.int(this.int, this.do.size())) {
            if (q.int(this.byte, this.do.size())) {
                bx.int();
                bx.do.if = do[0];
                eb_0.do().do();
                if (q.new(aq_0.else(15000L) ? 1 : 0)) {
                    this.byte = do[0];
                    aq_0.if(1500L);
                }
                return;
            }
            gA gA2 = (gA)this.do.elementAt(this.byte);
            if (q.for(gA2.if)) {
                bx.int();
                eb_0.do().do(this.int, gA2.for, "");
                if (q.new(aq_0.else(5000L) ? 1 : 0)) {
                    this.byte = this.do.size();
                    return;
                }
            }
            this.byte += do[1];
            return;
        }
        gA gA3 = (gA)this.do.elementAt(this.int);
        if (q.try(gA3.if, do[1]) && q.for(gA3.do ? 1 : 0) && q.for(gA3.if ? 1 : 0) && q.for(gA3.do, AngelChip.do.do[do[10]])) {
            bx.int();
            eb_0.do().do(this.int, gA3.for, "");
            aq_0.else(5000L);
            "".length();
        }
        this.int += do[1];
    }

    public final void do(Vector vector) {
        this.do = vector;
    }

    public final void if(int n, int n2) {
        switch (n) {
            case 1: {
                gA gA2 = (gA)this.do.elementAt(this.class);
                if (q.new(gs_0.do ? 1 : 0) && q.if(gA2.do, AngelChip.do.do[do[10]])) {
                    q.do();
                    "".length();
                    q.do();
                    return;
                }
                if (q.for(gA2.if ? 1 : 0)) {
                    eb_0.do().do(this.int, gA2.for, "");
                    bx.int();
                    return;
                }
                bx.do.do(bT.B, new gh(this), do[3]);
                return;
            }
            case 2: {
                q.goto();
                return;
            }
            case 3: {
                this.do(do[1], do[2]);
                return;
            }
            case 4: {
                this.char();
                return;
            }
            case 5: {
                bx.int();
                eb_0.do().byte();
                return;
            }
            case 6: {
                Vector<fn_0> vector = new Vector<fn_0>();
                vector.addElement(new fn_0(bT.aG, do[4]));
                vector.addElement(new fn_0("\u0110\u1ebfn b\u00e0n", do[5]));
                vector.addElement(gs_0.do().for);
                vector.addElement(new fn_0(bT.S, do[13]));
                as.do().do(vector, do[0]);
            }
        }
    }

    private void char() {
        bx.do.do(bT.cV, new gt(this), do[10]);
    }

    protected final void for() {
        bx.do.do(bT.cF, new gp(this), do[0]);
    }

    private static boolean if(int n) {
        return n < 0;
    }

    private static boolean for(int n) {
        return n == 0;
    }

    public final void int() {
        bx.int();
        q.goto();
    }

    private static boolean if(int n, int n2) {
        return n > n2;
    }

    private static boolean int(int n) {
        return n >= 0;
    }

    private static boolean for(int n, int n2) {
        return n <= n2;
    }

    public final void new() {
        if (q.new(aO.do ? 1 : 0) && q.new(bx.int)) {
            bx.do.do((fn_0)((ep)this).try, (fn_0)((ep)this).new, (fn_0)((ep)this).int);
            return;
        }
        super.new();
    }

    public final void do(Graphics graphics) {
        bx.if(graphics);
        fq_0.do(graphics, "Ph\u00f2ng " + fq_0.do + " " + this.int);
        this.for(graphics);
        aO.do(graphics, (fn_0)((ep)this).try, (fn_0)((ep)this).new, (fn_0)((ep)this).int);
    }

    private static boolean int(int n, int n2) {
        return n >= n2;
    }

    private static void else() {
        do = new int[18];
        q.do[0] = (0x26 ^ 0x1F) & ~(0xB0 ^ 0x89);
        q.do[1] = " ".length();
        q.do[2] = -" ".length();
        q.do[3] = "  ".length();
        q.do[4] = 143 + 18 - 56 + 77 ^ 75 + 71 - 33 + 66;
        q.do[5] = 0x3B ^ 0x36 ^ (0xA8 ^ 0xA3);
        q.do[6] = 0x7D ^ 0x30 ^ (0xE0 ^ 0xC3);
        q.do[7] = 66 + 83 - 73 + 140 ^ 77 + 124 - 135 + 69;
        q.do[8] = 0x9B ^ 0x9F;
        q.do[9] = 0x58 ^ 0x1E;
        q.do[10] = "   ".length();
        q.do[11] = 142 + 97 - 77 + 18;
        q.do[12] = 0x1B ^ 0x63 ^ (0x3D ^ 0x4F);
        q.do[13] = 0x71 ^ 0 ^ (0xB5 ^ 0xC3);
        q.do[14] = 76 + 145 - 214 + 146 ^ 78 + 14 - 10 + 53;
        q.do[15] = 161 + 43 - 97 + 85 ^ 63 + 112 - 35 + 24;
        q.do[16] = 152 + 193 - 259 + 114;
        q.do[17] = 0x39 ^ 0xB;
    }

    public final void try() {
        aO.for();
        ep.float();
        this.class = do[0];
        bx.do.do(if);
        if (q.if(else)) {
            try {
                else = Image.createImage((String)(bT.if() + "/on/imgkhungsoban.on"));
                for = Image.createImage((String)(bT.if() + "/on/imgNumPlayer.on"));
                char = Image.createImage((String)(bT.if() + "/on/imgPlay.on"));
                if = Image.createImage((String)(bT.if() + "/on/imgLock.on"));
                "".length();
            }
            catch (IOException iOException) {
                "".length();
            }
            if (-" ".length() > 0) {
                return;
            }
        }
        bx.byte = do[1];
        ((ep)this).new = (Image)do[1];
        AngelChip.do.do = (byte)do[0];
        super.try();
        if (q.new(this.if, this.int)) {
            this.if = this.int;
            this.byte = do[0];
            this.int = do[0];
        }
        aq_0.for();
    }

    private static void goto() {
        bx.do.if = do[0];
        eb_0.do().do();
        bx.int();
    }

    static {
        q.else();
        do = (byte)do[1];
        for = (byte)do[3];
        if = (byte)do[1];
    }

    private static boolean new(int n, int n2) {
        return n != n2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public final void byte() {
    }

    private static boolean new(int n) {
        return n != 0;
    }

    public final void case() {
        int n = this.do.size() / this.for;
        if (q.new(this.do.size() % this.for)) {
            ++n;
        }
        this.new = do[15] * dH.this;
        if (q.do(bx.char, do[16])) {
            this.new = do[17];
        }
        bx.do.do(this.try - this.do / do[3], this.new - this.do / do[3], this.do, this.do, this.for * this.do, n * this.do + do[12], this.for * this.do, bx.new - (this.new - this.do / do[3]) - do[8], this.do.size());
    }

    private static boolean try(int n, int n2) {
        return n == n2;
    }

    private static boolean if(Object object) {
        return object == null;
    }

    public static q do() {
        if (q.if(do)) {
            do = new q();
            return do;
        }
        return do;
    }

    public final void do(int n, boolean bl) {
        if (q.new(bl ? 1 : 0) && q.try(this.class, n) && q.do(this.do)) {
            this.do.if();
        }
        if (q.int(n) && q.do(n, this.do.size())) {
            super.do(n, bl);
        }
    }
}

