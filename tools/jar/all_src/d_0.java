/*
 * Decompiled with CFR 0.152.
 */
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from d
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class d_0
extends hc {
    public static int do;
    private long byte;
    private static final int[] do;
    public static long do;
    public static int if;
    public static int for;
    private static final int[] if;
    private boolean new;
    public static long if;
    public static boolean do;
    public static boolean if;
    public static boolean for;
    private long case;
    public static int int;
    public static long for;
    private long char;
    public static int new;
    private boolean try;
    public static int try;
    public static boolean int;

    private static boolean do(int n, int n2) {
        return n <= n2;
    }

    private static void new() {
        int n;
        int n2;
        int n3 = do[1];
        aq_0.do = null;
        fp.do().if(do[5]);
        if (d_0.int(aq_0.int(5000L) ? 1 : 0)) {
            if (d_0.do(aq_0.do) && d_0.if(aq_0.do.length)) {
                if (d_0.int(int, aq_0.do.length)) {
                    int = aq_0.do.length - do[2];
                }
                n2 = int;
                while (d_0.int(n2, try)) {
                    if (d_0.if(aq_0.do[n2])) {
                        n3 = n2;
                        "".length();
                        if (-"   ".length() <= 0) break;
                        return;
                    }
                    --n2;
                    "".length();
                    if (((123 + 67 - 60 + 9 ^ 145 + 26 - 40 + 59) & (0x2C ^ 7 ^ (0x82 ^ 0x9C) ^ -" ".length())) == ((165 + 74 - 160 + 97 ^ 155 + 156 - 300 + 163) & (0x19 ^ 0x72 ^ (0xDF ^ 0xAA) ^ -" ".length()))) continue;
                    return;
                }
            }
            aq_0.do = null;
        }
        if (d_0.new(n3, do[1])) {
            n = n3;
            "".length();
            if (" ".length() == 0) {
                return;
            }
        } else {
            n = aq_0.do(try, int);
        }
        n2 = n;
        fj.int = do[12];
        fj.byte = do[13];
        fp.do().do(do[5], n2);
    }

    private static boolean do(int n) {
        return n < 0;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    private void try() {
        if (d_0.new(d_0.if(this.char, 0L))) {
            this.char = System.currentTimeMillis();
            this.byte = System.currentTimeMillis();
            return;
        }
        if (d_0.if(d_0.if(System.currentTimeMillis() - this.char, 180000L))) {
            int n;
            block8: {
                this.char = System.currentTimeMillis();
                do {
                    if (d_0.new(n = if[aq_0.do(do[0], if.length - do[2])], fj.new)) {
                        "".length();
                        if ((0xB2 ^ 0xB6) < "   ".length()) {
                            return;
                        }
                        break block8;
                    }
                    "".length();
                } while (null == null);
                return;
            }
            if (d_0.int(aq_0.try(n) ? 1 : 0)) {
                aq_0.if(3500L);
                return;
            }
        } else if (d_0.int(bx.do instanceof gs_0) && d_0.if(d_0.if(System.currentTimeMillis() - this.byte, 30000L))) {
            this.byte = System.currentTimeMillis();
            AngelChip.do.do((int)AngelChip.do.int, AngelChip.do.for ? 1 : 0);
            fp.do().do((int)AngelChip.do.int, AngelChip.do.for ? 1 : 0, do[6], do[0]);
        }
    }

    private static boolean for(int n, int n2) {
        return n > n2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean if(int n) {
        return n > 0;
    }

    public final void do(int n, String object) {
        if (!d_0.do(bx_0.do) || d_0.new(bx_0.do instanceof d_0)) {
            return;
        }
        if (d_0.int(do, do[3])) {
            return;
        }
        object = fj.do(n);
        if (d_0.do(object) && d_0.int(((eh)object).do.equals("tho.kim.hoan") ? 1 : 0)) {
            do = n;
            if = (int)((eh)object).int;
            for = ((eh)object).for ? 1 : 0;
        }
    }

    private static boolean int(int n, int n2) {
        return n >= n2;
    }

    /*
     * Loose catch block
     */
    static {
        block11: {
            d_0.byte();
            do = do[1];
            if = do[2];
            for = do[2];
            int = do[0];
            do = do[2];
            new = do[14];
            for = 100L;
            do = 0L;
            try = do[15];
            int = do[16];
            if = do[17];
            for = do[18];
            int[] nArray = new int[do[19]];
            nArray[d_0.do[0]] = do[0];
            nArray[d_0.do[2]] = do[2];
            nArray[d_0.do[6]] = do[6];
            nArray[d_0.do[8]] = do[8];
            nArray[d_0.do[7]] = do[7];
            nArray[d_0.do[20]] = do[20];
            nArray[d_0.do[21]] = do[21];
            nArray[d_0.do[9]] = do[9];
            nArray[d_0.do[10]] = do[10];
            nArray[d_0.do[11]] = do[22];
            nArray[d_0.do[22]] = do[19];
            if = nArray;
            Object object = cs.do("JewelSettings");
            if (!d_0.do(object)) break block11;
            object = new ByteArrayInputStream((byte[])object);
            DataInputStream dataInputStream = new DataInputStream((InputStream)object);
            new = dataInputStream.readInt();
            for = dataInputStream.readInt();
            try = dataInputStream.readInt();
            int = dataInputStream.readInt();
            if = dataInputStream.readBoolean();
            for = dataInputStream.readBoolean();
            int = dataInputStream.readBoolean();
            do = dataInputStream.readBoolean();
            try {
                dataInputStream.close();
                ((ByteArrayInputStream)object).close();
            }
            catch (IOException iOException) {
                "".length();
            }
            break block11;
            catch (IOException iOException) {
                "".length();
                cs.do("JewelSettings");
                try {
                    dataInputStream.close();
                    ((ByteArrayInputStream)object).close();
                }
                catch (IOException iOException2) {
                    "".length();
                }
                catch (Throwable throwable) {
                    try {
                        dataInputStream.close();
                        ((ByteArrayInputStream)object).close();
                        "".length();
                    }
                    catch (IOException iOException3) {
                        "".length();
                    }
                    if (((0xE0 ^ 0xA7 ^ (0xD5 ^ 0x98)) & (0x3E ^ 0x17 ^ (0x27 ^ 4) ^ -" ".length())) >= "  ".length()) {
                        break block11;
                    }
                    throw throwable;
                }
            }
        }
    }

    private static boolean new(int n, int n2) {
        return n != n2;
    }

    private static boolean for(int n) {
        return n >= 0;
    }

    public d_0() {
        d_0 d_02 = this;
        ((hc)d_02).int = 20L;
        d_02.case = System.currentTimeMillis();
        d_02.byte = System.currentTimeMillis();
        d_02.char = 0L;
        d_02.try = d_02.new = do[0];
        if = new * do[4];
        if (d_0.if(fj.new, do[5])) {
            AngelChip.do.do(if, for);
            fp.do().do(if, for, do[6], do[0]);
        }
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public final String toString() {
        return "Auto b\u00e1n \u0111\u00e1";
    }

    private static boolean int(int n) {
        return n != 0;
    }

    private static void byte() {
        do = new int[23];
        d_0.do[0] = (61 + 127 - 147 + 89 ^ 25 + 139 - 154 + 165) & (0x20 ^ 0x1A ^ (0xA1 ^ 0xB6) ^ -" ".length());
        d_0.do[1] = -" ".length();
        d_0.do[2] = " ".length();
        d_0.do[3] = 0xFFFFDF24 & 0x7735B4DB;
        d_0.do[4] = 0xFFFFFB7E & 0xEEE1;
        d_0.do[5] = 0xF3 ^ 0xC0 ^ (0x60 ^ 0x44);
        d_0.do[6] = "  ".length();
        d_0.do[7] = 0x9C ^ 0xA2 ^ (0x82 ^ 0xB8);
        d_0.do[8] = "   ".length();
        d_0.do[9] = 30 + 107 - 14 + 39 ^ 140 + 54 - 67 + 38;
        d_0.do[10] = 0x2C ^ 0x24;
        d_0.do[11] = 0x6B ^ 0x62;
        d_0.do[12] = -(0xFFFFFF95 & 0x7DEB) & (0xFFFFFFF7 & 0x7FDA);
        d_0.do[13] = 59 + 13 - -38 + 46;
        d_0.do[14] = 0x54 ^ 0x18 ^ (0xE0 ^ 0xA3);
        d_0.do[15] = 0x18 ^ 0xC;
        d_0.do[16] = 0x27 ^ 0x68;
        d_0.do[17] = 0xFFFFF7BD & 0xAEF;
        d_0.do[18] = 83 + 165 - 155 + 92 ^ 71 + 65 - 108 + 101;
        d_0.do[19] = 122 + 17 - 5 + 12 ^ 72 + 123 - 183 + 141;
        d_0.do[20] = 0x8E ^ 0x8B;
        d_0.do[21] = 0x2F ^ 0x29;
        d_0.do[22] = 0x7D ^ 0x2E ^ (0x6F ^ 0x36);
    }

    private static boolean new(int n) {
        return n == 0;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void do() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeInt(new);
            dataOutputStream.writeInt((int)for);
            dataOutputStream.writeInt(try);
            dataOutputStream.writeInt(int);
            dataOutputStream.writeBoolean(if);
            dataOutputStream.writeBoolean(for);
            dataOutputStream.writeBoolean(int);
            dataOutputStream.writeBoolean(do);
            dataOutputStream.flush();
            byteArrayOutputStream.flush();
            cs.do("JewelSettings", byteArrayOutputStream.toByteArray());
        }
        catch (IOException iOException) {
            "".length();
            try {
                byteArrayOutputStream.close();
                dataOutputStream.close();
                return;
            }
            catch (IOException iOException2) {
                "".length();
                return;
            }
        }
        catch (Throwable throwable) {
            try {
                byteArrayOutputStream.close();
                dataOutputStream.close();
                "".length();
            }
            catch (IOException iOException) {
                "".length();
                throw throwable;
            }
            if ("   ".length() > "  ".length()) throw throwable;
            return;
        }
        try {
            byteArrayOutputStream.close();
            dataOutputStream.close();
            return;
        }
        catch (IOException iOException) {
            "".length();
            return;
        }
    }

    public final synchronized void if() {
        if (d_0.int(this.try ? 1 : 0) && d_0.int(this.new ? 1 : 0)) {
            bx.case();
            aq_0.if(1000L);
            bx_0.do();
            return;
        }
        if (d_0.if(d_0.do(System.currentTimeMillis() - this.try, 180000L))) {
            aq_0.else();
            aq_0.do(16000L);
            return;
        }
        if ((!d_0.new(bx.do instanceof gs_0) || d_0.int(bx.do.do(gs_0.do()) ? 1 : 0)) && d_0.if(fj.new, do[5])) {
            if (!d_0.int(gs_0.int, try) || d_0.for(gs_0.int, int)) {
                this.try();
                d_0.new();
                if (d_0.int(aq_0.else(5000L) ? 1 : 0)) {
                    aq_0.if(1000L);
                    AngelChip.do.do(if, for);
                    fp.do().do(if, for, do[6], do[0]);
                    this.case = System.currentTimeMillis();
                }
                return;
            }
            if (d_0.int(d_0.do(this.char, 0L))) {
                this.char = 0L;
            }
            if (d_0.for(d_0.do(do = System.currentTimeMillis() - this.case, if))) {
                if (d_0.int(if ? 1 : 0) && d_0.int(for ? 1 : 0)) {
                    super.do(do[7]);
                    "".length();
                    "".length();
                    if (" ".length() >= (0x2F ^ 0x66 ^ (0x7A ^ 0x37))) {
                        return;
                    }
                } else if (d_0.int(for ? 1 : 0)) {
                    super.do(do[8]);
                    "".length();
                    "".length();
                    if (null != null) {
                        return;
                    }
                } else if (d_0.int(if ? 1 : 0)) {
                    super.do(do[6]);
                    "".length();
                }
                this.try = do[2];
                this.new = do[2];
                return;
            }
            if (d_0.int(do, do[3])) {
                if (d_0.new(this.try ? 1 : 0)) {
                    aq_0.if(for);
                    fp.do().do(do, do[0], do[9]);
                }
                if (d_0.new(this.new ? 1 : 0)) {
                    aq_0.if(for);
                    fp.do().do(do, do[0], do[10]);
                }
                this.try = System.currentTimeMillis();
            }
            if (d_0.if(d_0.do(System.currentTimeMillis() - this.byte, 30000L))) {
                this.byte = System.currentTimeMillis();
                AngelChip.do.do(if, for);
                fp.do().do(if, for, do[6], do[0]);
                aq_0.if(1000L);
            }
            return;
        }
        if (d_0.int(bx.do instanceof fo_0)) {
            return;
        }
        if (d_0.int(bx.do instanceof er)) {
            er.do().for();
            return;
        }
        if (d_0.int(bx.do instanceof fs)) {
            fs.do().int();
            return;
        }
        if (d_0.int(bx.do instanceof gs_0) && d_0.new(aq_0.do(fj.new) ? 1 : 0)) {
            gs_0.do().return();
            aq_0.if(2000L);
            return;
        }
        if (d_0.int(bx.do instanceof gs_0) && !d_0.if(fj.new, do[5]) || d_0.int(bx.do instanceof aO)) {
            this.try();
            d_0.new();
            if (d_0.int(aq_0.else(15000L) ? 1 : 0) && d_0.if(fj.new, do[5]) && d_0.int(gs_0.int, try) && d_0.do(gs_0.int, int)) {
                aq_0.if(3500L);
                AngelChip.do.do(if, for);
                fp.do().do(if, for, do[6], do[0]);
                this.case = System.currentTimeMillis();
            }
            return;
        }
        if (!d_0.new(bx.do instanceof gK) || d_0.int(bx.do instanceof y_0)) {
            y_0.do.do(do[0]);
            if (d_0.int(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(2000L);
            }
            return;
        }
        if (d_0.int(bx.do instanceof q)) {
            bx.do.if = do[0];
            eb_0.do().do();
            if (d_0.int(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(2000L);
            }
            return;
        }
        if (d_0.int(bx.do instanceof fq_0)) {
            fv_0.do().int(do[11]);
            if (d_0.int(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(2000L);
            }
            return;
        }
        if (d_0.int(bx.do instanceof gQ)) {
            long l = System.currentTimeMillis() - ((hc)this).new;
            if (d_0.do(d_0.do(l, 2000L))) {
                aq_0.if(2000L - l);
            }
            if (d_0.int(aq_0.byte(do[5]) ? 1 : 0)) {
                aq_0.if(3500L);
            }
            return;
        }
        if (d_0.new(bx.do instanceof gs_0) && d_0.new(bx.do instanceof gQ) && d_0.new(bx.do instanceof aO)) {
            if (d_0.if(d_0.do(System.currentTimeMillis() - this.try, 60000L))) {
                aq_0.else();
                aq_0.do(16000L);
                return;
            }
            if (d_0.new(fj.new, do[1]) && d_0.new(aq_0.do(fj.new) ? 1 : 0)) {
                gs_0.do().return();
                aq_0.if(2000L);
            }
        }
    }

    public final boolean do(String string) {
        if (d_0.int(string.startsWith("Khu v\u1ef1c \u0111\u00e3 \u0111\u1ea7y") ? 1 : 0)) {
            this.try = System.currentTimeMillis();
            aq_0.for();
            return do[0];
        }
        String string2 = string.toLowerCase();
        if (d_0.int(string2.startsWith("b\u1ea1n \u0111\u00e3 h\u1ebft") ? 1 : 0)) {
            if (d_0.new(string2.indexOf("kim c\u01b0\u01a1ng xanh"), do[1])) {
                this.try = do[2];
                "".length();
                if ("   ".length() == 0) {
                    return ((0xC5 ^ 0x9E) & ~(0x15 ^ 0x4E)) != 0;
                }
            } else if (d_0.new(string2.indexOf("ng\u1ecdc huy\u1ec1n b\u00ed"), do[1])) {
                this.new = do[2];
                "".length();
                if (-"   ".length() > 0) {
                    return ((0x37 ^ 0x14 ^ (0x9D ^ 0xB8)) & (0xEE ^ 0x8C ^ (0x36 ^ 0x52) ^ -" ".length())) != 0;
                }
            }
        } else if ((!d_0.new(int ? 1 : 0) || d_0.int(do ? 1 : 0)) && d_0.int(string2.startsWith("ch\u00fac m\u1eebng b\u1ea1n \u0111\u00e3 b\u00e1n \u0111\u01b0\u1ee3c") ? 1 : 0)) {
            if (d_0.int(int ? 1 : 0) && d_0.new(string2.indexOf("kim c\u01b0\u01a1ng xanh"), do[1])) {
                this.case = System.currentTimeMillis();
                "".length();
                if (-" ".length() >= "   ".length()) {
                    return ((95 + 87 - 119 + 111 ^ 105 + 20 - 103 + 107) & (0 ^ 0x6E ^ (0x3B ^ 0x7A) ^ -" ".length())) != 0;
                }
            } else if (d_0.int(do ? 1 : 0) && d_0.new(string2.indexOf("ng\u1ecdc huy\u1ec1n b\u00ed"), do[1])) {
                this.case = System.currentTimeMillis();
                "".length();
                if ("   ".length() <= 0) {
                    return ((0xC1 ^ 0xAE ^ (0x49 ^ 0x72)) & (74 + 125 - 166 + 168 ^ 138 + 102 - 114 + 31 ^ -" ".length())) != 0;
                }
            }
        } else {
            super.do(string);
            "".length();
        }
        return do[2];
    }

    private static int if(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }
}

