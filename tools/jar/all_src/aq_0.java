/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.Calendar;
import java.util.Date;
import java.util.Hashtable;
import java.util.Random;
import java.util.TimeZone;
import java.util.Vector;
import javax.microedition.lcdui.Graphics;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from aQ
 */
public final class aq_0 {
    public static String do;
    public static boolean do;
    private static final String int;
    private static final Random do;
    public static boolean if;
    private long new = 0L;
    public static long do;
    private static final Object do;
    public String if;
    private static aq_0 do;
    private static final int[] if;
    private static Vector do;
    private static boolean char;
    private static final String new;
    public long if = 0L;
    public static boolean for;
    public static boolean int;
    public static boolean new;
    public static long for;
    public static byte do;
    private static boolean else;
    public static boolean try;
    public static long int;
    private static boolean goto;
    public static boolean byte;
    public static int do;
    private static boolean long;
    public static int if;
    public static boolean case;
    public static int for;
    public static int[] do;
    public static int int;
    private static boolean this;
    private static boolean void;
    public String for = "";

    public final void do() {
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(new Date(int));
        this.if = calendar.get(if[0]) + "/" + (calendar.get(if[1]) + if[2]) + "/" + calendar.get(if[2]);
        if (aq_0.catch(aq_0.do(do, 0L))) {
            this.if = for + do * 86400000L;
            this.new = int + do * 86400000L;
            calendar.setTime(new Date(this.new));
            this.for = calendar.get(if[0]) + "/" + (calendar.get(if[1]) + if[2]) + "/" + calendar.get(if[2]);
            return;
        }
        this.new = 0L;
        this.if = 0L;
    }

    public static boolean do(int n) {
        if (aq_0.long(n) && !aq_0.new(n, if[31]) || aq_0.int(n, if[32])) {
            return if[2];
        }
        return if[3];
    }

    private static boolean case(int n) {
        if (aq_0.if(n, if[33]) && aq_0.for(n, if[34])) {
            return if[2];
        }
        return if[3];
    }

    public static boolean do(ep ep2) {
        long l = System.currentTimeMillis();
        while (aq_0.const(aq_0.if(System.currentTimeMillis() - l, 30000L))) {
            if (aq_0.do(bx.do, ep2)) {
                return if[2];
            }
            aq_0.if(100L);
            "".length();
            if (-(0x3A ^ 0x3E) <= 0) continue;
            return ((0xB0 ^ 0xA2) & ~(0x19 ^ 0xB)) != 0;
        }
        return if[3];
    }

    private static boolean char(int n) {
        if (!aq_0.do(n, if[35]) || aq_0.int(n, if[36])) {
            return if[2];
        }
        return if[3];
    }

    public static void if() {
        aq_0.break();
        aq_0.byte();
        aq_0.class();
        aq_0.case();
        aq_0.for();
        aq_0.try();
        aq_0.long();
        aq_0.goto();
        aq_0.this();
        aq_0.void();
        aq_0.char();
        aq_0.catch();
        aq_0.new();
        gY.do();
        ah.int();
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static int if(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public static String do(String string) {
        return string;
    }

    public static void do(String string, fn_0 fn_02, fn_0 fn_03) {
        Vector<fn_0> vector = new Vector<fn_0>();
        vector.addElement(fn_02);
        vector.addElement(fn_03);
        vector.addElement(bx.do);
        bx.if(string, vector);
    }

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean do(long l) {
        long l2;
        block7: {
            goto = if[2];
            l2 = System.currentTimeMillis();
            Object object = do;
            synchronized (object) {
                try {
                    do.wait(l);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                    break block7;
                }
                if ("  ".length() == -" ".length()) {
                    return ((0x56 ^ 0x4E) & ~(0x16 ^ 0xE)) != 0;
                }
            }
        }
        "".length();
        if (((23 + 83 - -34 + 50 ^ 120 + 31 - 92 + 83) & (0xB4 ^ 0xAD ^ (2 ^ 0x2B) ^ -" ".length())) >= "   ".length()) {
            return ((0x20 ^ 0x32 ^ "  ".length()) & (13 + 176 - 55 + 53 ^ 160 + 27 - 90 + 74 ^ -" ".length())) != 0;
        }
        if (aq_0.const(aq_0.void(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean if(long l) {
        long l2;
        block6: {
            new = if[2];
            l2 = System.currentTimeMillis();
            Object object = do;
            synchronized (object) {
                try {
                    do.wait(l);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                    break block6;
                }
                if (" ".length() < 0) {
                    return ((0x5F ^ 0x4F) & ~(0x52 ^ 0x42)) != 0;
                }
            }
        }
        "".length();
        if (aq_0.const(aq_0.long(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    private static void const() {
        if = new int[70];
        aq_0.if[0] = 61 + 80 - 112 + 161 ^ 25 + 49 - -30 + 83;
        aq_0.if[1] = "  ".length();
        aq_0.if[2] = " ".length();
        aq_0.if[3] = (172 + 116 - 150 + 45 ^ 145 + 42 - 62 + 24) & (58 + 87 - 44 + 68 ^ 50 + 44 - -29 + 16 ^ -" ".length());
        aq_0.if[4] = 0x7A ^ 0x71;
        aq_0.if[5] = 2 + 53 - 23 + 102 ^ 46 + 27 - 12 + 77;
        aq_0.if[6] = 82 + 99 - 120 + 112 ^ 28 + 37 - -63 + 32;
        aq_0.if[7] = -" ".length();
        aq_0.if[8] = 117 + 111 - 192 + 119 ^ 9 + 130 - 18 + 18;
        aq_0.if[9] = 0x2F ^ 0x28;
        aq_0.if[10] = 0xBA ^ 0x95;
        aq_0.if[11] = 0x9A ^ 0xA0;
        aq_0.if[12] = 0xB1 ^ 0x81;
        aq_0.if[13] = 5 ^ 0x36 ^ (0x15 ^ 0x1F);
        aq_0.if[14] = 0x67 ^ 0x3A ^ (0x3A ^ 0x68);
        aq_0.if[15] = 0xC ^ 0x2F;
        aq_0.if[16] = 0x6F ^ 6 ^ (0x30 ^ 0x4D);
        aq_0.if[17] = 0xA0 ^ 0xA4;
        aq_0.if[18] = "   ".length();
        aq_0.if[19] = 0x99 ^ 0x90;
        aq_0.if[20] = 85 + 204 - 254 + 193 ^ 95 + 31 - -10 + 5;
        aq_0.if[21] = 120 + 75 - -6 + 12 ^ 31 + 84 - -32 + 24;
        aq_0.if[22] = 0x57 ^ 0x2B;
        aq_0.if[23] = 0xC ^ 0x76;
        aq_0.if[24] = 0xB3 ^ 0xB5;
        aq_0.if[25] = 0x88 ^ 0x90 ^ (0xF4 ^ 0xB7);
        aq_0.if[26] = 0x36 ^ 0x68;
        aq_0.if[27] = 0xB ^ 0xF ^ (0x45 ^ 0x49);
        aq_0.if[28] = 0x87 ^ 0xBC;
        aq_0.if[29] = 0x7B ^ 0x47 ^ (0x3F ^ 0x2F);
        aq_0.if[30] = 0xFFFFA12F & 0x5FFC;
        aq_0.if[31] = 50 + 84 - -10 + 6 ^ 111 + 97 - 186 + 110;
        aq_0.if[32] = 61 + 124 - 173 + 124 ^ 119 + 138 - 132 + 34;
        aq_0.if[33] = 0xA9 ^ 0xB2;
        aq_0.if[34] = 0x92 ^ 0x8C;
        aq_0.if[35] = 0xB1 ^ 0x90;
        aq_0.if[36] = 0x7B ^ 0x62 ^ (0x57 ^ 0x6C);
        aq_0.if[37] = 158 + 23 - 82 + 88 ^ 74 + 117 - 189 + 138;
        aq_0.if[38] = 190 + 10 - 78 + 94 ^ 34 + 18 - -49 + 92;
        aq_0.if[39] = 0x75 ^ 0x60;
        aq_0.if[40] = " ".length() ^ (0x11 ^ 0x54);
        aq_0.if[41] = 0xF9 ^ 0xBC;
        aq_0.if[42] = 43 + 9 - -80 + 99 ^ 90 + 103 - 163 + 131;
        aq_0.if[43] = 0xFF ^ 0x91;
        aq_0.if[44] = 0x90 ^ 0x9E;
        aq_0.if[45] = 174 + 22 - 56 + 35 ^ 7 + 163 - 125 + 120;
        aq_0.if[46] = -(0xFFFFEEFD & 0x5F2F) & (0xFFFFCF7F & 0x7FAE);
        aq_0.if[47] = 96 + 14 - 25 + 71;
        aq_0.if[48] = 0xA2 ^ 0xBA;
        aq_0.if[49] = 0x73 ^ 0x46;
        aq_0.if[50] = 0x72 ^ 0x63;
        aq_0.if[51] = 0xBC ^ 0xAF ^ (0x7D ^ 0x72);
        aq_0.if[52] = 171 + 178 - 173 + 5 ^ 132 + 11 - 124 + 122;
        aq_0.if[53] = 0x3A ^ 0x22 ^ (0x55 ^ 0x50);
        aq_0.if[54] = 0x54 ^ 0x3A ^ (0xDD ^ 0xA0);
        aq_0.if[55] = 0x4D ^ 0x38;
        aq_0.if[56] = 120 + 121 - 106 + 3;
        aq_0.if[57] = 0x3A ^ 0x78;
        aq_0.if[58] = 81 + 129 - 192 + 112;
        aq_0.if[59] = 9 ^ 0x4D ^ (0x20 ^ 0x1D);
        aq_0.if[60] = 79 + 115 - 94 + 36;
        aq_0.if[61] = 0x12 ^ 7 ^ (6 ^ 0x4E);
        aq_0.if[62] = 0x4C ^ 0x19;
        aq_0.if[63] = 0x88 ^ 0x9B ^ (0x68 ^ 3);
        aq_0.if[64] = (0x16 ^ 0x28) + (0x7A ^ 0x3E) - (0x7C ^ 0x36) + (2 ^ 0x4C);
        aq_0.if[65] = (0xC ^ 0x76) + (0x10 ^ 0x65) - (26 + 160 - 126 + 146) + (0x66 ^ 0);
        aq_0.if[66] = 217 + 49 - 184 + 156 ^ 118 + 74 - 116 + 58;
        aq_0.if[67] = 135 + 151 - 231 + 123 ^ 21 + 129 - 88 + 130;
        aq_0.if[68] = 0xE3 ^ 0x94;
        aq_0.if[69] = 0x4E ^ 0x7C;
    }

    private static boolean else(int n) {
        if (aq_0.if(n, if[37]) && aq_0.for(n, if[11])) {
            return if[2];
        }
        return if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void for() {
        if (aq_0.this(for ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if (-" ".length() > (20 + 10 - 23 + 126 ^ 23 + 86 - 52 + 72)) {
                return;
            }
            for = if[3];
        }
    }

    public static void int() {
        do = null;
        bs_0.do = new int[if[17]][][][];
        az.do = new String[if[18]];
        fq_0.do = new int[if[17]][];
        AngelChip.do = null;
        AngelChip.if = null;
        AngelChip.do = null;
        if (aq_0.void(ah.do.isEmpty() ? 1 : 0)) {
            ah.do.removeAllElements();
        }
        if (aq_0.void(ah.if.isEmpty() ? 1 : 0)) {
            ah.if.removeAllElements();
        }
        bx_0.try();
        br_0.do.clear();
        br_0.do();
        if (aq_0.void(bx.do instanceof fo_0) && aq_0.void(bx.do instanceof ax_0)) {
            aq_0.else();
        }
        int[] nArray = new int[if[19]];
        nArray[aq_0.if[3]] = if[20];
        nArray[aq_0.if[2]] = if[21];
        nArray[aq_0.if[1]] = if[20];
        nArray[aq_0.if[18]] = if[22];
        nArray[aq_0.if[17]] = if[20];
        nArray[aq_0.if[0]] = if[23];
        nArray[aq_0.if[24]] = if[25];
        nArray[aq_0.if[9]] = if[26];
        nArray[aq_0.if[27]] = if[3];
        ac_0.do(aq_0.do(nArray));
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean do() {
        try = if[2];
        long l = System.currentTimeMillis();
        Object object = do;
        synchronized (object) {
            try {
                do.wait(15000L);
                "".length();
            }
            catch (InterruptedException interruptedException) {
                "".length();
            }
        }
        "".length();
        if (aq_0.const(aq_0.char(System.currentTimeMillis() - l, 15000L))) {
            return if[2];
        }
        return if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void new() {
        if (aq_0.this(try ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if (((20 + 114 - -26 + 74 ^ 56 + 65 - 35 + 100) & (35 + 135 - 27 + 63 ^ 135 + 67 - 80 + 36 ^ -" ".length())) > 0) {
                return;
            }
            try = if[3];
        }
    }

    public static aq_0 do() {
        if (aq_0.if(do)) {
            do = new aq_0();
        }
        return do;
    }

    public static void do(String string) {
        AngelChip.do.do = (byte)null;
        AngelChip.do.do(if[30], string, if[2]);
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void try() {
        if (aq_0.this(this ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if (-" ".length() != -" ".length()) {
                return;
            }
            this = if[3];
        }
    }

    private static int for(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static int int(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public static boolean do(String string) {
        if (aq_0.if(do)) {
            do = new Vector();
            String[] stringArray = br_0.do(br_0.do + if[1]);
            if (aq_0.do(stringArray) && aq_0.void(stringArray.equals("") ? 1 : 0)) {
                stringArray = aq_0.do((String)stringArray, ";");
                int n = if[3];
                while (aq_0.try(n, stringArray.length)) {
                    do.addElement(stringArray[n].trim().toLowerCase());
                    ++n;
                    "".length();
                    if (((0x41 ^ 0x60) & ~(0x15 ^ 0x34)) == 0) continue;
                    return ((0x29 ^ 0x48) & ~(0x5C ^ 0x3D)) != 0;
                }
            }
        }
        if (aq_0.void(do.isEmpty() ? 1 : 0) && aq_0.this(do.contains(string.toLowerCase()) ? 1 : 0)) {
            return if[2];
        }
        return if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean if() {
        long l;
        block6: {
            void = if[2];
            l = System.currentTimeMillis();
            Object object = do;
            synchronized (object) {
                try {
                    do.wait(5000L);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                    break block6;
                }
                if ("  ".length() < " ".length()) {
                    return ((0x29 ^ 0x4A ^ (0x27 ^ 0x64)) & (14 + 12 - -88 + 75 ^ 80 + 107 - 89 + 59 ^ -" ".length())) != 0;
                }
            }
        }
        "".length();
        if (aq_0.const(aq_0.for(System.currentTimeMillis() - l, 5000L))) {
            return if[2];
        }
        return if[3];
    }

    public static String do(int[] nArray) {
        int n = nArray.length - if[2];
        int n2 = if[3];
        StringBuffer stringBuffer = new StringBuffer();
        int n3 = if[3];
        while (aq_0.try(n3, n)) {
            n2 += nArray[n3];
            stringBuffer.append((char)(nArray[n3] - n));
            "".length();
            ++n3;
            "".length();
            if (null == null) continue;
            return null;
        }
        if (aq_0.void((n2 - nArray[n]) % n)) {
            return stringBuffer.toString();
        }
        return null;
    }

    public static boolean if(int n) {
        for = if[2];
        long l = System.currentTimeMillis();
        while (aq_0.const(aq_0.else(System.currentTimeMillis() - l, 30000L))) {
            if (aq_0.void(for ? 1 : 0)) {
                return if[3];
            }
            if (aq_0.int(fj.new, n)) {
                for = if[3];
                return if[2];
            }
            aq_0.if(100L);
            "".length();
            if ((0xA6 ^ 0xA2) >= "  ".length()) continue;
            return ((0xFE ^ 0xC4) & ~(0x12 ^ 0x28)) != 0;
        }
        for = if[3];
        return if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void byte() {
        if (aq_0.this(if ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if = if[3];
        }
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public static int do(int n, int n2) {
        if (aq_0.try(n, n2)) {
            return n + do.nextInt(n2 - n + if[2]);
        }
        if (aq_0.new(n, n2)) {
            return n2 + do.nextInt(n - n2 + if[2]);
        }
        return n;
    }

    private static int new(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean goto(int n) {
        if (aq_0.int(n, if[38])) {
            return if[2];
        }
        return if[3];
    }

    public static String if(String object) {
        String string;
        block17: {
            string = "";
            if (!aq_0.catch(object.length())) break block17;
            if (aq_0.do(object.indexOf(if[28]), if[7])) {
                object = object.replace(if[28], if[29]);
            }
            object = aq_0.do((String)object, ",");
            int[] nArray = new int[((String[])object).length];
            int n = if[3];
            while (aq_0.try(n, ((String[])object).length)) {
                try {
                    nArray[n] = Integer.parseInt(object[n].trim());
                }
                catch (NumberFormatException numberFormatException) {
                    "".length();
                    nArray[n] = if[7];
                }
                "".length();
                if ("   ".length() < 0) {
                    return null;
                }
                ++n;
                "".length();
                if (null == null) continue;
                return null;
            }
            n = if[3];
            while (aq_0.try(n, nArray.length)) {
                if (aq_0.catch(n)) {
                    if (aq_0.do(nArray[n], if[7])) {
                        int n2 = if[3];
                        int n3 = if[3];
                        while (aq_0.try(n3, n)) {
                            if (aq_0.do(nArray[n3], if[7]) && aq_0.int(nArray[n], nArray[n3])) {
                                n2 = if[2];
                                "".length();
                                if ((12 + 111 - 18 + 24 ^ 10 + 75 - 59 + 106) > 0) break;
                                return null;
                            }
                            ++n3;
                            "".length();
                            if ("   ".length() != " ".length()) continue;
                            return null;
                        }
                        if (aq_0.void(n2)) {
                            String string2;
                            StringBuffer stringBuffer = new StringBuffer().append(string);
                            if (aq_0.catch(string.length())) {
                                string2 = ",";
                                "".length();
                                if (((0xAC ^ 0xAA) & ~(0x3E ^ 0x38)) != ((0x71 ^ 0x3D) & ~(8 ^ 0x44))) {
                                    return null;
                                }
                            } else {
                                string2 = "";
                            }
                            string = stringBuffer.append(string2).append(nArray[n]).toString();
                        }
                        "".length();
                        if ((0x55 ^ 0x51) == 0) {
                            return null;
                        }
                    }
                } else if (aq_0.do(nArray[n], if[7])) {
                    string = string + nArray[n];
                }
                ++n;
                "".length();
                if (((0x2B ^ 0x48 ^ (0x68 ^ 0x45)) & (33 + 64 - 67 + 176 ^ 13 + 110 - 5 + 10 ^ -" ".length())) >= 0) continue;
                return null;
            }
        }
        return string;
    }

    private static int try(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public static boolean for(int n) {
        if (!aq_0.void(aq_0.new(n) ? 1 : 0) || aq_0.int(n, if[43])) {
            return if[2];
        }
        return if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void case() {
        if (aq_0.this(byte ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            byte = if[3];
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean for(long l) {
        long l2;
        block7: {
            char = if[2];
            l2 = System.currentTimeMillis();
            Object object = do;
            synchronized (object) {
                try {
                    do.wait(l);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                    break block7;
                }
                if (((0x7D ^ 0x6C) & ~(0x7D ^ 0x6C)) >= " ".length()) {
                    return ((0x44 ^ 0xB) & ~(0x20 ^ 0x6F)) != 0;
                }
            }
        }
        "".length();
        if (((16 + 9 - -80 + 43 ^ 122 + 73 - 93 + 66) & (0x48 ^ 0x21 ^ (0x30 ^ 0x65) ^ -" ".length())) != 0) {
            return ((0x1E ^ 0x62 ^ (6 ^ 0x55)) & (48 + 84 - 71 + 112 ^ 68 + 122 - 75 + 15 ^ -" ".length())) != 0;
        }
        if (aq_0.const(aq_0.this(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
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
    public static boolean int(long l) {
        long l2;
        block7: {
            case = if[2];
            l2 = System.currentTimeMillis();
            Object object = do;
            synchronized (object) {
                try {
                    do.wait(l);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                    break block7;
                }
                if (((92 + 226 - 287 + 221 ^ 87 + 36 - 17 + 92) & (120 + 8 - 52 + 92 ^ 70 + 84 - 120 + 112 ^ -" ".length())) > "  ".length()) {
                    return ((15 + 192 - 65 + 57 ^ 59 + 130 - 177 + 121) & (104 + 144 - 148 + 96 ^ 129 + 17 - 27 + 15 ^ -" ".length())) != 0;
                }
            }
        }
        "".length();
        if (-"   ".length() >= 0) {
            return ((0xE2 ^ 0xBA) & ~(0x14 ^ 0x4C)) != 0;
        }
        if (aq_0.const(aq_0.catch(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void char() {
        if (aq_0.this(do ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if (((0x15 ^ 0xE) & ~(0xAA ^ 0xB1)) == "  ".length()) {
                return;
            }
            do = if[3];
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final String do() {
        StringBuffer stringBuffer;
        block26: {
            InputStreamReader inputStreamReader;
            block27: {
                if (!aq_0.this(aq_0.int() ? 1 : 0)) return null;
                InputStream inputStream = null;
                inputStreamReader = null;
                stringBuffer = new StringBuffer();
                try {
                    int n;
                    inputStream = this.getClass().getResourceAsStream("/version.txt");
                    inputStreamReader = new InputStreamReader(inputStream, "UTF-8");
                    while (aq_0.do(n = inputStreamReader.read(), if[7])) {
                        stringBuffer.append((char)n);
                        "".length();
                        "".length();
                    }
                }
                catch (Exception exception) {
                    block25: {
                        "".length();
                        if (aq_0.do(inputStream)) {
                            try {
                                inputStream.close();
                                "".length();
                            }
                            catch (IOException iOException) {
                                "".length();
                                break block25;
                            }
                            if ("   ".length() > "   ".length()) {
                                return null;
                            }
                        }
                    }
                    if (!aq_0.do(inputStreamReader)) break block26;
                    try {
                        inputStreamReader.close();
                        "".length();
                    }
                    catch (IOException iOException) {
                        "".length();
                        "".length();
                        if (" ".length() != " ".length()) {
                            return null;
                        }
                        break block26;
                    }
                    if (-"   ".length() > 0) {
                        return null;
                    }
                    break block26;
                }
                catch (Throwable throwable) {
                    if (aq_0.do(inputStream)) {
                        try {
                            inputStream.close();
                            "".length();
                        }
                        catch (IOException iOException) {
                            "".length();
                        }
                    }
                    if (!aq_0.do(inputStreamReader)) throw throwable;
                    try {
                        inputStreamReader.close();
                        "".length();
                        throw throwable;
                    }
                    catch (IOException iOException) {
                        "".length();
                        throw throwable;
                    }
                }
                if (aq_0.do(inputStream)) {
                    try {
                        inputStream.close();
                        "".length();
                    }
                    catch (IOException iOException) {
                        "".length();
                        break block27;
                    }
                    if (" ".length() == 0) {
                        return null;
                    }
                }
            }
            try {
                inputStreamReader.close();
                "".length();
            }
            catch (IOException iOException) {
                "".length();
                "".length();
                if (" ".length() == (0xAF ^ 0x9D ^ (0x67 ^ 0x51))) {
                    return null;
                }
                break block26;
            }
            if (-" ".length() < -" ".length()) {
                return null;
            }
        }
        cs.do("BuildVersion", if[4]);
        return stringBuffer.toString();
    }

    public static void do(long l) {
        if (aq_0.this(ge_0.do ? 1 : 0)) {
            ge_0.do = if[3];
            return;
        }
        new ge_0(l).do();
    }

    private static boolean long(int n) {
        return n >= 0;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean new(long l) {
        if = if[2];
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
        if (aq_0.const(aq_0.new(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    public static boolean for() {
        if (!aq_0.void(bx.do instanceof gQ) || aq_0.int(fj.new, if[7])) {
            return if[2];
        }
        return if[3];
    }

    public static void else() {
        bx_0.do.int();
        if (aq_0.void(bx.do instanceof fo_0)) {
            gs_0.import();
        }
    }

    private static boolean this(int n) {
        return n != 0;
    }

    private static int byte(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public static boolean int() {
        if (aq_0.do(if[4], cs.do("BuildVersion"))) {
            return if[2];
        }
        return if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void goto() {
        if (aq_0.this(new ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            new = if[3];
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean try(long l) {
        long l2;
        block7: {
            this = if[2];
            l2 = System.currentTimeMillis();
            Object object = do;
            synchronized (object) {
                try {
                    do.wait(l);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                    break block7;
                }
                if (" ".length() == ((0xCD ^ 0x80) & ~(0x15 ^ 0x58))) {
                    return ((0x7F ^ 0x37) & ~(0x17 ^ 0x5F)) != 0;
                }
            }
        }
        "".length();
        if (" ".length() <= 0) {
            return ((0x58 ^ 0x73) & ~(0x14 ^ 0x3F)) != 0;
        }
        if (aq_0.const(aq_0.case(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    public static void if(String string, fn_0 fn_02, fn_0 fn_03) {
        Vector<fn_0> vector = new Vector<fn_0>();
        vector.addElement(fn_02);
        vector.addElement(fn_03);
        bx.if(string, vector);
    }

    private static int case(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public static boolean int(int n) {
        if (!(aq_0.void(aq_0.do(n) ? 1 : 0) && aq_0.void(aq_0.class(n) ? 1 : 0) && aq_0.void(aq_0.float(n) ? 1 : 0) && aq_0.void(aq_0.case(n) ? 1 : 0) && aq_0.void(aq_0.char(n) ? 1 : 0) && aq_0.void(aq_0.else(n) ? 1 : 0) && aq_0.void(aq_0.goto(n) ? 1 : 0) && !aq_0.this(aq_0.break(n) ? 1 : 0))) {
            return if[2];
        }
        return if[3];
    }

    public static boolean new(int n) {
        if (!aq_0.do(n, if[40]) || !aq_0.do(n, if[41]) || aq_0.int(n, if[42])) {
            return if[2];
        }
        return if[3];
    }

    public static void if(long l) {
        if (aq_0.final(aq_0.int(l, 0L))) {
            return;
        }
        try {
            Thread.sleep(l);
            return;
        }
        catch (InterruptedException interruptedException) {
            "".length();
            return;
        }
    }

    private static int char(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static String int(String string) {
        String string2 = "";
        int n = if[3];
        while (aq_0.try(n, string.length())) {
            if (aq_0.catch(n)) {
                string2 = string2 + ".";
            }
            string2 = string2 + Integer.parseInt(string.substring(n, n + if[1]), if[8]);
            n += 2;
            "".length();
            if ("  ".length() >= 0) continue;
            return null;
        }
        return string2;
    }

    private static boolean for(int n, int n2) {
        return n <= n2;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean new() {
        long = if[2];
        long l = System.currentTimeMillis();
        Object object = do;
        synchronized (object) {
            try {
                do.wait(15000L);
                "".length();
            }
            catch (InterruptedException interruptedException) {
                "".length();
            }
        }
        "".length();
        if (aq_0.const(aq_0.try(System.currentTimeMillis() - l, 15000L))) {
            return if[2];
        }
        return if[3];
    }

    public static void do(Graphics graphics) {
        int n;
        int n2;
        if (aq_0.this(bx.do instanceof gK)) {
            n2 = if[14];
            "".length();
            if ("   ".length() <= "  ".length()) {
                return;
            }
        } else {
            n2 = n = if[15];
        }
        if (aq_0.do(bx_0.do) && aq_0.catch(bx_0.do.toString().length()) && aq_0.void(bx.do instanceof gK)) {
            if (aq_0.try(bx.break % if[16], if[14])) {
                bx.int.do(graphics, "( " + bx_0.do.toString() + " )", bx.char / if[1], if[14], if[1]);
                "".length();
                if (((0xB9 ^ 0xA6) & ~(0x5E ^ 0x41)) >= " ".length()) {
                    return;
                }
            } else {
                bx.byte.do(graphics, "( " + bx_0.do.toString() + " )", bx.char / if[1], if[14], if[1]);
            }
        }
        if (aq_0.void(int ? 1 : 0)) {
            String string;
            String string2;
            String string3;
            bx.int.do(graphics, "ID: " + (String)AngelChip.do.do + " - LV: " + bx_0.do.do, if[17], n, if[3]);
            n += 14;
            StringBuffer stringBuffer = new StringBuffer().append("TK: ").append(bx.do(AngelChip.do.do[if[3]])).append("xu");
            if (aq_0.catch(AngelChip.do.do[if[1]])) {
                string3 = " - " + bx.do(AngelChip.do.do[if[1]]) + "L";
                "".length();
                if (null != null) {
                    return;
                }
            } else {
                string3 = "";
            }
            StringBuffer stringBuffer2 = stringBuffer.append(string3);
            if (aq_0.catch(AngelChip.do.break)) {
                string2 = " - " + bx.do(AngelChip.do.break) + "LK";
                "".length();
                if (((0x90 ^ 0xC7) & ~(0x91 ^ 0xC6)) == "  ".length()) {
                    return;
                }
            } else {
                string2 = "";
            }
            bx.int.do(graphics, stringBuffer2.append(string2).toString(), if[17], n, if[3]);
            bx.int.do(graphics, "Ng\u00e0y up: " + aq_0.do().if, if[17], n += 14, if[3]);
            if (aq_0.catch(aq_0.const(do, 0L))) {
                bx.int.do(graphics, "Ng\u00e0y h\u1ebft h\u1ea1n: " + aq_0.do().for, if[17], n += 14, if[3]);
            }
            if (aq_0.catch(if)) {
                bx.int.do(graphics, "Xu c\u1ea7n up: " + bx.do(if), if[17], n += 14, if[3]);
            }
            n += 14;
            StringBuffer stringBuffer3 = new StringBuffer().append("Xu up \u0111\u01b0\u1ee3c: ");
            if (aq_0.catch(for)) {
                string = bx.do(for);
                "".length();
                if ("  ".length() <= 0) {
                    return;
                }
            } else if (aq_0.const(for)) {
                string = "-" + bx.do(Math.abs(for));
                "".length();
                if (null != null) {
                    return;
                }
            } else {
                string = "0";
            }
            bx.int.do(graphics, stringBuffer3.append(string).toString(), if[17], n, if[3]);
            if (aq_0.do((int)AngelChip.do.for, if[7]) && aq_0.this(bp_0.do ? 1 : 0)) {
                String string4;
                n += 14;
                StringBuffer stringBuffer4 = new StringBuffer().append("Tim thu \u0111\u01b0\u1ee3c: ");
                if (aq_0.catch(int)) {
                    string4 = bx.do(int);
                    "".length();
                    if (" ".length() == 0) {
                        return;
                    }
                } else {
                    string4 = "0";
                }
                bx.int.do(graphics, stringBuffer4.append(string4).toString(), if[17], n, if[3]);
            }
            n += 20;
            if (aq_0.do(bx_0.do)) {
                if (aq_0.this(bx_0.do instanceof bs_0)) {
                    if (aq_0.this(bs_0.do ? 1 : 0)) {
                        String string5;
                        int n3 = (int)((bs_0.do().do - System.currentTimeMillis()) / 1000L);
                        StringBuffer stringBuffer5 = new StringBuffer().append("Farming: ");
                        if (aq_0.catch(n3)) {
                            fo_0.do();
                            "".length();
                            string5 = fo_0.do(n3);
                            "".length();
                            if (" ".length() < 0) {
                                return;
                            }
                        } else {
                            string5 = "xin ch\u1edd...";
                        }
                        bx.int.do(graphics, stringBuffer5.append(string5).toString(), if[17], n, if[3]);
                        n += 20;
                    }
                    bx.int.do(graphics, "C\u00e1 c\u00e2u \u0111\u01b0\u1ee3c: " + bs_0.new, if[17], n, if[3]);
                    bx.int.do(graphics, "C\u00e1 m\u1eadp: " + bs_0.do, if[17], n += 14, if[3]);
                    if (aq_0.this(bs_0.int ? 1 : 0)) {
                        bx.int.do(graphics, "KCX: +" + bs_0.try, if[17], n += 14, if[3]);
                        return;
                    }
                } else if (aq_0.this(bx_0.do instanceof P)) {
                    bx.int.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs_0.int, if[17], n, if[3]);
                    if (aq_0.do(P.if, if[7]) && aq_0.do(P.int, if[7])) {
                        bx.int.do(graphics, "S\u1ed1 l\u01b0\u1ee3ng: " + P.if + "/" + P.int, if[17], n += 14, if[3]);
                        return;
                    }
                } else {
                    if (aq_0.this(bx_0.do instanceof d_0) && aq_0.catch(aq_0.const(d_0.do, 0L))) {
                        int n4 = (int)((d_0.if - d_0.do) / 1000L);
                        StringBuffer stringBuffer6 = new StringBuffer().append("Th\u1eddi gian: ");
                        fo_0.do();
                        "".length();
                        bx.int.do(graphics, stringBuffer6.append(fo_0.do(n4)).toString(), if[17], n, if[3]);
                        bx.int.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs_0.int, if[17], n += 14, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof ah)) {
                        bx.int.do(graphics, "Tr\u1ea3 l\u1eddi win: " + bx_0.do.do(), if[17], n, if[3]);
                        bx.int.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs_0.int, if[17], n += 14, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof al) && aq_0.this(al.try ? 1 : 0)) {
                        String string6;
                        int n5 = (int)((al.do().if - System.currentTimeMillis()) / 1000L);
                        StringBuffer stringBuffer7 = new StringBuffer().append("Farming: ");
                        if (aq_0.catch(n5)) {
                            fo_0.do();
                            "".length();
                            string6 = fo_0.do(n5);
                            "".length();
                            if (null != null) {
                                return;
                            }
                        } else {
                            string6 = "xin ch\u1edd...";
                        }
                        bx.int.do(graphics, stringBuffer7.append(string6).toString(), if[17], n, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof dO)) {
                        bx.int.do(graphics, dO.do.if(), if[17], n, if[3]);
                        bx.int.do(graphics, dO.do.for(), if[17], n += 14, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof co)) {
                        bx.int.do(graphics, co.do.for(), if[17], n, if[3]);
                        bx.int.do(graphics, co.do.if(), if[17], n += 14, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof ez_0)) {
                        String string7;
                        int n6 = (int)((ez_0.do().do - System.currentTimeMillis()) / 1000L);
                        StringBuffer stringBuffer8 = new StringBuffer().append("Farming: ");
                        if (aq_0.catch(n6)) {
                            fo_0.do();
                            "".length();
                            string7 = fo_0.do(n6);
                            "".length();
                            if (((0x37 ^ 0x5A ^ (0x1B ^ 0x6E)) & (44 + 105 - 114 + 106 ^ 132 + 41 - 152 + 128 ^ -" ".length())) == "   ".length()) {
                                return;
                            }
                        } else {
                            string7 = "xin ch\u1edd...";
                        }
                        bx.int.do(graphics, stringBuffer8.append(string7).toString(), if[17], n, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof fy_0) && aq_0.catch(aq_0.const(fy_0.do, 0L))) {
                        bx.int.do(graphics, "Ra t\u00f9 sau: " + fy_0.if(), if[17], n, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof gt_0)) {
                        bx.int.do(graphics, gt_0.do().if(), if[17], n, if[3]);
                        bx.int.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs_0.int, if[17], n += 14, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof gj_0)) {
                        String string8;
                        StringBuffer stringBuffer9 = new StringBuffer().append("S\u1ed1 l\u1ea7n farm: ").append(gj_0.if).append(" / ");
                        if (aq_0.catch(gj_0.do)) {
                            string8 = String.valueOf(gj_0.do);
                            "".length();
                            if (((0x49 ^ 0x5C) & ~(4 ^ 0x11)) != 0) {
                                return;
                            }
                        } else {
                            string8 = "KGH";
                        }
                        bx.int.do(graphics, stringBuffer9.append(string8).toString(), if[17], n, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof bO)) {
                        bx.int.do(graphics, "\u0110\u00e3 h\u00f4n: " + bO.do + " l\u1ea7n", if[17], n, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof N)) {
                        bx.int.do(graphics, "\u0110\u00e3 \u0111\u00e1nh: " + N.do + " l\u1ea7n", if[17], n, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof az_0)) {
                        String string9;
                        if (aq_0.this(bx.do instanceof dT)) {
                            bx.int.do(graphics, "Friend: " + dT.do().do, if[17], n, if[3]);
                            n += 20;
                        }
                        StringBuffer stringBuffer10 = new StringBuffer().append("S\u1ed1 l\u1ea7n farm: ").append(az_0.do).append(" / ");
                        if (aq_0.catch(az_0.int)) {
                            string9 = String.valueOf(az_0.int);
                            "".length();
                            if ((0x4D ^ 0x21 ^ (0x1F ^ 0x77)) == 0) {
                                return;
                            }
                        } else {
                            string9 = "KGH";
                        }
                        bx.int.do(graphics, stringBuffer10.append(string9).toString(), if[17], n, if[3]);
                        bx.int.do(graphics, "C\u1ecf \u0111\u00e3 di\u1ec7t: " + az_0.for, if[17], n += 14, if[3]);
                        bx.int.do(graphics, "S\u00e2u \u0111\u00e3 di\u1ec7t: " + az_0.if, if[17], n += 14, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof co_0)) {
                        bx.int.do(graphics, "S\u1ed1 l\u1ea7n HPHV: " + bx_0.do.do(), if[17], n, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof an)) {
                        bx.int.do(graphics, "Bi\u1ebfn h\u00ecnh: " + bx_0.do.a_(), if[17], n, if[3]);
                        bx.int.do(graphics, "S\u1ed1 l\u1ea7n: " + bx_0.do.do(), if[17], n += 14, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof gr)) {
                        String string10;
                        int n7 = (int)((gr.do().do - System.currentTimeMillis()) / 1000L);
                        StringBuffer stringBuffer11 = new StringBuffer().append("Farming: ");
                        if (aq_0.catch(n7)) {
                            fo_0.do();
                            "".length();
                            string10 = fo_0.do(n7);
                            "".length();
                            if (null != null) {
                                return;
                            }
                        } else {
                            string10 = "xin ch\u1edd...";
                        }
                        bx.int.do(graphics, stringBuffer11.append(string10).toString(), if[17], n, if[3]);
                        return;
                    }
                    if (aq_0.this(bx_0.do instanceof V)) {
                        bx.int.do(graphics, "Focus: " + V.do().do(), if[17], n, if[3]);
                        bx.int.do(graphics, "Success: " + V.do().if + " / " + V.do().a_(), if[17], n += 14, if[3]);
                        bx.int.do(graphics, "Point: " + V.do().do, if[17], n += 14, if[3]);
                    }
                }
            }
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void long() {
        if (aq_0.this(void ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if (-" ".length() > 0) {
                return;
            }
            void = if[3];
        }
    }

    public static boolean if(String string) {
        if (aq_0.do(bx_0.do) && aq_0.this(bx_0.do ? 1 : 0)) {
            return bx_0.do.do(string);
        }
        return if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void this() {
        if (aq_0.this(char ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if (-"  ".length() >= 0) {
                return;
            }
            char = if[3];
        }
    }

    private static int else(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean byte(long l) {
        long l2;
        block7: {
            byte = if[2];
            l2 = System.currentTimeMillis();
            Object object = do;
            synchronized (object) {
                try {
                    do.wait(l);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                    break block7;
                }
                if ("  ".length() == 0) {
                    return ((0x5F ^ 0x62) & ~(0x8A ^ 0xB7)) != 0;
                }
            }
        }
        "".length();
        if ("   ".length() == (0x3C ^ 0x38)) {
            return ((0x3D ^ 0x13) & ~(0x8C ^ 0xA2)) != 0;
        }
        if (aq_0.const(aq_0.byte(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void void() {
        if (aq_0.this(case ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if (-" ".length() >= "  ".length()) {
                return;
            }
            case = if[3];
        }
    }

    public static void do(String string, String string2) {
        int n;
        int n2;
        if (aq_0.this(string.equals("admin") ? 1 : 0) && aq_0.do(n2 = string2.indexOf("T\u00e0i kho\u1ea3n c\u1ee7a b\u1ea1n b\u1ecb kh\u00f3a trong "), if[7]) && aq_0.do(n = string2.indexOf(" ph\u00fat"), if[7])) {
            string = string2.substring(n2 + "T\u00e0i kho\u1ea3n c\u1ee7a b\u1ea1n b\u1ecb kh\u00f3a trong ".length(), n);
            try {
                fy_0.do = (long)(Integer.parseInt(string) + if[2]) * 60000L;
                return;
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
                fy_0.do = 0L;
                return;
            }
        }
        if (aq_0.do(bx_0.do) && aq_0.this(bx_0.do ? 1 : 0)) {
            bx_0.do.do(string, string2);
        }
    }

    public static void do(int n, String string) {
        AngelChip.do.do = (byte)null;
        AngelChip.do.do(n, string, if[2]);
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean case(long l) {
        else = if[2];
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
        if (aq_0.const(aq_0.class(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    private static boolean int(int n, int n2) {
        return n == n2;
    }

    private static boolean void(int n) {
        return n == 0;
    }

    public static String for(String string) {
        String string2 = "";
        int n = if[3];
        while (aq_0.try(n, string.length())) {
            char c2 = string.charAt(n);
            if (aq_0.if(c2, if[12]) && aq_0.for(c2, if[13])) {
                string2 = string2 + c2;
            }
            ++n;
            "".length();
            if ("  ".length() >= "  ".length()) continue;
            return null;
        }
        return string2;
    }

    private static int goto(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public static String if() {
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeZone(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
        return "B\u00e2y gi\u1edd l\u00e0 " + calendar.get(if[4]) + ":" + calendar.get(if[5]) + ":" + calendar.get(if[6]);
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static int long(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public static int do() {
        if (aq_0.do((Object)do) && aq_0.catch(do.length)) {
            return do.length - if[2];
        }
        return if[3];
    }

    public static void do(String string, fn_0 fn_02) {
        Vector<fn_0> vector = new Vector<fn_0>();
        vector.addElement(fn_02);
        bx.if(string, vector);
    }

    private static boolean new(int n, int n2) {
        return n > n2;
    }

    public static void if(String string) {
        if (aq_0.do((Object)string) && aq_0.void(string.trim().equals("") ? 1 : 0)) {
            ad_0.do = null;
            ad_0.do().do(new Hashtable(), "N\u1ed9i dung c\u1eadp nh\u1eadt", string, if[7]);
            bx.do = ad_0.do();
        }
    }

    private static boolean try(int n, int n2) {
        return n < n2;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void break() {
        if (aq_0.this(goto ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if (" ".length() <= 0) {
                return;
            }
            goto = if[3];
        }
    }

    public static dF do(String string) {
        int n = if[3];
        while (aq_0.try(n, fj.if.size())) {
            dF dF2 = (dF)fj.if.elementAt(n);
            if (aq_0.do(dF2) && aq_0.this(dF2.do.toLowerCase().equals(string) ? 1 : 0)) {
                return dF2;
            }
            ++n;
            "".length();
            if (((0xE9 ^ 0xAB ^ (0x40 ^ 6)) & (71 + 12 - 14 + 66 ^ 58 + 2 - -37 + 34 ^ -" ".length())) < " ".length()) continue;
            return null;
        }
        return null;
    }

    private static boolean break(int n) {
        if (aq_0.int(n, if[39])) {
            return if[2];
        }
        return if[3];
    }

    private static boolean catch(int n) {
        return n > 0;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void catch() {
        if (aq_0.this(long ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            long = if[3];
        }
    }

    static {
        aq_0.const();
        for = if[3];
        this = if[3];
        void = if[3];
        new = if[3];
        char = if[3];
        case = if[3];
        goto = if[3];
        if = if[3];
        else = if[3];
        byte = if[3];
        do = if[3];
        long = if[3];
        try = if[3];
        do = new Object();
        do = new Random();
        do = null;
        if = if[3];
        do = if[3];
        do = 0L;
        int = 0L;
        for = 0L;
        for = if[3];
        int = if[3];
        int = if[3];
        int[] nArray = new int[if[39]];
        nArray[aq_0.if[3]] = if[21];
        nArray[aq_0.if[2]] = if[55];
        nArray[aq_0.if[1]] = if[56];
        nArray[aq_0.if[18]] = if[55];
        nArray[aq_0.if[17]] = if[57];
        nArray[aq_0.if[0]] = if[58];
        nArray[aq_0.if[24]] = if[59];
        nArray[aq_0.if[9]] = if[60];
        nArray[aq_0.if[27]] = if[57];
        nArray[aq_0.if[19]] = if[61];
        nArray[aq_0.if[45]] = if[58];
        nArray[aq_0.if[4]] = if[59];
        nArray[aq_0.if[5]] = if[60];
        nArray[aq_0.if[6]] = if[62];
        nArray[aq_0.if[44]] = if[63];
        nArray[aq_0.if[14]] = if[63];
        nArray[aq_0.if[8]] = if[64];
        nArray[aq_0.if[50]] = if[59];
        nArray[aq_0.if[31]] = if[65];
        nArray[aq_0.if[54]] = if[65];
        nArray[aq_0.if[16]] = if[9];
        new = aq_0.do(nArray);
        int[] nArray2 = new int[if[0]];
        nArray2[aq_0.if[3]] = if[66];
        nArray2[aq_0.if[2]] = if[67];
        nArray2[aq_0.if[1]] = if[68];
        nArray2[aq_0.if[18]] = if[69];
        nArray2[aq_0.if[17]] = if[18];
        int = aq_0.do(nArray2);
        do = (byte)if[3];
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean char(long l) {
        do = if[2];
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
        if ((0x3C ^ 0x6E ^ (0xCA ^ 0x9C)) < "  ".length()) {
            return ((0x77 ^ 0x78 ^ (0x5A ^ 0x15)) & (68 + 121 - 6 + 47 ^ 14 + 144 - 92 + 100 ^ -" ".length())) != 0;
        }
        if (aq_0.const(aq_0.goto(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    private static int this(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean class(int n) {
        if (aq_0.long(n) && !aq_0.new(n, if[27]) || !aq_0.do(n, if[45]) || aq_0.int(n, if[4])) {
            return if[2];
        }
        return if[3];
    }

    private static int void(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static String new(String string) {
        if (aq_0.do(string.indexOf(if[11]), if[7])) {
            StringBuffer stringBuffer = new StringBuffer();
            int n = if[3];
            while (aq_0.try(n, string.length())) {
                char c2 = string.charAt(n);
                if (aq_0.do((int)c2, if[11])) {
                    stringBuffer.append(c2);
                    "".length();
                }
                ++n;
                "".length();
                if ("   ".length() >= 0) continue;
                return null;
            }
            return stringBuffer.toString();
        }
        return string;
    }

    private static boolean const(int n) {
        return n < 0;
    }

    private static int break(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public static boolean try(int n) {
        if (aq_0.int(fj.new, n)) {
            return if[2];
        }
        if (aq_0.int(n, if[43])) {
            if (aq_0.void(aq_0.break(fj.new) ? 1 : 0)) {
                if (aq_0.void(aq_0.try(if[39]) ? 1 : 0)) {
                    return if[3];
                }
                aq_0.if(3500L);
            }
            if (aq_0.this(aq_0.break(fj.new) ? 1 : 0)) {
                er_0.do().int(AngelChip.do.char);
                aq_0.else(30000L);
                "".length();
            }
            if (aq_0.int(fj.new, if[43])) {
                return if[2];
            }
            return if[3];
        }
        if (!aq_0.long(n) || !aq_0.for(n, if[11]) || !aq_0.do(bd.do) || aq_0.void(bd.do[n][if[3]]) && aq_0.void(bd.do[n][if[2]])) {
            return if[3];
        }
        if (aq_0.this(aq_0.float(fj.new) ? 1 : 0) && (!aq_0.do((int)AngelChip.do.byte, if[1]) || aq_0.int(AngelChip.do.byte, if[6]))) {
            w_0.do().if(if[1], if[3]);
            aq_0.if(1000L);
        }
        if (aq_0.this(aq_0.do(n) ? 1 : 0)) {
            if (!(!aq_0.void(aq_0.for() ? 1 : 0) || aq_0.void(aq_0.goto(fj.new) ? 1 : 0) && aq_0.void(aq_0.break(fj.new) ? 1 : 0) && aq_0.void(aq_0.else(fj.new) ? 1 : 0) && aq_0.void(aq_0.case(fj.new) ? 1 : 0) && aq_0.void(aq_0.char(fj.new) ? 1 : 0) && !aq_0.void(aq_0.do(fj.new) ? 1 : 0))) {
                gs_0.do().return();
                if (aq_0.void(aq_0.for() ? 1 : 0)) {
                    return if[3];
                }
                aq_0.if(1000L);
            }
            if (aq_0.this(aq_0.for() ? 1 : 0)) {
                if (aq_0.int(n, if[6])) {
                    gQ.do().do = if[2];
                    "".length();
                    if ((4 + 143 - 124 + 171 ^ 136 + 119 - 189 + 132) == -" ".length()) {
                        return ((0x22 ^ 0x5E ^ (0xB1 ^ 0x8A)) & (0x24 ^ 0x66 ^ (0xB8 ^ 0xBD) ^ -" ".length())) != 0;
                    }
                } else if (aq_0.int(n, if[19])) {
                    gQ.do().do = if[18];
                    "".length();
                    if (-"   ".length() > 0) {
                        return ((0x2B ^ 0x78) & ~(0xC0 ^ 0x93)) != 0;
                    }
                } else if (aq_0.int(n, if[32])) {
                    gQ.do().do = if[17];
                    "".length();
                    if (((0xFA ^ 0xA1) & ~(0x56 ^ 0xD)) != ((0x7B ^ 0x33) & ~(0x47 ^ 0xF))) {
                        return ((0xB4 ^ 0x97) & ~(0x84 ^ 0xA7)) != 0;
                    }
                } else if (aq_0.this(aq_0.class(n) ? 1 : 0)) {
                    gQ.do().do = if[0];
                    "".length();
                    if ((0x7A ^ 0x7F) <= 0) {
                        return ((0xA4 ^ 0x86) & ~(7 ^ 0x25)) != 0;
                    }
                } else {
                    gQ.do().do = if[24];
                }
                fv_0.do().int(if[19]);
                if (aq_0.void(aq_0.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
                if (aq_0.int(n, fj.new)) {
                    return if[2];
                }
                aq_0.if(3500L);
            }
            if (aq_0.do(n, fj.new)) {
                fj.int = bd.do[n][if[3]];
                fj.byte = bd.do[n][if[2]];
                fp.do().do(n, if[7]);
                if (aq_0.void(aq_0.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
            }
            return if[2];
        }
        if (aq_0.this(aq_0.goto(n) ? 1 : 0)) {
            if (!aq_0.do(fj.new, if[48]) || aq_0.int(fj.new, if[49])) {
                dT.do().else();
                if (aq_0.void(aq_0.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
                if (aq_0.int(fj.new, if[38])) {
                    return if[2];
                }
            }
            if (aq_0.void(aq_0.for() ? 1 : 0)) {
                gs_0.do().return();
                if (aq_0.void(aq_0.for() ? 1 : 0)) {
                    return if[3];
                }
                aq_0.if(1000L);
            }
            if (aq_0.do(bx.do)) {
                bx.case();
            }
            if (aq_0.this(aq_0.for() ? 1 : 0)) {
                bx.for(bT.Z);
                gQ.do().do = if[9];
                fv_0.do().int(if[45]);
                if (aq_0.void(aq_0.else(60000L) ? 1 : 0)) {
                    bx.case();
                    return if[3];
                }
            }
            bx.case();
            return if[2];
        }
        if (aq_0.this(aq_0.break(n) ? 1 : 0)) {
            if (aq_0.void(aq_0.for() ? 1 : 0)) {
                gs_0.do().return();
                if (aq_0.void(aq_0.for() ? 1 : 0)) {
                    return if[3];
                }
                aq_0.if(1000L);
            }
            if (aq_0.this(aq_0.for() ? 1 : 0)) {
                gQ.do().do = if[3];
                fv_0.do().int(if[4]);
                if (aq_0.void(aq_0.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
            }
            return if[2];
        }
        if (!aq_0.void(aq_0.case(n) ? 1 : 0) || !aq_0.void(aq_0.char(n) ? 1 : 0) || aq_0.this(aq_0.else(n) ? 1 : 0)) {
            if (aq_0.this(aq_0.case(n) ? 1 : 0) && !aq_0.void(aq_0.case(fj.new) ? 1 : 0) || aq_0.this(aq_0.char(n) ? 1 : 0) && !aq_0.void(aq_0.char(fj.new) ? 1 : 0) || aq_0.this(aq_0.else(n) ? 1 : 0) && aq_0.this(aq_0.else(fj.new) ? 1 : 0)) {
                fj.int = bd.do[n][if[3]];
                fj.byte = bd.do[n][if[2]];
                if (!aq_0.do(n, if[33]) || !aq_0.do(n, if[35]) || aq_0.int(n, if[37])) {
                    fv_0.do().if(if[50]);
                    "".length();
                    if ((0x58 ^ 0x5C) < 0) {
                        return ((0x27 ^ 9) & ~(0x54 ^ 0x7A)) != 0;
                    }
                } else if (!aq_0.do(n, if[51]) || !aq_0.do(n, if[36]) || aq_0.int(n, if[52])) {
                    fv_0.do().if(if[31]);
                    "".length();
                    if (-" ".length() >= 0) {
                        return ((0x24 ^ 7 ^ (0x30 ^ 0x3F) & ~(0x9D ^ 0x92)) & (0x5B ^ 0x4C ^ (0xB7 ^ 0x83) ^ -" ".length())) != 0;
                    }
                } else if (!aq_0.do(n, if[53]) || aq_0.int(n, if[13])) {
                    fv_0.do().if(if[54]);
                    "".length();
                    if ((0x7B ^ 0x7F) > (0x57 ^ 0x53)) {
                        return ((8 ^ 0x54) & ~(3 ^ 0x5F)) != 0;
                    }
                } else if (!aq_0.do(n, if[34]) || aq_0.int(n, if[11])) {
                    fv_0.do().if(if[16]);
                }
                if (aq_0.void(aq_0.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
                return if[2];
            }
            if (aq_0.void(aq_0.for() ? 1 : 0)) {
                gs_0.do().return();
                if (aq_0.void(aq_0.for() ? 1 : 0)) {
                    return if[3];
                }
                aq_0.if(1000L);
            }
            if (aq_0.this(aq_0.for() ? 1 : 0)) {
                gQ.do().do = if[1];
                fv_0.do().int(if[19]);
                if (aq_0.void(aq_0.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
                aq_0.if(500L);
                if (aq_0.this(aq_0.case(n) ? 1 : 0)) {
                    fv_0.do().do(if[0], if[3], if[3]);
                    "".length();
                    if ((0xA9 ^ 0xAD) <= "  ".length()) {
                        return ((0x5B ^ 0x51) & ~(0x5A ^ 0x50)) != 0;
                    }
                } else if (aq_0.this(aq_0.char(n) ? 1 : 0)) {
                    fv_0.do().do(if[0], if[3], if[2]);
                    "".length();
                    if (((0x9F ^ 0xB9) & ~(9 ^ 0x2F)) != ((0xA8 ^ 0x92) & ~(0x7D ^ 0x47))) {
                        return ((0x60 ^ 0x29) & ~(0x3C ^ 0x75)) != 0;
                    }
                } else if (aq_0.this(aq_0.else(n) ? 1 : 0)) {
                    fv_0.do().do(if[0], if[3], if[1]);
                }
                if (aq_0.void(aq_0.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
                if (aq_0.int(n, fj.new)) {
                    return if[2];
                }
                aq_0.if(4000L);
            }
            if (aq_0.do(n, fj.new)) {
                fj.int = bd.do[n][if[3]];
                fj.byte = bd.do[n][if[2]];
                if (!aq_0.do(n, if[33]) || !aq_0.do(n, if[35]) || aq_0.int(n, if[37])) {
                    fv_0.do().if(if[50]);
                    "".length();
                    if (-" ".length() >= ((0x99 ^ 0xB9) & ~(0xC ^ 0x2C))) {
                        return ((0x31 ^ 0x2E) & ~(0xD9 ^ 0xC6)) != 0;
                    }
                } else if (!aq_0.do(n, if[51]) || !aq_0.do(n, if[36]) || aq_0.int(n, if[52])) {
                    fv_0.do().if(if[31]);
                    "".length();
                    if (((0x23 ^ 0x45 ^ (0x80 ^ 0xC0)) & (0x53 ^ 0x70 ^ (0x76 ^ 0x73) ^ -" ".length())) > 0) {
                        return ((0xAE ^ 0xC4 ^ (0x1A ^ 0x57)) & (134 + 13 - 81 + 70 ^ 158 + 168 - 208 + 57 ^ -" ".length())) != 0;
                    }
                } else if (!aq_0.do(n, if[53]) || aq_0.int(n, if[13])) {
                    fv_0.do().if(if[54]);
                    "".length();
                    if (((0x2B ^ 0x7E ^ (0x65 ^ 0x51)) & (0xED ^ 0x9E ^ (0xA2 ^ 0xB0) ^ -" ".length())) != 0) {
                        return ((0x68 ^ 0x15 ^ (0x57 ^ 0x2D)) & (0x3C ^ 0x1D ^ (0xAF ^ 0x89) ^ -" ".length())) != 0;
                    }
                } else if (!aq_0.do(n, if[34]) || aq_0.int(n, if[11])) {
                    fv_0.do().if(if[16]);
                }
                if (aq_0.void(aq_0.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
            }
            return if[2];
        }
        return if[3];
    }

    public static boolean byte(int n) {
        if (aq_0.this(bx.do instanceof er)) {
            er.do().for();
        }
        if (aq_0.this(bx.do instanceof fs)) {
            fs.do().int();
        }
        if (aq_0.this(bx.do instanceof fx_0)) {
            fx_0.do().do.try();
        }
        if (aq_0.this(bx.do instanceof w_0)) {
            w_0.do().if(if[1], if[3]);
            aq_0.if(1000L);
        }
        if (!aq_0.void(bx.do instanceof gK) || aq_0.this(bx.do instanceof y_0)) {
            y_0.do.do(if[3]);
            if (aq_0.this(aq_0.else(30000L) ? 1 : 0)) {
                aq_0.if(2000L);
            }
        }
        if (aq_0.this(bx.do instanceof q)) {
            bx.do.if = if[3];
            eb_0.do().do();
            if (aq_0.this(aq_0.else(30000L) ? 1 : 0)) {
                aq_0.if(2000L);
            }
        }
        if (!aq_0.void(bx.do instanceof fq_0) || aq_0.this(bx.do instanceof ey_0)) {
            fv_0.do().int(if[19]);
            if (aq_0.this(aq_0.else(30000L) ? 1 : 0)) {
                aq_0.if(2000L);
            }
        }
        if (aq_0.this(bx.do instanceof aO)) {
            fj.int = if[46];
            fj.byte = if[47];
            aO.do().if(if[2], if[7]);
            if (aq_0.this(aq_0.else(30000L) ? 1 : 0)) {
                aq_0.if(3500L);
            }
        }
        return aq_0.try(n);
    }

    private static int catch(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean final(int n) {
        return n <= 0;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void class() {
        if (aq_0.this(else ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            else = if[3];
        }
    }

    public static String[] do(String objectArray, String string) {
        int n;
        if (!aq_0.do((Object)string) || aq_0.this(string.equals("") ? 1 : 0)) {
            String[] stringArray = new String[if[2]];
            stringArray[aq_0.if[3]] = objectArray;
            return stringArray;
        }
        Vector<String> vector = new Vector<String>();
        if (aq_0.void(objectArray.endsWith(string) ? 1 : 0)) {
            objectArray = (String)objectArray + string;
        }
        int n2 = if[3];
        while (aq_0.do(n = objectArray.indexOf(string, n2), if[7])) {
            vector.addElement(objectArray.substring(n2, n));
            n2 = n + string.length();
            "".length();
            if (" ".length() >= 0) continue;
            return null;
        }
        objectArray = new String[vector.size()];
        vector.copyInto(objectArray);
        return objectArray;
    }

    private static boolean float(int n) {
        if (!aq_0.do(n, if[44]) || !aq_0.do(n, if[14]) || aq_0.int(n, if[8])) {
            return if[2];
        }
        return if[3];
    }

    public static void do(String string, String string2, dh_0 dh_02) {
        Vector<fn_0> vector = new Vector<fn_0>();
        vector.addElement(new fn_0(string, dh_02));
        vector.addElement(bx.do);
        bx.if(string2, vector);
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static boolean else(long l) {
        long l2;
        block6: {
            for = if[2];
            l2 = System.currentTimeMillis();
            Object object = do;
            synchronized (object) {
                try {
                    do.wait(l);
                    "".length();
                }
                catch (InterruptedException interruptedException) {
                    "".length();
                    break block6;
                }
                if (((0xA ^ 0x67 ^ (0x8C ^ 0xA1)) & (0x29 ^ 0x32 ^ (0x19 ^ 0x42) ^ -" ".length())) != 0) {
                    return ((0xE4 ^ 0xBB ^ (0x52 ^ 0x36)) & (67 + 0 - -53 + 134 ^ 75 + 17 - 86 + 191 ^ -" ".length())) != 0;
                }
            }
        }
        "".length();
        if (aq_0.const(aq_0.break(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    private static boolean if(Object object) {
        return object == null;
    }

    private static int class(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static int const(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }
}

