/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from dy
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class dy_0
extends hc {
    private static final int[] do;
    private boolean do;
    private long do = do[0];
    public static final Vector do;
    public static final Vector if;

    private static boolean do(int n) {
        return n >= 0;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    static {
        block3: {
            block4: {
                String string;
                block2: {
                    block1: {
                        dy_0.byte();
                        if = new Vector();
                        do = new Vector();
                        string = cs.do("useItemLists");
                        if (!dy_0.do(string) || !dy_0.new(string.length())) break block1;
                        if (!dy_0.int(string.equals("-1") ? 1 : 0)) break block2;
                        dy_0.if(string);
                        "".length();
                        if ("   ".length() > " ".length()) break block2;
                        break block3;
                    }
                    if.addElement(new Short(do[5]));
                    if.addElement(new Short(do[6]));
                }
                if (!dy_0.do(string = cs.do("delItemLists")) || !dy_0.new(string.length())) break block4;
                if (!dy_0.int(string.equals("-1") ? 1 : 0)) break block3;
                dy_0.for(string);
                break block3;
            }
            int n = do[7];
            while (dy_0.if(n, do[8])) {
                do.addElement(new Short((short)n));
                ++n;
                "".length();
                if (-" ".length() != " ".length()) continue;
                break;
            }
        }
    }

    public final boolean do(String string) {
        String string2 = string.trim().toLowerCase();
        if (!dy_0.do(string2.indexOf("nh\u1eadn \u0111\u01b0\u1ee3c"), do[1]) || dy_0.for(string2.indexOf(". s\u1ed1 l\u01b0\u1ee3ng"), do[1])) {
            aq_0.char();
            return do[2];
        }
        if (dy_0.if(string2.startsWith("kh\u00f4ng t\u00ecm th\u1ea5y v\u1eadt ph\u1ea9m") ? 1 : 0)) {
            this.for = null;
            aq_0.char();
            return do[2];
        }
        if (!dy_0.int(string2.startsWith("kh\u00f4ng th\u1ec3 s\u1eed d\u1ee5ng") ? 1 : 0) || !dy_0.int(string2.startsWith("s\u1ed1 l\u01b0\u1ee3ng") ? 1 : 0) || dy_0.if(string2.equals("tr\u00ean ng\u01b0\u1eddi v\u00e0 trong r\u01b0\u01a1ng b\u1ea1n \u0111\u00e3 c\u00f3 v\u1eadt ph\u1ea9m gi\u1ed1ng nhau") ? 1 : 0)) {
            this.do = do[2];
            aq_0.char();
            return do[2];
        }
        return super.do(string);
    }

    public static boolean do(short s2) {
        if (dy_0.int(do.isEmpty() ? 1 : 0)) {
            int n = do[0];
            while (dy_0.int(n, do.size())) {
                if (dy_0.do(((Short)do.elementAt(n)).shortValue(), s2)) {
                    return do[2];
                }
                ++n;
                "".length();
                if ("  ".length() > " ".length()) continue;
                return ((4 ^ 0x30 ^ 4 + 72 - 7 + 58) & (104 + 41 - 97 + 184 ^ 109 + 104 - 150 + 100 ^ -" ".length())) != 0;
            }
        }
        return do[0];
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    public static void if(String stringArray) {
        block5: {
            if (dy_0.int(if.isEmpty() ? 1 : 0)) {
                if.removeAllElements();
            }
            if (!dy_0.do(stringArray = aq_0.if((String)stringArray)) || !dy_0.new(stringArray.length())) break block5;
            stringArray = aq_0.do((String)stringArray, ",");
            int n = do[0];
            while (dy_0.int(n, stringArray.length)) {
                try {
                    if.addElement(new Short(Short.parseShort(stringArray[n])));
                }
                catch (NumberFormatException numberFormatException) {
                    "".length();
                    if.addElement(new Short(do[1]));
                }
                "".length();
                if ("  ".length() >= (54 + 99 - 39 + 18 ^ 40 + 20 - -31 + 37)) {
                    return;
                }
                ++n;
                "".length();
                if ((0xE ^ 0x1A ^ (0x86 ^ 0x96)) >= "   ".length()) continue;
                return;
            }
        }
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public static boolean if(short s2) {
        if (dy_0.int(if.isEmpty() ? 1 : 0)) {
            int n = do[0];
            while (dy_0.int(n, if.size())) {
                if (dy_0.do(((Short)if.elementAt(n)).shortValue(), s2)) {
                    return do[2];
                }
                ++n;
                "".length();
                if (-" ".length() <= 0) continue;
                return ((0xD7 ^ 0x95) & ~(0xED ^ 0xAF)) != 0;
            }
        }
        return do[0];
    }

    public final void for() {
        super.for();
        this.for = null;
    }

    private static boolean if(int n, int n2) {
        return n <= n2;
    }

    public static void new() {
        String string = "";
        if (dy_0.int(do.isEmpty() ? 1 : 0)) {
            int n = do[0];
            while (dy_0.int(n, do.size())) {
                short s2 = (Short)do.elementAt(n);
                if (dy_0.do((int)s2)) {
                    if (dy_0.int(string.equals("") ? 1 : 0)) {
                        string = string + ",";
                    }
                    string = string + s2;
                }
                ++n;
                "".length();
                if ((5 ^ 0) != 0) continue;
                return;
            }
        }
        if (dy_0.int(string.equals("") ? 1 : 0)) {
            cs.if("delItemLists", string);
            return;
        }
        cs.if("delItemLists", "-1");
    }

    private static boolean for(int n) {
        return n < 0;
    }

    public static void try() {
        String string = "";
        if (dy_0.int(if.isEmpty() ? 1 : 0)) {
            int n = do[0];
            while (dy_0.int(n, if.size())) {
                short s2 = (Short)if.elementAt(n);
                if (dy_0.do((int)s2)) {
                    if (dy_0.int(string.equals("") ? 1 : 0)) {
                        string = string + ",";
                    }
                    string = string + s2;
                }
                ++n;
                "".length();
                if ("  ".length() > 0) continue;
                return;
            }
        }
        if (dy_0.int(string.equals("") ? 1 : 0)) {
            cs.if("useItemLists", string);
            return;
        }
        cs.if("useItemLists", "-1");
    }

    private static void byte() {
        do = new int[9];
        dy_0.do[0] = (0x9B ^ 0x92) & ~(0x61 ^ 0x68);
        dy_0.do[1] = -" ".length();
        dy_0.do[2] = " ".length();
        dy_0.do[3] = 18 + 70 - 83 + 133 ^ 112 + 57 - 49 + 37;
        dy_0.do[4] = "  ".length();
        dy_0.do[5] = 0xFFFF9FF7 & 0x6F7E;
        dy_0.do[6] = 0xFFFFD2ED & 0x3F1E;
        dy_0.do[7] = -(0x75 ^ 0x46) & (0xFFFFF77F & 0x1FFF);
        dy_0.do[8] = 0xFFFF9FD7 & 0x777A;
    }

    public final String toString() {
        return "Auto d\u00f9ng v\u1eadt ph\u1ea9m";
    }

    public dy_0() {
        dy_0 dy_02 = this;
        dy_02.do = System.currentTimeMillis();
        dy_02.for = null;
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean if(Object object) {
        return object == null;
    }

    public final synchronized void if() {
        if (dy_0.if(if.isEmpty() ? 1 : 0) && dy_0.if(do.isEmpty() ? 1 : 0)) {
            if (dy_0.do(((hc)this).do)) {
                bx_0.do();
                return;
            }
            bx_0.try();
            bx.if("Kh\u00f4ng c\u00f3 item n\u00e0o trong danh s\u00e1ch c\u00e0i \u0111\u1eb7t!");
            return;
        }
        if (dy_0.new(dy_0.do(System.currentTimeMillis() - this.try, 180000L))) {
            aq_0.else();
            aq_0.do(16000L);
            return;
        }
        if (dy_0.if(bx.do instanceof fo_0)) {
            return;
        }
        if (dy_0.if(bx.do instanceof er) && dy_0.do(fj.new, do[1])) {
            er.do().for();
            return;
        }
        if (dy_0.if(bx.do instanceof gQ)) {
            long l = System.currentTimeMillis() - this.new;
            if (dy_0.for(dy_0.do(l, 2000L))) {
                aq_0.if(2000L - l);
            }
            if (dy_0.if(aq_0.try(do[3]) ? 1 : 0)) {
                aq_0.if(3000L);
                this.do = System.currentTimeMillis();
            }
            return;
        }
        if (dy_0.new(dy_0.do(System.currentTimeMillis() - this.do, 30000L))) {
            this.do = System.currentTimeMillis();
            AngelChip.do.do((int)AngelChip.do.int, AngelChip.do.for ? 1 : 0);
            fp.do().do((int)AngelChip.do.int, AngelChip.do.for ? 1 : 0, do[4], do[0]);
            aq_0.if(1000L);
        }
        if (dy_0.if(this.for)) {
            fv_0.do().void(AngelChip.do.char);
            aq_0.if(5000L);
            "".length();
            return;
        }
        if (dy_0.do(this.for)) {
            cj cj2;
            short s2 = do[1];
            int n = do[0];
            while (dy_0.int(n, this.for.size())) {
                cj2 = (cj)this.for.elementAt(n);
                if (dy_0.do(cj2) && dy_0.if(dy_0.if(cj2.do) ? 1 : 0)) {
                    s2 = cj2.do;
                    "".length();
                    if (((0x2E ^ 0x42 ^ (0xEB ^ 0xAC)) & (0x1A ^ 0x5A ^ (0x16 ^ 0x7D) ^ -" ".length())) < (46 + 171 - 177 + 152 ^ 128 + 170 - 201 + 99)) break;
                    return;
                }
                ++n;
                "".length();
                if (((80 + 11 - 55 + 192 ^ 109 + 147 - 136 + 55) & (0xC ^ 0x62 ^ (0x97 ^ 0xB2) ^ -" ".length())) <= 0) continue;
                return;
            }
            n = do[0];
            while (dy_0.int(n, this.for.size())) {
                cj2 = (cj)this.for.elementAt(n);
                if (dy_0.do(cj2) && dy_0.if(dy_0.do(cj2.do) ? 1 : 0)) {
                    fv_0.do().for(cj2.do, do[2]);
                    aq_0.if(100L);
                }
                ++n;
                "".length();
                if ("   ".length() > 0) continue;
                return;
            }
            if (dy_0.for(s2, do[1])) {
                this.do = do[0];
                fv_0.do().do(s2, do[2]);
                if (dy_0.int(aq_0.char(5000L) ? 1 : 0)) {
                    this.for = null;
                    return;
                }
                if (dy_0.if(this.do ? 1 : 0)) {
                    if.removeElement(new Short(s2));
                    "".length();
                }
                aq_0.if(100L);
                return;
            }
            if (dy_0.do(((hc)this).do)) {
                bx_0.do();
                return;
            }
            bx_0.try();
            bx.if("\u0110\u00e3 xong vi\u1ec7c!");
        }
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    public static void for(String stringArray) {
        block5: {
            if (dy_0.int(do.isEmpty() ? 1 : 0)) {
                do.removeAllElements();
            }
            if (!dy_0.do(stringArray = aq_0.if((String)stringArray)) || !dy_0.new(stringArray.length())) break block5;
            stringArray = aq_0.do((String)stringArray, ",");
            int n = do[0];
            while (dy_0.int(n, stringArray.length)) {
                try {
                    do.addElement(new Short(Short.parseShort(stringArray[n])));
                }
                catch (NumberFormatException numberFormatException) {
                    "".length();
                    do.addElement(new Short(do[1]));
                }
                "".length();
                if (-" ".length() > 0) {
                    return;
                }
                ++n;
                "".length();
                if (null == null) continue;
                return;
            }
        }
    }

    private static boolean int(int n, int n2) {
        return n < n2;
    }

    private static boolean int(int n) {
        return n == 0;
    }

    private static boolean new(int n) {
        return n > 0;
    }
}

