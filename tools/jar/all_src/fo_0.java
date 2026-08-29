/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.util.Enumeration;
import java.util.Vector;
import javax.microedition.lcdui.Graphics;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from fO
 */
public final class fo_0
extends ep {
    public boolean do;
    private fn_0 byte;
    private long for;
    public int do;
    private String for;
    private fn_0 case;
    private String int;
    public int if;
    public static boolean if;
    public fc do;
    public static int for;
    private int long;
    private String[] do;
    public fn_0 do;
    private boolean try;
    public static fo_0 do;
    private boolean byte;
    public int int;
    private static final int[] do;
    public String do;
    private byte if;
    public long do;
    private long int;
    public fc if;
    public int new;
    private int super;
    public fc for;
    public static byte do;
    public int try;
    public int byte;
    public static String if;
    private boolean case;
    public long if;
    public int case;
    public fn_0 if = new fc();
    public fn_0 for = "19006610";
    private String new;
    public int char;
    private fn_0 char;
    public fc int = new fc();
    private fn_0 else;
    public int else;
    public static boolean for;
    private String try;
    public int goto;
    private int throw;
    public static boolean int;

    public final void b_() {
        this.do = new fn_0(bT.bo, do[4]);
        this.byte = new fn_0(bT.break, do[5]);
        this.for = new fn_0(bT.class, do[2]);
        this.else = new fn_0(bT.bn, do[3]);
        this.if = new fn_0(bT.class, do[14]);
        this.case = new fn_0(bT.bg, do[15]);
        this.char = new fn_0(bT.I, do[16]);
        ((ep)this).try = this.do;
    }

    private void long() {
        if (fo_0.if(this.case ? 1 : 0)) {
            this.case = do[2];
            this.else.do = bT.s;
            return;
        }
        this.case = do[4];
        this.else.do = bT.bn;
    }

    private static boolean do(int n, int n2) {
        return n <= n2;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private void this() {
        bx.int();
        bx.byte();
        fv_0.do().if(this.if.do().toLowerCase(), this.int.do().toLowerCase(), this.do.do());
        this.do = do[4];
        ((ep)this).new = this.for;
        bx.do.do(this);
    }

    static {
        fo_0.break();
        for = do[4];
        int = do[4];
        do = (byte)do[4];
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private static boolean for(int n) {
        return n < 0;
    }

    public final void do(int n, int n2) {
        switch (n) {
            case 0: {
                this.do = do[2];
                bx.do.do(this);
                return;
            }
            case 1: {
                this.do = do[4];
                bx.do.do(this);
                return;
            }
            case 2: {
                bx.do(bT.bE, do[0]);
                return;
            }
            case 3: {
                bx.do(bT.cP, do[25], null);
                return;
            }
            case 4: {
                bx.do.do(bT.V, do[26], do[5]);
                return;
            }
            case 44: {
                Vector<fn_0> vector = new Vector<fn_0>();
                if (fo_0.if(k.do.do.isEmpty() ? 1 : 0)) {
                    Enumeration enumeration = k.do.do();
                    while (fo_0.do(enumeration.hasMoreElements() ? 1 : 0)) {
                        Object object = (String)enumeration.nextElement();
                        object = (k)k.do.do(object);
                        vector.addElement(new fn_0(((k)object).if, new k(((k)object).if, ((k)object).do)));
                        "".length();
                        if (null == null) continue;
                        return;
                    }
                }
                if (fo_0.do(vector.isEmpty() ? 1 : 0)) {
                    bx.if("Hi\u1ec7n ch\u01b0a c\u00f3 t\u00e0i kho\u1ea3n n\u00e0o \u0111\u01b0\u1ee3c l\u01b0u!");
                    return;
                }
                as.do().do(vector, do[4]);
                return;
            }
            case 45: {
                String string = this.if.do();
                String string2 = this.int.do();
                String string3 = string.trim().toLowerCase();
                if (!fo_0.if(string3.equals("") ? 1 : 0) || fo_0.do(string2.equals("") ? 1 : 0)) {
                    bx.if("B\u1ea1n ch\u01b0a nh\u1eadp t\u00e0i kho\u1ea3n ho\u1eb7c m\u1eadt kh\u1ea9u!");
                    return;
                }
                if (fo_0.if(k.do.do(string3) ? 1 : 0)) {
                    k.do();
                    "".length();
                    k.do(string, string2);
                    bx.if("Th\u00eam t\u00e0i kho\u1ea3n (" + string + ") th\u00e0nh c\u00f4ng!");
                    return;
                }
                k k2 = (k)k.do.do(string3);
                if (fo_0.do(k2) && fo_0.do(k2.do.equals(string2) ? 1 : 0)) {
                    bx.if("T\u00e0i kho\u1ea3n (" + k2.if + ") \u0111\u00e3 t\u1ed3n t\u1ea1i!");
                    return;
                }
                k.do.do(string3, string3, new k(string, string2));
                k.do();
                "".length();
                k.if();
                bx.if("S\u1eeda t\u00e0i kho\u1ea3n (" + string + ") th\u00e0nh c\u00f4ng!");
                return;
            }
            case 46: {
                fo_0.if();
                return;
            }
            case 47: {
                bx_0.try();
                if (fo_0.do(ge_0.do ? 1 : 0)) {
                    ge_0.for = do[2];
                }
                ge_0.if = do[4];
                return;
            }
            case 5: {
                gC.do().try();
                return;
            }
            case 6: {
                AngelChip.do("http://wap.teamobi.com/faqs.php?provider=" + AngelChip.do);
                return;
            }
            case 7: {
                AngelChip.do("http://wap.teamobi.com?info=checkupdate&game=8&version=2.5.8&provider=" + AngelChip.do + "&agent=" + AngelChip.for);
                return;
            }
            case 8: {
                if (fo_0.if(this.for.equals("") ? 1 : 0)) {
                    AngelChip.do("tel:" + this.for);
                    return;
                }
                if (fo_0.if(ag_0.do().int ? 1 : 0)) {
                    bx.for(bT.h);
                    bx.byte();
                    "".length();
                    if ("   ".length() < 0) {
                        return;
                    }
                } else {
                    bx.int();
                }
                fv_0.do().do(do[27], (String)null);
                return;
            }
            case 9: {
                bx.int(bT.aK + bT.bX);
                ac_0.do();
            }
        }
    }

    public fo_0() {
        int n;
        this.for = new fc();
        this.do = new fc();
        this.case = do[2];
        this.do = do[4];
        String[] stringArray = new String[do[5]];
        stringArray[fo_0.do[4]] = "Ch\u01a1i m\u1edbi";
        stringArray[fo_0.do[2]] = "Ch\u01a1i ti\u1ebfp";
        stringArray[fo_0.do[3]] = "\u0110\u1ed5i t\u00e0i kho\u1ea3n";
        this.do = stringArray;
        this.new = "";
        this.try = "";
        this.char();
        this.if.do(do[2]);
        this.if.if(do[4]);
        this.int.if(do[3]);
        this.for.if(do[3]);
        this.do.if(do[4]);
        this.do.do = "T\u00f9y ch\u1ecdn";
        this.super = do[4];
        this.int = 0L;
        if (fo_0.if(aq_0.int() ? 1 : 0)) {
            n = do[2];
            "".length();
            if (null != null) {
                throw null;
            }
        } else {
            n = do[4];
        }
        this.byte = n;
        this.for = 0L;
        this.int = null;
        if (fo_0.if(hi.do(hi.do))) {
            ac_0.if();
        }
    }

    public final void if(Graphics graphics) {
        try {
            bx.do.do(graphics);
            "".length();
        }
        catch (Exception exception) {
            "".length();
        }
        if (" ".length() <= ((7 ^ 0x5F) & ~(0x2B ^ 0x73))) {
            return;
        }
        bx.do.if(graphics);
        bx.if(graphics);
        if (fo_0.if(cU.if ? 1 : 0) && fo_0.do(aq_0.do)) {
            long l;
            int n;
            if (fo_0.do(for ? 1 : 0)) {
                Graphics graphics2 = graphics;
                fo_0 fo_02 = this;
                bx.do.if(graphics, this.try, this.char, this.case, this.if, do[4]);
                graphics.translate(this.try, this.char + this.goto);
                if (fo_0.new(this.if, do[1])) {
                    bx.do.int(graphics, do[27] * dH.this, this.if * this.byte, this.case - do[9] * dH.this, this.byte);
                }
                n = do[4];
                while (fo_0.try(n, fo_02.do.length)) {
                    bx.byte.do(graphics2, fo_02.do[n], fo_02.case / do[3], n * fo_02.byte + fo_02.byte / do[3] - bx.byte.do() / do[3], do[3]);
                    ++n;
                    "".length();
                    if (-(20 + 58 - 64 + 150 ^ 14 + 66 - -4 + 77) < 0) continue;
                    return;
                }
                "".length();
                if ((0x24 ^ 0x21) <= 0) {
                    return;
                }
            } else if (fo_0.if(bx.do) && fo_0.do(this, bx.do)) {
                bx.do.if(graphics, this.try, this.char, this.case, this.if, do[4]);
                graphics.setClip(this.try + do[28], this.char + do[28], this.case - do[39], this.if - do[39]);
                if (fo_0.if(this.for.equals("") ? 1 : 0) && fo_0.if(gC.do().do[do[28]])) {
                    bx.do.do(graphics, "Hotline: " + this.for, this.try + this.case - do[39], this.char + this.if - dH.new - do[28], do[2]);
                }
                this.if.do(graphics);
                graphics.setClip(this.try + do[28], this.char + do[28], this.case - do[39], this.if - do[39]);
                n = bx.byte.do(bT.g + ":");
                if (fo_0.try(n, this.if.long - this.try)) {
                    n = (this.if.long - this.try - n) / do[3] + dH.break;
                    "".length();
                    if (-" ".length() == "  ".length()) {
                        return;
                    }
                } else {
                    n = this.if.long - n - do[27];
                }
                bx.do.do(graphics, bT.g, this.try + n, this.if.goto + this.if.for / do[3] - dH.new / do[3], do[4]);
                bx.do.do(graphics, bT.else + ":", this.try + n, this.int.goto + this.if.for / do[3] - dH.new / do[3], do[4]);
                if (fo_0.if(this.do ? 1 : 0)) {
                    bx.do.do(graphics, this.new, this.else, this.super, this.case);
                    "".length();
                    if ("   ".length() >= (0x90 ^ 0x94)) {
                        return;
                    }
                } else {
                    bx.do.do(graphics, bT.w, this.try + n, this.for.goto + this.if.for / do[3] - dH.new, do[4]);
                    bx.do.do(graphics, bT.else + ":", this.try + n, this.for.goto + this.if.for / do[3], do[4]);
                    bx.do.do(graphics, "S\u1ed1 di \u0111\u1ed9ng", this.try + n, this.do.goto + this.if.for / do[3] - dH.new, do[4]);
                    bx.do.do(graphics, "ho\u1eb7c email:", this.try + n, this.do.goto + this.if.for / do[3], do[4]);
                    this.for.do(graphics);
                    this.do.do(graphics);
                }
                this.int.do(graphics);
            }
            if (fo_0.do(ge_0.if ? 1 : 0) && fo_0.int(fo_0.do(this.if, 0L)) && fo_0.int(n = (int)((this.do - (l = System.currentTimeMillis() - this.if)) / 1000L))) {
                bx.int.do(graphics, "\u0110\u0103ng nh\u1eadp l\u1ea1i sau: " + fo_0.do(n), this.case / do[3], do[5] * this.byte + this.byte / do[3] - bx.byte.do() / do[3] + do[27], do[3]);
            }
            bx.if(graphics);
            graphics.drawImage(ep.case, bx.long, this.long, do[5]);
            return;
        }
        if (fo_0.do(br_0.do)) {
            graphics.drawImage(br_0.do, bx.long, bx.else - do[40], do[5]);
        }
    }

    private static boolean int(int n) {
        return n > 0;
    }

    public static void if() {
        Vector<fn_0> vector = new Vector<fn_0>();
        vector.addElement(new fn_0("Th\u00eam ho\u1eb7c s\u1eeda TK", new j_0()));
        vector.addElement(new fn_0("Nh\u1eadp t\u1eeb file n\u1ed9i b\u1ed9", new k(do[2])));
        vector.addElement(new fn_0("Nh\u1eadp t\u1eeb file tr\u00ean m\u00e1y", new k(do[5])));
        if (fo_0.int(do, do[2])) {
            vector.addElement(new fn_0("Xu\u1ea5t ra file text", new k(do[28])));
        }
        vector.addElement(new fn_0("X\u00f3a h\u1ebft TK \u0111\u00e3 l\u01b0u", new k(do[27])));
        vector.addElement(new fn_0("X\u00f3a r\u00e1c d\u1eef li\u1ec7u TK", new k(do[29])));
        as.do().do(vector, do[4]);
    }

    public final void do(String string) {
        this.for = string;
    }

    public final void try() {
        this.b_();
        super.try();
        bx.case();
        if (fo_0.do(bx.for ? 1 : 0)) {
            this.if = (byte)do[1];
        }
        for = do[2];
        ((ep)this).new = this.if;
        if (fo_0.do(this.new.equals("") ? 1 : 0) && fo_0.do(this.if.do().equals("") ? 1 : 0)) {
            String[] stringArray = new String[do[3]];
            stringArray[fo_0.do[4]] = "Ch\u01a1i m\u1edbi";
            stringArray[fo_0.do[2]] = "\u0110\u1ed5i t\u00e0i kho\u1ea3n";
            this.do = stringArray;
            "".length();
            if (-(0x39 ^ 0x3D) > 0) {
                return;
            }
        } else {
            String string;
            String[] stringArray = new String[do[5]];
            int n = do[4];
            StringBuffer stringBuffer = new StringBuffer().append("Ch\u01a1i ti\u1ebfp");
            if (fo_0.if(this.if.do().equals("") ? 1 : 0)) {
                string = ", " + this.if.do();
                "".length();
                if (((32 + 132 - 59 + 145 ^ 158 + 160 - 201 + 57) & (43 + 123 - -11 + 45 ^ 77 + 19 - 73 + 115 ^ -" ".length())) > " ".length()) {
                    return;
                }
            } else {
                string = "";
            }
            stringArray[n] = stringBuffer.append(string).toString();
            stringArray[fo_0.do[2]] = "Ch\u01a1i m\u1edbi";
            stringArray[fo_0.do[3]] = "\u0110\u1ed5i t\u00e0i kho\u1ea3n";
            this.do = stringArray;
        }
        if (fo_0.if(this.byte ? 1 : 0)) {
            this.int = aq_0.do().do();
            this.for = System.currentTimeMillis();
        }
        aq_0.break();
        if (fo_0.do(cU.if ? 1 : 0) && fo_0.if(bx.do)) {
            bx.int();
        }
    }

    private static boolean for(int n, int n2) {
        return n > n2;
    }

    public final void for() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeUTF("2.5.8");
            dataOutputStream.writeByte(this.class);
            dataOutputStream.writeUTF(this.for);
            dataOutputStream.writeUTF(this.new);
            dataOutputStream.writeUTF(this.try);
            if (fo_0.do(this.case ? 1 : 0)) {
                dataOutputStream.writeUTF(fo_0.do().if.do());
                dataOutputStream.writeUTF(fo_0.do().int.do());
            }
            dataOutputStream.writeInt(for);
            dataOutputStream.writeBoolean(int);
            dataOutputStream.writeBoolean(if);
            hi.do("avlogin", byteArrayOutputStream.toByteArray());
            dataOutputStream.close();
            return;
        }
        catch (Exception exception) {
            exception.printStackTrace();
            return;
        }
    }

    public final void case() {
        block6: {
            DataInputStream dataInputStream = ac_0.do("avlogin");
            if (!fo_0.do(dataInputStream)) break block6;
            String string = "";
            try {
                string = dataInputStream.readUTF();
                this.class = dataInputStream.readByte();
                this.for = dataInputStream.readUTF();
                this.new = dataInputStream.readUTF();
                this.try = dataInputStream.readUTF();
                if (fo_0.do(this.case ? 1 : 0)) {
                    this.if.do(dataInputStream.readUTF());
                    this.int.do(dataInputStream.readUTF());
                }
                for = dataInputStream.readInt();
                int = dataInputStream.readBoolean();
                if = dataInputStream.readBoolean();
                dataInputStream.close();
                "".length();
            }
            catch (Exception exception) {
                "".length();
                ac_0.do("avlogin");
            }
            if ("   ".length() > (0x2C ^ 0x28)) {
                return;
            }
            if (fo_0.if(int ? 1 : 0)) {
                ac_0.do("avatarSV");
            }
            if (fo_0.if("2.5.8".equals(string) ? 1 : 0)) {
                ac_0.do();
            }
        }
    }

    public final void char() {
        if (fo_0.for(bx.new, do[13])) {
            this.throw = bx.else - do[17];
            "".length();
            if (-"   ".length() > 0) {
                return;
            }
        } else {
            this.throw = bx.else - do[18];
        }
        this.long = do[10];
        this.int = bx.char - do[12];
        if (fo_0.try(this.int, do[19])) {
            this.int = do[19];
        }
        if (fo_0.for(this.int, do[20])) {
            this.int = do[20];
        }
        this.do = (bx.char - this.int >> do[2]) + do[21];
        if (fo_0.do(bx.char, do[22])) {
            this.int = do[17];
            this.do = (bx.char - this.int >> do[2]) + do[23];
        }
        this.do -= (dH.this - do[2]) * do[24];
        bx.do.do(this);
        this.long = this.throw = this.char / do[3];
        fq.do().do = AngelChip.do;
        fq.do().do();
    }

    private static boolean int(int n, int n2) {
        return n == n2;
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private void void() {
        switch (this.if) {
            case 0: {
                if (fo_0.int(this.do.length, do[3])) {
                    new u().do();
                    return;
                }
                if (fo_0.do(if ? 1 : 0)) {
                    gx_0.do().try();
                    return;
                }
                String string = this.if.do().toLowerCase().trim();
                String string2 = this.int.do();
                if (fo_0.if(string.equals("") ? 1 : 0)) {
                    if (fo_0.do(string2.equals("") ? 1 : 0)) {
                        this.super = do[2];
                        this.if.do(do[4]);
                        this.int.do(do[2]);
                        return;
                    }
                    gx_0.do().try();
                }
                return;
            }
            case 1: {
                if (fo_0.new(this.do.length, do[3])) {
                    u u2 = new u();
                    if (fo_0.if(this.new.equals("") ? 1 : 0) && fo_0.do(this.if.do().equals("") ? 1 : 0)) {
                        bx.do("T\u00e0i kho\u1ea3n c\u1ee7a b\u1ea1n ch\u01b0a \u0111\u01b0\u1ee3c \u0111\u0103ng k\u00ed li\u00ean k\u1ebft v\u1edbi m\u1ed9t t\u00e0i kho\u1ea3n Team. B\u1ea1n s\u1ebd m\u1ea5t t\u00e0i kho\u1ea3n \u0111ang ch\u01a1i n\u1ebfu ti\u1ebfp t\u1ee5c. B\u1ea1n c\u00f3 mu\u1ed1n ti\u1ebfp t\u1ee5c ?", u2);
                        return;
                    }
                    u2.do();
                    return;
                }
            }
            case 2: {
                fo_0 fo_02 = this;
                ea_0 ea_02 = new ea_0(fo_02);
                if (fo_0.if(fo_02.new.equals("") ? 1 : 0) && fo_0.do(fo_02.if.do().equals("") ? 1 : 0)) {
                    bx.do("T\u00e0i kho\u1ea3n c\u1ee7a b\u1ea1n ch\u01b0a \u0111\u01b0\u1ee3c \u0111\u0103ng k\u00ed li\u00ean k\u1ebft v\u1edbi m\u1ed9t t\u00e0i kho\u1ea3n Team. B\u1ea1n s\u1ebd m\u1ea5t t\u00e0i kho\u1ea3n \u0111ang ch\u01a1i n\u1ebfu ti\u1ebfp t\u1ee5c. B\u1ea1n c\u00f3 mu\u1ed1n ti\u1ebfp t\u1ee5c ?", ea_02);
                    return;
                }
                ea_02.do();
            }
        }
    }

    public final void else() {
        bx.byte();
        fv_0.do().this(fo_0.do().for.hashCode());
        if (!(fo_0.do(for ? 1 : 0) && (fo_0.if(this.if) && !fo_0.new(this.do.length, do[3]) || fo_0.int(this.if, do[2]) && !fo_0.new(this.do.length, do[5])))) {
            if (fo_0.do(this.if.do().equals("") ? 1 : 0)) {
                fv_0.do().do(this.new, this.try, "2.5.8");
                if = do[2];
                return;
            }
            if = do[4];
            this.new = "";
            this.try = "";
            fv_0.do().do(this.if.do().toLowerCase(), this.int.do(), "2.5.8");
            return;
        }
        fv_0 fv_02 = fv_0.do();
        fv_02.do(do[41]);
        fv_02.if();
    }

    public final void int() {
        bx.do(bT.bE, do[0]);
    }

    private static boolean if(Object object) {
        return object == null;
    }

    private static boolean new(int n, int n2) {
        return n != n2;
    }

    public final void do(Graphics graphics) {
        this.if(graphics);
        super.do(graphics);
    }

    public static String do(int n) {
        String string;
        String string2;
        String string3;
        int n2 = n % do[6];
        int n3 = n / do[6] % do[6];
        n = n / do[7] % do[8];
        StringBuffer stringBuffer = new StringBuffer();
        if (fo_0.try(n, do[9])) {
            string3 = "0";
            "".length();
            if (-(94 + 52 - 129 + 146 ^ 12 + 104 - 106 + 157) >= 0) {
                return null;
            }
        } else {
            string3 = "";
        }
        String string4 = stringBuffer.append(string3).append(n).toString();
        StringBuffer stringBuffer2 = new StringBuffer();
        if (fo_0.try(n3, do[9])) {
            string2 = "0";
            "".length();
            if (" ".length() < 0) {
                return null;
            }
        } else {
            string2 = "";
        }
        String string5 = stringBuffer2.append(string2).append(n3).toString();
        StringBuffer stringBuffer3 = new StringBuffer();
        if (fo_0.try(n2, do[9])) {
            string = "0";
            "".length();
            if ((0x22 ^ 0x26) == 0) {
                return null;
            }
        } else {
            string = "";
        }
        String string6 = stringBuffer3.append(string).append(n2).toString();
        if (fo_0.int(n)) {
            return string4 + ":" + string5 + ":" + string6;
        }
        if (fo_0.int(n3)) {
            return string5 + ":" + string6;
        }
        return string6;
    }

    private static int if(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public final void goto() {
        System.currentTimeMillis();
        f_0.do(bT.da);
        f_0.do();
        this.long = do[10];
        try {
            bx.do.do(do[11]);
            "".length();
        }
        catch (Exception exception) {
            "".length();
        }
        if (null != null) {
            return;
        }
        int n = fj.if * do[8] / do[3] + do[12];
        AngelChip.do.else = (byte)n;
        AngelChip.do.int = (Vector)n;
        fq.do().if = fq.do().do = do[13];
        this.if.do(do[2]);
        this.int.do(do[4]);
        this.super = do[4];
        this.if.do(do[2]);
    }

    private static boolean new(int n) {
        return n >= 0;
    }

    private static void break() {
        do = new int[42];
        fo_0.do[0] = 0x40 ^ 1 ^ (0xE9 ^ 0x9E);
        fo_0.do[1] = -" ".length();
        fo_0.do[2] = " ".length();
        fo_0.do[3] = "  ".length();
        fo_0.do[4] = (0x1B ^ 0x3C ^ (0xF6 ^ 0x8D)) & (0x3D ^ 0x64 ^ (6 ^ 3) ^ -" ".length());
        fo_0.do[5] = "   ".length();
        fo_0.do[6] = 0x76 ^ 4 ^ (0xFC ^ 0xB2);
        fo_0.do[7] = -(0xFFFFF0D7 & 0x7FED) & (0xFFFFFED5 & 0x7FFE);
        fo_0.do[8] = 0xD ^ 0x15;
        fo_0.do[9] = 0xAD ^ 0xAB ^ (0x19 ^ 0x15);
        fo_0.do[10] = -(0x54 ^ 0x66);
        fo_0.do[11] = 0x75 ^ 0x54 ^ (0x83 ^ 0xB8);
        fo_0.do[12] = 0x3E ^ 0x20;
        fo_0.do[13] = 41 + 135 - 40 + 64;
        fo_0.do[14] = 0xAC ^ 0xAA ^ (0xC6 ^ 0xA8);
        fo_0.do[15] = 0xD ^ 0x51 ^ (0x23 ^ 0x16);
        fo_0.do[16] = 0xD ^ 0x67;
        fo_0.do[17] = 0x67 ^ 3 ^ (0x8D ^ 0xB9);
        fo_0.do[18] = 0xE ^ 0x60 ^ (0xA7 ^ 0x88);
        fo_0.do[19] = 0xFA ^ 0xBE ^ "  ".length();
        fo_0.do[20] = 0x6F ^ 0xC;
        fo_0.do[21] = 0x40 ^ 0x5D ^ (0x79 ^ 0x4E) & ~(0x15 ^ 0x22);
        fo_0.do[22] = (0x24 ^ 0x20) + (0x68 ^ 0x43) - (0x3F ^ 0x1C) + (0xD7 ^ 0xA3);
        fo_0.do[23] = 0xBB ^ 0xAF;
        fo_0.do[24] = 0x27 ^ 0xF;
        fo_0.do[25] = 0xD0 ^ 0xBB ^ (0x2F ^ 0x73);
        fo_0.do[26] = 0x6A ^ 0xE;
        fo_0.do[27] = 0xF4 ^ 0xBC ^ (0x5B ^ 0x16);
        fo_0.do[28] = 0x6F ^ 0x6B;
        fo_0.do[29] = 0x59 ^ 0x5E;
        fo_0.do[30] = 132 + 102 - 169 + 83 ^ 55 + 112 - 32 + 52;
        fo_0.do[31] = 99 + 134 - 202 + 108 ^ 86 + 116 - 138 + 102;
        fo_0.do[32] = 0x7B ^ 0x55;
        fo_0.do[33] = 0x4A ^ 0x6A ^ (0x21 ^ 8);
        fo_0.do[34] = 20 + 57 - 67 + 197 ^ 140 + 16 - 137 + 150;
        fo_0.do[35] = 0x58 ^ 0x6B;
        fo_0.do[36] = 0x5B ^ 0x6F;
        fo_0.do[37] = 0xA8 ^ 0x9D;
        fo_0.do[38] = 134 + 127 - 249 + 126 ^ 129 + 80 - 190 + 121;
        fo_0.do[39] = 0xE4 ^ 0x95 ^ (0xEB ^ 0x92);
        fo_0.do[40] = 0xA2 ^ 0x90;
        fo_0.do[41] = -(0x87 ^ 0x8B);
    }

    public final void if(int n, int n2) {
        switch (n) {
            case 0: {
                Vector<fn_0> vector = new Vector<fn_0>();
                fn_0 fn_02 = new fn_0(bT.bg, do[3]);
                if (!fo_0.if(ge_0.if ? 1 : 0) || fo_0.do(ge_0.do ? 1 : 0)) {
                    vector.addElement(new fn_0("T\u1eaft Auto", do[30]));
                    "".length();
                    if (((0xB8 ^ 0xBE ^ (0x38 ^ 0x26)) & (0xFF ^ 0xBA ^ (0x4B ^ 0x16) ^ -" ".length())) != 0) {
                        return;
                    }
                } else {
                    if (fo_0.if(this.if.do().equals("") ? 1 : 0) && fo_0.if(this.int.do().equals("") ? 1 : 0)) {
                        vector.addElement(new fn_0("L\u01b0u TK hi\u1ec7n t\u1ea1i", do[31]));
                    }
                    vector.addElement(new fn_0("Chuy\u1ec3n TK", new cy_0()));
                    vector.addElement(new fn_0("Qu\u1ea3n l\u00fd TK", do[32]));
                }
                vector.addElement(new fn_0("Ki\u1ec3u g\u00f5 TV", do[30], gs_0.do()));
                vector.addElement(new fn_0(bT.aV, do[28]));
                vector.addElement(new fn_0(bT.cp, do[27]));
                vector.addElement(new fn_0(bT.bX, do[33]));
                vector.addElement(fn_02);
                as.do().do(vector, do[4]);
                return;
            }
            case 1: {
                String string;
                for = do[2];
                ((ep)this).try = this.do;
                ((ep)this).new = this.if;
                this.if = (byte)do[4];
                String[] stringArray = new String[do[5]];
                int n3 = do[4];
                StringBuffer stringBuffer = new StringBuffer().append("Ch\u01a1i ti\u1ebfp");
                if (fo_0.if(this.if.do().equals("") ? 1 : 0)) {
                    string = ", " + this.if.do();
                    "".length();
                    if ("   ".length() == 0) {
                        return;
                    }
                } else {
                    string = "";
                }
                stringArray[n3] = stringBuffer.append(string).toString();
                stringArray[fo_0.do[2]] = "Ch\u01a1i m\u1edbi";
                stringArray[fo_0.do[3]] = "\u0110\u1ed5i t\u00e0i kho\u1ea3n";
                this.do = stringArray;
                return;
            }
            case 2: {
                this.long();
                return;
            }
            case 3: {
                if (fo_0.do(this.if.do().equals("") ? 1 : 0)) {
                    bx.int(bT.final[do[4]]);
                    return;
                }
                if (fo_0.do(this.int.do().equals("") ? 1 : 0)) {
                    bx.int(bT.final[do[2]]);
                    return;
                }
                if (fo_0.do(this.for.do().equals("") ? 1 : 0)) {
                    bx.int(bT.final[do[3]]);
                    return;
                }
                if (fo_0.if(this.int.do().equals(this.for.do()) ? 1 : 0)) {
                    bx.int(bT.final[do[5]]);
                    return;
                }
                bx.case();
                System.currentTimeMillis();
                if (fo_0.do(this.do.do().equals("") ? 1 : 0)) {
                    fo_0.catch();
                    return;
                }
                bx.do("B\u1ea1n n\u00ean \u0111i\u1ec1n ch\u00ednh x\u00e1c s\u1ed1 di \u0111\u1ed9ng ho\u1eb7c email. Khi qu\u00ean m\u1eadt kh\u1ea9u, b\u1ea1n s\u1ebd d\u00f9ng n\u00f3 \u0111\u1ec3 l\u1ea5y l\u1ea1i. B\u1ea1n c\u00f3 ch\u1eafc ch\u1eafn \u0111\u00e3 \u0111i\u1ec1n s\u1ed1 di \u0111\u1ed9ng / email \u0111\u00fang ch\u01b0a?", do[34]);
                return;
            }
            case 50: {
                bx.int(bT.abstract);
                return;
            }
            case 51: {
                this.this();
                return;
            }
            case 52: {
                return;
            }
            case 53: {
                AngelChip.do("http://teamobi.com/dieukhoan.htm");
                return;
            }
            case 54: {
                AngelChip.do();
                return;
            }
            case 55: {
                int = do[4];
                this.for();
                ac_0.do("avatarSV");
                AngelChip.do();
                return;
            }
            case 100: {
                String string = bx.do.do.do();
                if (fo_0.do(string.equals("") ? 1 : 0)) {
                    return;
                }
                new ck_0(string).do();
                return;
            }
            case 101: {
                this.this();
                return;
            }
            case 102: {
                fo_0.catch();
                return;
            }
            case 103: {
                return;
            }
            case 104: {
                this.void();
                return;
            }
            case 105: {
                aq_0.do();
                "".length();
                aq_0.int();
                AngelChip.do();
                return;
            }
            case 106: {
                aq_0.do();
                "".length();
                aq_0.int();
                if (fo_0.do(this.do)) {
                    new bc_0(this.do).do();
                    return;
                }
                new bc_0(br_0.do(do[5])).do();
            }
        }
    }

    public final void byte() {
        if (fo_0.int(fo_0.if((System.currentTimeMillis() - this.int) / 1000L, 300L))) {
            this.int = System.currentTimeMillis();
            String string = br_0.do(br_0.do + do[38]);
            if (fo_0.do(string) && fo_0.int(string.length())) {
                bx.do(string);
            }
        }
        if (fo_0.if(cU.if ? 1 : 0) && fo_0.do(aq_0.do)) {
            if (fo_0.if(for ? 1 : 0) && fo_0.do(this, bx.do) && fo_0.if(bx.do)) {
                this.if.do();
                this.int.do();
                if (fo_0.do(this.do ? 1 : 0)) {
                    this.for.do();
                    this.do.do();
                }
                if (fo_0.do(this.if.do() ? 1 : 0)) {
                    ((ep)this).int = this.if.do();
                    "".length();
                    if (" ".length() >= (0xBA ^ 0xBE)) {
                        return;
                    }
                } else if (fo_0.do(this.int.do() ? 1 : 0)) {
                    ((ep)this).int = this.int.do();
                    "".length();
                    if (((0x6F ^ 0x34 ^ (0xB6 ^ 0xA8)) & (0x98 ^ 0xA7 ^ (0x23 ^ 0x59) ^ -" ".length())) != 0) {
                        return;
                    }
                } else if (fo_0.do(this.for.do() ? 1 : 0)) {
                    ((ep)this).int = this.for.do();
                    "".length();
                    if (((0xF3 ^ 0x94 ^ (0x72 ^ 5)) & (0x22 ^ 0x68 ^ (0x77 ^ 0x2D) ^ -" ".length())) < 0) {
                        return;
                    }
                }
            } else {
                ((ep)this).int = null;
            }
            if (fo_0.new(this.throw, this.long)) {
                this.long += this.throw - this.long >> do[2];
            }
            if (fo_0.do(this.do ? 1 : 0)) {
                ((ep)this).new = this.byte;
                "".length();
                if ("   ".length() == " ".length()) {
                    return;
                }
            } else if (fo_0.int(this.super, do[3])) {
                ((ep)this).int = this.else;
            }
            if (fo_0.if(this.byte ? 1 : 0) && fo_0.new(fo_0.if(System.currentTimeMillis() - this.for, 1000L))) {
                this.byte = do[2];
                aq_0.do();
                "".length();
                aq_0.if(this.int);
                "".length();
                if (null != null) {
                    return;
                }
            }
        } else {
            ((ep)this).new = null;
            ((ep)this).try = this.char;
            ((ep)this).int = this.case;
        }
        bx.do.int();
    }

    public final void do(String string, String string2) {
        this.new = string;
        this.try = string2;
        this.if.do("");
        this.int.do("");
        if = do[2];
        for = do[4];
        this.else();
    }

    private static void catch() {
        Vector<fn_0> vector = new Vector<fn_0>();
        vector.addElement(new fn_0(bT.const, do[35]));
        vector.addElement(new fn_0(bT.bp, do[36]));
        vector.addElement(new fn_0(bT.bz, do[37]));
        bx.do(bT.cZ, vector);
    }

    private static boolean try(int n, int n2) {
        return n < n2;
    }

    public final void new() {
        if (!fo_0.if(cU.if ? 1 : 0) || fo_0.if(aq_0.do)) {
            super.new();
            return;
        }
        if (fo_0.do(for ? 1 : 0)) {
            fo_0 fo_02 = this;
            if (fo_0.do(bx.do(do[3]) ? 1 : 0)) {
                this.if = (byte)(this.if - do[2]);
                if (fo_0.for(this.if)) {
                    this.if = (byte)(this.do.length - do[2]);
                    "".length();
                    if (-" ".length() > "  ".length()) {
                        return;
                    }
                }
            } else if (fo_0.do(bx.do(do[39]) ? 1 : 0)) {
                this.if = (byte)(this.if + do[2]);
                if (fo_0.if(this.if, this.do.length)) {
                    this.if = (byte)do[4];
                }
            }
            if (fo_0.do(bx.if ? 1 : 0)) {
                int n = do[4];
                while (fo_0.try(n, fo_02.do.length)) {
                    if (fo_0.do(bx.if(fo_02.try, fo_02.char + fo_02.goto + n * fo_02.byte, fo_02.case, fo_02.byte) ? 1 : 0)) {
                        fo_02.if = (byte)n;
                        bx.if = do[4];
                        fo_02.try = do[2];
                        "".length();
                        if ("  ".length() != 0) break;
                        return;
                    }
                    ++n;
                    "".length();
                    if ("   ".length() >= 0) continue;
                    return;
                }
            }
            if (fo_0.do(fo_02.try ? 1 : 0)) {
                if (fo_0.do(bx.try ? 1 : 0) && fo_0.if(bx.if(fo_02.try, fo_02.char + fo_02.goto + fo_02.if * fo_02.byte, fo_02.case, fo_02.byte) ? 1 : 0)) {
                    fo_02.if = (byte)do[1];
                }
                if (fo_0.do(bx.byte ? 1 : 0)) {
                    bx.byte = do[4];
                    fo_02.try = do[4];
                    if (fo_0.new(fo_02.if, do[1])) {
                        fo_02.void();
                    }
                }
            }
            super.new();
            return;
        }
        if (fo_0.do(bx.byte ? 1 : 0) && fo_0.do(bx.do(do[4], do[4], bx.char, bx.new) ? 1 : 0) && fo_0.do(bx.do(this.new - do[9], this.else, do[19], ep.const * dH.this + do[9]) ? 1 : 0)) {
            this.long();
        }
        if (fo_0.do(bx.if[do[3]])) {
            if (fo_0.int(this.super)) {
                this.super -= do[2];
                "".length();
                if ("   ".length() < 0) {
                    return;
                }
            } else if (fo_0.do(this.do ? 1 : 0)) {
                this.super = do[5];
                "".length();
                if (-(0x56 ^ 0x20 ^ (0xC4 ^ 0xB6)) >= 0) {
                    return;
                }
            } else {
                this.super = do[3];
            }
        }
        if (fo_0.do(bx.if[do[39]])) {
            int n;
            if (fo_0.do(this.do ? 1 : 0)) {
                n = do[5];
                "".length();
                if (null != null) {
                    return;
                }
            } else {
                n = do[3];
            }
            if (fo_0.try(this.super, n)) {
                this.super += do[2];
                "".length();
                if (-" ".length() >= " ".length()) {
                    return;
                }
            } else {
                this.super = do[4];
            }
        }
        if (!fo_0.if(bx.if[do[3]]) || fo_0.do(bx.if[do[39]])) {
            bx.new();
            if (fo_0.if(this.super)) {
                this.if.do(do[2]);
                this.int.do(do[4]);
                this.for.do(do[4]);
                this.do.do(do[4]);
                "".length();
                if (-"   ".length() > 0) {
                    return;
                }
            } else if (fo_0.int(this.super, do[2])) {
                this.if.do(do[4]);
                this.int.do(do[2]);
                this.for.do(do[4]);
                this.do.do(do[4]);
                "".length();
                if (((0x5E ^ 0x68) & ~(0xF0 ^ 0xC6)) != 0) {
                    return;
                }
            } else if (fo_0.int(this.super, do[3])) {
                this.if.do(do[4]);
                this.int.do(do[4]);
                ((ep)this).int = null;
                if (fo_0.do(this.do ? 1 : 0)) {
                    this.for.do(do[2]);
                    this.do.do(do[4]);
                    "".length();
                    if (-" ".length() == "  ".length()) {
                        return;
                    }
                }
            } else {
                this.if.do(do[4]);
                this.int.do(do[4]);
                this.for.do(do[4]);
                this.do.do(do[2]);
            }
        }
        super.new();
    }

    public static fo_0 do() {
        if (fo_0.if(do)) {
            do = new fo_0();
        }
        return do;
    }

    public final void if(int n) {
        if (fo_0.if(cU.if ? 1 : 0) && fo_0.do(aq_0.do)) {
            if (fo_0.do(this.if.do() ? 1 : 0)) {
                this.if.do(n);
                "".length();
                "".length();
                if ((0xC3 ^ 0xC7) <= " ".length()) {
                    return;
                }
            } else if (fo_0.do(this.int.do() ? 1 : 0)) {
                this.int.do(n);
                "".length();
                "".length();
                if (((0x58 ^ 0x37 ^ (0xA3 ^ 0xC4)) & (67 + 162 - 60 + 6 ^ 52 + 10 - 38 + 143 ^ -" ".length())) < -" ".length()) {
                    return;
                }
            } else if (fo_0.do(this.for.do() ? 1 : 0)) {
                this.for.do(n);
                "".length();
                "".length();
                if (" ".length() == "   ".length()) {
                    return;
                }
            } else if (fo_0.do(this.do.do() ? 1 : 0)) {
                this.do.do(n);
                "".length();
            }
        }
        super.if(n);
    }
}

