/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from bP
 */
public final class bp_0
extends hc {
    public static boolean do;
    private static final Object do;
    public static boolean if;
    private boolean byte;
    private boolean case;
    private static final Vector do;
    public static boolean for;
    private static final int[] do;
    public static boolean int;
    private static final Vector if;
    private static final Vector int;
    private boolean char;
    private boolean else;
    private int do;
    private int if;
    public static boolean new;
    private static final Vector new;
    private boolean goto;
    private String do;
    private int for;
    public static boolean try;

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static gi_0 do(String string) {
        if (bp_0.do(new.isEmpty() ? 1 : 0)) {
            int n = do[0];
            while (bp_0.for(n, new.size())) {
                gi_0 gi_02 = (gi_0)new.elementAt(n);
                String string2 = string;
                if (bp_0.if(gi_02.do.toLowerCase().trim().startsWith(string2.toLowerCase().trim()) ? 1 : 0)) {
                    return gi_02;
                }
                ++n;
                "".length();
                if (((7 ^ 0x35) & ~(0x5C ^ 0x6E)) <= 0) continue;
                return null;
            }
        }
        return null;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static int if(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public bp_0() {
        int n;
        if (bp_0.if(do ? 1 : 0)) {
            n = do[0];
            "".length();
            if ((0x64 ^ 0x60) < ((0x8C ^ 0xC4) & ~(0x72 ^ 0x3A))) {
                throw null;
            }
        } else {
            n = do[1];
        }
        this.if = n;
        this.do = do[0];
        this.byte = do[0];
        this.char = do[0];
        this.goto = do[0];
        this.case = do[0];
        this.else = do[0];
        this.do = "S\u1eefa dinh d\u01b0\u1ee1ng";
        this.for = do[0];
        if (bp_0.do(new.isEmpty() ? 1 : 0)) {
            new.removeAllElements();
        }
        if (bp_0.do(if.isEmpty() ? 1 : 0)) {
            if.removeAllElements();
        }
        if (bp_0.do(do.isEmpty() ? 1 : 0)) {
            do.removeAllElements();
        }
        if (bp_0.do(int.isEmpty() ? 1 : 0)) {
            int.removeAllElements();
        }
        bp_0.int();
        bp_0.new();
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static gb_0 do(String string, Vector vector) {
        if (bp_0.do(vector.isEmpty() ? 1 : 0)) {
            int n = do[0];
            while (bp_0.for(n, vector.size())) {
                gb_0 gb_02 = (gb_0)vector.elementAt(n);
                if (bp_0.if(gb_02.do(string) ? 1 : 0)) {
                    return gb_02;
                }
                ++n;
                "".length();
                if ("  ".length() < (0xBE ^ 0xBA)) continue;
                return null;
            }
        }
        return null;
    }

    private static void try() {
        do = new int[12];
        bp_0.do[0] = (4 ^ 0x43 ^ (0x34 ^ 0x23)) & (0x73 ^ 0x6C ^ (0x13 ^ 0x5C) ^ -" ".length());
        bp_0.do[1] = " ".length();
        bp_0.do[2] = "   ".length();
        bp_0.do[3] = -" ".length();
        bp_0.do[4] = 0xD ^ 0x4F ^ (0xBA ^ 0xC2);
        bp_0.do[5] = 0xF ^ 5;
        bp_0.do[6] = 153 + 79 - 209 + 160 ^ 72 + 73 - 40 + 69;
        bp_0.do[7] = "  ".length();
        bp_0.do[8] = 0x76 ^ 0x2F ^ (0xC3 ^ 0x8B);
        bp_0.do[9] = 0x70 ^ 0x2B ^ (0x53 ^ 0x66);
        bp_0.do[10] = -(0xD2 ^ 0xBB);
        bp_0.do[11] = 0xB3 ^ 0xA6;
    }

    private static boolean for(int n) {
        return n > 0;
    }

    public static void do(int n, byte by2, String[] stringArray) {
        if (bp_0.do(if.isEmpty() ? 1 : 0)) {
            if.removeAllElements();
        }
        int n2 = do[0];
        while (bp_0.for(n2, stringArray.length)) {
            if.addElement(new gb_0(stringArray[n2], new el(n2, n, by2)));
            ++n2;
            "".length();
            if (" ".length() > 0) continue;
            return;
        }
    }

    static {
        bp_0.try();
        new = new Vector();
        if = new Vector();
        do = new Vector();
        int = new Vector();
        for = do[0];
        if = do[0];
        do = new Object();
        do = do[1];
        new = do[1];
        int = do[0];
        try = do[1];
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void int() {
        if (bp_0.if(for ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if (("   ".length() & ("   ".length() ^ -" ".length())) != 0) {
                return;
            }
            for = do[0];
        }
    }

    private static boolean int(int n) {
        return n < 0;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void new() {
        if (bp_0.if(if ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if = do[0];
        }
    }

    public final boolean do(String object) {
        block22: {
            block23: {
                if (!bp_0.if(aq_0.byte ? 1 : 0)) break block22;
                if (!bp_0.do(this.if, do[2])) break block23;
                if (bp_0.int(((String)object).indexOf("s\u1eefa"), do[3]) && bp_0.int(((String)object).indexOf("th\u00e0nh c\u00f4ng"), do[3])) {
                    this.else = do[0];
                    aq_0.case();
                    return do[1];
                }
                if (!bp_0.do(((String)object).startsWith("B\u1ea1n kh\u00f4ng \u0111\u1ee7") ? 1 : 0) || bp_0.if(((String)object).startsWith("Ch\u1ee9c n\u0103ng ch\u1ec9 d\u00e0nh cho") ? 1 : 0)) {
                    this.else = do[1];
                    aq_0.case();
                    return do[1];
                }
                break block22;
            }
            if (bp_0.if(((String)object).startsWith("C\u00e2y t\u00ecnh y\u00eau \u0111\u00e3 h\u1ebft tim") ? 1 : 0)) {
                aq_0.case();
                return do[1];
            }
            if (!bp_0.if(((String)object).startsWith("B\u1ea1n thu ho\u1ea1ch \u0111\u01b0\u1ee3c ") ? 1 : 0) || !bp_0.int(((String)object).indexOf(" tim t\u1eeb c\u00e2y t\u00ecnh y\u00eau"), do[3])) break block22;
            object = aq_0.do(aq_0.do((String)object, "B\u1ea1n thu ho\u1ea1ch \u0111\u01b0\u1ee3c ")[do[1]], " tim t\u1eeb c\u00e2y t\u00ecnh y\u00eau");
            try {
                aq_0.int += Integer.parseInt(object[do[0]]);
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
            }
            "".length();
            if (-" ".length() >= (0x1B ^ 0x1F)) {
                return ((0xCC ^ 0x92) & ~(0xCC ^ 0x92)) != 0;
            }
            aq_0.case();
            return do[1];
        }
        if (bp_0.if(if ? 1 : 0)) {
            if (bp_0.if(((String)object).startsWith("Ch\u1ee9c n\u0103ng qu\u1ea3n l\u00fd em b\u00e9 ch\u1ec9 \u0111\u01b0\u1ee3c") ? 1 : 0)) {
                this.char = do[1];
                bp_0.new();
                return do[1];
            }
            if (bp_0.if(((String)object).startsWith("B\u1ea1n c\u1ea7n c\u00f3 s\u1eefa") ? 1 : 0)) {
                this.case = do[1];
                bp_0.new();
                return do[1];
            }
        }
        if (bp_0.if(aq_0.do ? 1 : 0)) {
            if (bp_0.if(((String)object).startsWith("B\u1ea1n \u0111\u00e3 h\u1ebft s\u1eefa") ? 1 : 0)) {
                this.case = do[1];
                this.goto = do[0];
                aq_0.char();
                return do[1];
            }
            if (bp_0.if(((String)object).startsWith("Em b\u00e9 \u0111\u00e3 \u0103n no") ? 1 : 0)) {
                this.goto = do[1];
                aq_0.char();
                return do[1];
            }
            if (bp_0.if(((String)object).startsWith("Yummi! Em b\u00e9 \u0111\u00e3 \u0111\u01b0\u1ee3c \u0103n ngon") ? 1 : 0)) {
                int n;
                this.for = do[0];
                int n2 = ((String)object).lastIndexOf(do[4]);
                if (bp_0.int(n2, do[3])) {
                    object = ((String)object).substring(n2 + do[1]);
                    try {
                        this.for = Integer.parseInt(aq_0.for(((String)object).trim()));
                    }
                    catch (NumberFormatException numberFormatException) {
                        "".length();
                    }
                    "".length();
                    if ("   ".length() <= "  ".length()) {
                        return ((0x1B ^ 0x7B) & ~(0xCC ^ 0xAC)) != 0;
                    }
                }
                if (bp_0.if(this.for, do[5])) {
                    n = do[1];
                    "".length();
                    if ("  ".length() != "  ".length()) {
                        return ("  ".length() & ("  ".length() ^ -" ".length())) != 0;
                    }
                } else {
                    n = do[0];
                }
                this.goto = n;
                aq_0.char();
                return do[1];
            }
        }
        if (!(!bp_0.if(aq_0.if ? 1 : 0) || bp_0.do(((String)object).startsWith("N\u00e2ng c\u1ea5p th\u00e0nh c\u00f4ng") ? 1 : 0) && bp_0.do(((String)object).startsWith("B\u1ea1n c\u1ea7n cho b\u00e9 \u0103n no") ? 1 : 0) && bp_0.do(((String)object).startsWith("Ch\u01b0a \u0111\u1ebfn th\u1eddi gian n\u00e2ng c\u1ea5p") ? 1 : 0) && bp_0.do(((String)object).startsWith("B\u1ea1n c\u1ea7n \u0111\u1ea1t c\u1ea5p \u0111\u1ed9 h\u1eb9n h\u00f2") ? 1 : 0) && !bp_0.if(((String)object).trim().endsWith("Kh\u00f4ng th\u1ec3 n\u00e2ng c\u1ea5p") ? 1 : 0))) {
            aq_0.byte();
            return do[1];
        }
        return super.do((String)object);
    }

    public static void do(Vector vector) {
        if (bp_0.do(new.isEmpty() ? 1 : 0)) {
            new.removeAllElements();
        }
        int n = do[0];
        while (bp_0.for(n, vector.size())) {
            fn_0 fn_02 = (fn_0)vector.elementAt(n);
            new.addElement(new gi_0(fn_02.do, fn_02.do));
            ++n;
            "".length();
            if ("  ".length() == "  ".length()) continue;
            return;
        }
    }

    public final String toString() {
        return "Ch\u0103m em b\u00e9";
    }

    private static boolean for(int n, int n2) {
        return n < n2;
    }

    public final synchronized void if() {
        block55: {
            if (!bp_0.int(AngelChip.do.for, do[3]) || bp_0.do(do ? 1 : 0) && bp_0.do(new ? 1 : 0) && bp_0.do(try ? 1 : 0)) {
                if (bp_0.do(((hc)this).do)) {
                    aq_0.if(1000L);
                    bx_0.do();
                    return;
                }
                bx_0.try();
                return;
            }
            if (bp_0.for(bp_0.do(System.currentTimeMillis() - this.try, 180000L))) {
                aq_0.else();
                aq_0.do(16000L);
                return;
            }
            if (bp_0.if(bx.do instanceof fo_0)) {
                return;
            }
            if (bp_0.do(this.if, do[2])) {
                bp_0 bp_02 = this;
                if (bp_0.int(fj.new, do[6])) {
                    long l;
                    if (bp_0.if(bx.do instanceof gQ) && bp_0.int(bp_0.do(l = System.currentTimeMillis() - bp_02.new, 2000L))) {
                        aq_0.if(2000L - l);
                    }
                    if (bp_0.if(aq_0.byte(do[6]) ? 1 : 0)) {
                        aq_0.if(3000L);
                    }
                    return;
                }
                int n = do[0];
                int n2 = do[0];
                int n3 = do[0];
                while (bp_0.for(n2, do[5]) && (!bp_0.do(n3, do[1]) || !bp_0.for(AngelChip.do.do[do[7]], do[7]) || bp_0.if(AngelChip.do.break, do[7]))) {
                    bp_02.else = do[0];
                    fp.do().do(do[8], do[5], n3);
                    if (bp_0.if(aq_0.byte(5000L) ? 1 : 0)) {
                        if (bp_0.if(bp_02.else ? 1 : 0)) {
                            if (!bp_0.if(int ? 1 : 0) || !bp_0.do(n3)) break;
                            n3 = do[1];
                            aq_0.if(100L);
                            "".length();
                            if (-(0x52 ^ 0x56) < 0) continue;
                            return;
                        }
                        ++n;
                        aq_0.if(100L);
                    }
                    ++n2;
                    "".length();
                    if (((0x2F ^ 0x66) & ~(0x43 ^ 0xA)) != " ".length()) continue;
                    return;
                }
                if (bp_0.for(n)) {
                    bp_02.if = do[1];
                    return;
                }
                bx_0.do();
                return;
            }
            if (!bp_0.do(fj.new, do[9])) break block55;
            if (bp_0.do(this.byte ? 1 : 0)) {
                fv_0.do().do(do[10]);
                fv_0.do().if();
                if (bp_0.if(bp_0.do() ? 1 : 0)) {
                    this.byte = do[1];
                }
            }
            if (bp_0.if(new.isEmpty() ? 1 : 0)) {
                this.byte = do[0];
                bx_0.do();
                return;
            }
            switch (this.if) {
                case 0: {
                    gi_0 gi_02;
                    if (!bp_0.do(new ? 1 : 0) || bp_0.if(try ? 1 : 0)) {
                        this.if = do[1];
                        "".length();
                        if (-"  ".length() >= 0) {
                            return;
                        }
                    } else {
                        this.if = do[3];
                    }
                    if (!bp_0.do(gi_02 = bp_0.do("Thu ho\u1ea1ch"))) break;
                    int n = aq_0.int;
                    gi_02.do();
                    if (bp_0.if(aq_0.byte(5000L) ? 1 : 0)) {
                        if (bp_0.int(n, aq_0.int)) {
                            cs.try();
                        }
                        aq_0.if(500L);
                    }
                    return;
                }
                case 1: {
                    this.if = do[3];
                    if.removeAllElements();
                    gi_0 gi_03 = bp_0.do("Baby");
                    if (!bp_0.do(gi_03)) break;
                    gi_03.do();
                    if (bp_0.if(bp_0.do(5000L) ? 1 : 0)) {
                        aq_0.if(500L);
                    }
                    if (!bp_0.do(if.isEmpty() ? 1 : 0)) break;
                    gb_0 gb_02 = bp_0.do("Qu\u1ea3n L\u00fd Em B\u00e9", if);
                    if (bp_0.do(gb_02)) {
                        this.char = do[0];
                        if.removeAllElements();
                        gb_02.do();
                        if (bp_0.if(bp_0.do(5000L) ? 1 : 0)) {
                            if (bp_0.if(this.char ? 1 : 0)) {
                                bx_0.do();
                                return;
                            }
                            if (bp_0.do(if.isEmpty() ? 1 : 0)) {
                                do.removeAllElements();
                                if (bp_0.do(if.isEmpty() ? 1 : 0)) {
                                    int n = do[0];
                                    while (bp_0.for(n, if.size())) {
                                        gb_0 gb_03 = (gb_0)if.elementAt(n);
                                        do.addElement(gb_03);
                                        ++n;
                                        "".length();
                                        if ("   ".length() >= 0) continue;
                                        return;
                                    }
                                }
                                if.removeAllElements();
                                this.do = "S\u1eefa dinh d\u01b0\u1ee1ng";
                                this.if = do[7];
                                aq_0.if(500L);
                            }
                        }
                    }
                    return;
                }
                case 2: {
                    if (bp_0.if(do.isEmpty() ? 1 : 0)) {
                        bx_0.do();
                        return;
                    }
                    if (bp_0.if(this.do, do.size())) {
                        this.do = do[0];
                        bx_0.do();
                        return;
                    }
                    try {
                        gb_0 gb_04 = (gb_0)do.elementAt(this.do);
                        if (bp_0.do(gb_04)) {
                            if.removeAllElements();
                            gb_04.do();
                            if (bp_0.if(bp_0.do(15000L) ? 1 : 0)) {
                                aq_0.if(500L);
                            }
                            if (bp_0.do(if.isEmpty() ? 1 : 0) && bp_0.do(gb_04 = bp_0.do("Cho \u0103n", if))) {
                                int.removeAllElements();
                                if (bp_0.do(if.isEmpty() ? 1 : 0)) {
                                    int n = do[0];
                                    while (bp_0.for(n, if.size())) {
                                        gb_0 gb_05 = (gb_0)if.elementAt(n);
                                        int.addElement(gb_05);
                                        ++n;
                                        "".length();
                                        if ("  ".length() > " ".length()) continue;
                                        return;
                                    }
                                }
                                if.removeAllElements();
                                this.case = do[0];
                                gb_04.do();
                                if (bp_0.if(bp_0.do(15000L) ? 1 : 0)) {
                                    if (bp_0.if(this.case ? 1 : 0)) {
                                        this.if = do[2];
                                        return;
                                    }
                                    aq_0.if(500L);
                                }
                                if (bp_0.do(if.isEmpty() ? 1 : 0) && bp_0.do(gb_04 = bp_0.do(this.do, if))) {
                                    this.case = do[0];
                                    this.goto = do[0];
                                    gb_04.do();
                                    if (bp_0.if(aq_0.char(15000L) ? 1 : 0)) {
                                        if (bp_0.if(this.case ? 1 : 0)) {
                                            if (bp_0.if(this.do.equals("S\u1eefa dinh d\u01b0\u1ee1ng") ? 1 : 0)) {
                                                this.do = "S\u1eefa nh\u1eadp kh\u1ea9u";
                                                return;
                                            }
                                            this.if = do[2];
                                            return;
                                        }
                                        if (bp_0.if(this.goto ? 1 : 0)) {
                                            if (bp_0.if(try ? 1 : 0) && bp_0.do(gb_04 = bp_0.do("N\u00e2ng C\u1ea5p", int))) {
                                                gb_04.do();
                                                if (bp_0.if(aq_0.new(5000L) ? 1 : 0)) {
                                                    aq_0.if(500L);
                                                }
                                            }
                                            this.do += do[1];
                                        }
                                        return;
                                    }
                                }
                            }
                        }
                        "".length();
                    }
                    catch (Exception exception) {
                        "".length();
                    }
                    if ((0x76 ^ 0x52 ^ (0x2F ^ 0xE)) == 0) {
                        return;
                    }
                    this.do += do[1];
                    return;
                }
                default: {
                    bx_0.do();
                }
            }
            return;
        }
        if (bp_0.int(fj.new, do[11])) {
            long l;
            if (bp_0.if(bx.do instanceof gQ) && bp_0.int(bp_0.do(l = System.currentTimeMillis() - ((hc)this).new, 2000L))) {
                aq_0.if(2000L - l);
            }
            if (bp_0.if(aq_0.byte(do[11]) ? 1 : 0)) {
                aq_0.if(3500L);
            }
            return;
        }
        if (bp_0.if(aq_0.byte(do[9]) ? 1 : 0)) {
            aq_0.if(1000L);
        }
    }

    private static int for(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean int(int n, int n2) {
        return n != n2;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private static boolean do() {
        long l;
        block7: {
            for = do[1];
            l = System.currentTimeMillis();
            Object object = do;
            synchronized (object) {
                try {
                    do.wait(15000L);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                    break block7;
                }
                if ("   ".length() <= ((0x91 ^ 0xA9) & ~(0x8D ^ 0xB5))) {
                    return ((0x6F ^ 0x46) & ~(0xB6 ^ 0x9F)) != 0;
                }
            }
        }
        "".length();
        if (" ".length() <= 0) {
            return ((0x9B ^ 0xB7) & ~(0x19 ^ 0x35)) != 0;
        }
        if (bp_0.int(bp_0.for(System.currentTimeMillis() - l, 15000L))) {
            return do[1];
        }
        return do[0];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private static boolean do(long l) {
        if = do[1];
        long l2 = System.currentTimeMillis();
        Object object = do;
        synchronized (object) {
            try {
                do.wait(l);
                "".length();
            }
            catch (InterruptedException interruptedException) {
                "".length();
            }
        }
        "".length();
        if (bp_0.int(bp_0.if(System.currentTimeMillis() - l2, l))) {
            return do[1];
        }
        return do[0];
    }
}

