/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  N
 *  P
 *  V
 *  W
 *  Y
 *  aC
 *  aD
 *  aO
 *  aX
 *  aZ
 *  ah
 *  al
 *  an
 *  az
 *  bO
 *  bP
 *  bS
 *  bT
 *  bX
 *  bd
 *  br
 *  bx
 *  cO
 *  co
 *  cs
 *  d
 *  dF
 *  dO
 *  dT
 *  dh
 *  eB
 *  eR
 *  eY
 *  eZ
 *  ep
 *  er
 *  fN
 *  fO
 *  fQ
 *  fV
 *  fX
 *  fY
 *  fj
 *  fp
 *  fs
 *  gJ
 *  gK
 *  gQ
 *  gT
 *  gY
 *  ge
 *  gr
 *  gs
 *  javax.microedition.lcdui.Graphics
 *  main.AngelChip
 *  q
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
 */
public final class aQ {
    public static String do;
    public static boolean do;
    private static final String int;
    private static final Random do;
    public static boolean if;
    private long new = 0L;
    public static long do;
    private static final Object do;
    public String if;
    private static aQ do;
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
        if (aQ.catch(aQ.do(do, 0L))) {
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
        if (aQ.long(n) && !aQ.new(n, if[31]) || aQ.int(n, if[32])) {
            return if[2];
        }
        return if[3];
    }

    private static boolean case(int n) {
        if (aQ.if(n, if[33]) && aQ.for(n, if[34])) {
            return if[2];
        }
        return if[3];
    }

    public static boolean do(ep ep2) {
        long l = System.currentTimeMillis();
        while (aQ.const(aQ.if(System.currentTimeMillis() - l, 30000L))) {
            if (aQ.do(bx.do, ep2)) {
                return if[2];
            }
            aQ.if(100L);
            "".length();
            if (-(0x3A ^ 0x3E) <= 0) continue;
            return ((0xB0 ^ 0xA2) & ~(0x19 ^ 0xB)) != 0;
        }
        return if[3];
    }

    private static boolean char(int n) {
        if (!aQ.do(n, if[35]) || aQ.int(n, if[36])) {
            return if[2];
        }
        return if[3];
    }

    public static void if() {
        aQ.break();
        aQ.byte();
        aQ.class();
        aQ.case();
        aQ.for();
        aQ.try();
        aQ.long();
        aQ.goto();
        aQ.this();
        aQ.void();
        aQ.char();
        aQ.catch();
        aQ.new();
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

    public static void do(String string, fN fN2, fN fN3) {
        Vector<fN> vector = new Vector<fN>();
        vector.addElement(fN2);
        vector.addElement(fN3);
        vector.addElement(bx.do);
        bx.if((String)string, vector);
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
        if (aQ.const(aQ.void(System.currentTimeMillis() - l2, l))) {
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
        if (aQ.const(aQ.long(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    private static void const() {
        if = new int[70];
        aQ.if[0] = 61 + 80 - 112 + 161 ^ 25 + 49 - -30 + 83;
        aQ.if[1] = "  ".length();
        aQ.if[2] = " ".length();
        aQ.if[3] = (172 + 116 - 150 + 45 ^ 145 + 42 - 62 + 24) & (58 + 87 - 44 + 68 ^ 50 + 44 - -29 + 16 ^ -" ".length());
        aQ.if[4] = 0x7A ^ 0x71;
        aQ.if[5] = 2 + 53 - 23 + 102 ^ 46 + 27 - 12 + 77;
        aQ.if[6] = 82 + 99 - 120 + 112 ^ 28 + 37 - -63 + 32;
        aQ.if[7] = -" ".length();
        aQ.if[8] = 117 + 111 - 192 + 119 ^ 9 + 130 - 18 + 18;
        aQ.if[9] = 0x2F ^ 0x28;
        aQ.if[10] = 0xBA ^ 0x95;
        aQ.if[11] = 0x9A ^ 0xA0;
        aQ.if[12] = 0xB1 ^ 0x81;
        aQ.if[13] = 5 ^ 0x36 ^ (0x15 ^ 0x1F);
        aQ.if[14] = 0x67 ^ 0x3A ^ (0x3A ^ 0x68);
        aQ.if[15] = 0xC ^ 0x2F;
        aQ.if[16] = 0x6F ^ 6 ^ (0x30 ^ 0x4D);
        aQ.if[17] = 0xA0 ^ 0xA4;
        aQ.if[18] = "   ".length();
        aQ.if[19] = 0x99 ^ 0x90;
        aQ.if[20] = 85 + 204 - 254 + 193 ^ 95 + 31 - -10 + 5;
        aQ.if[21] = 120 + 75 - -6 + 12 ^ 31 + 84 - -32 + 24;
        aQ.if[22] = 0x57 ^ 0x2B;
        aQ.if[23] = 0xC ^ 0x76;
        aQ.if[24] = 0xB3 ^ 0xB5;
        aQ.if[25] = 0x88 ^ 0x90 ^ (0xF4 ^ 0xB7);
        aQ.if[26] = 0x36 ^ 0x68;
        aQ.if[27] = 0xB ^ 0xF ^ (0x45 ^ 0x49);
        aQ.if[28] = 0x87 ^ 0xBC;
        aQ.if[29] = 0x7B ^ 0x47 ^ (0x3F ^ 0x2F);
        aQ.if[30] = 0xFFFFA12F & 0x5FFC;
        aQ.if[31] = 50 + 84 - -10 + 6 ^ 111 + 97 - 186 + 110;
        aQ.if[32] = 61 + 124 - 173 + 124 ^ 119 + 138 - 132 + 34;
        aQ.if[33] = 0xA9 ^ 0xB2;
        aQ.if[34] = 0x92 ^ 0x8C;
        aQ.if[35] = 0xB1 ^ 0x90;
        aQ.if[36] = 0x7B ^ 0x62 ^ (0x57 ^ 0x6C);
        aQ.if[37] = 158 + 23 - 82 + 88 ^ 74 + 117 - 189 + 138;
        aQ.if[38] = 190 + 10 - 78 + 94 ^ 34 + 18 - -49 + 92;
        aQ.if[39] = 0x75 ^ 0x60;
        aQ.if[40] = " ".length() ^ (0x11 ^ 0x54);
        aQ.if[41] = 0xF9 ^ 0xBC;
        aQ.if[42] = 43 + 9 - -80 + 99 ^ 90 + 103 - 163 + 131;
        aQ.if[43] = 0xFF ^ 0x91;
        aQ.if[44] = 0x90 ^ 0x9E;
        aQ.if[45] = 174 + 22 - 56 + 35 ^ 7 + 163 - 125 + 120;
        aQ.if[46] = -(0xFFFFEEFD & 0x5F2F) & (0xFFFFCF7F & 0x7FAE);
        aQ.if[47] = 96 + 14 - 25 + 71;
        aQ.if[48] = 0xA2 ^ 0xBA;
        aQ.if[49] = 0x73 ^ 0x46;
        aQ.if[50] = 0x72 ^ 0x63;
        aQ.if[51] = 0xBC ^ 0xAF ^ (0x7D ^ 0x72);
        aQ.if[52] = 171 + 178 - 173 + 5 ^ 132 + 11 - 124 + 122;
        aQ.if[53] = 0x3A ^ 0x22 ^ (0x55 ^ 0x50);
        aQ.if[54] = 0x54 ^ 0x3A ^ (0xDD ^ 0xA0);
        aQ.if[55] = 0x4D ^ 0x38;
        aQ.if[56] = 120 + 121 - 106 + 3;
        aQ.if[57] = 0x3A ^ 0x78;
        aQ.if[58] = 81 + 129 - 192 + 112;
        aQ.if[59] = 9 ^ 0x4D ^ (0x20 ^ 0x1D);
        aQ.if[60] = 79 + 115 - 94 + 36;
        aQ.if[61] = 0x12 ^ 7 ^ (6 ^ 0x4E);
        aQ.if[62] = 0x4C ^ 0x19;
        aQ.if[63] = 0x88 ^ 0x9B ^ (0x68 ^ 3);
        aQ.if[64] = (0x16 ^ 0x28) + (0x7A ^ 0x3E) - (0x7C ^ 0x36) + (2 ^ 0x4C);
        aQ.if[65] = (0xC ^ 0x76) + (0x10 ^ 0x65) - (26 + 160 - 126 + 146) + (0x66 ^ 0);
        aQ.if[66] = 217 + 49 - 184 + 156 ^ 118 + 74 - 116 + 58;
        aQ.if[67] = 135 + 151 - 231 + 123 ^ 21 + 129 - 88 + 130;
        aQ.if[68] = 0xE3 ^ 0x94;
        aQ.if[69] = 0x4E ^ 0x7C;
    }

    private static boolean else(int n) {
        if (aQ.if(n, if[37]) && aQ.for(n, if[11])) {
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
        if (aQ.this(for ? 1 : 0)) {
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
        bS.do = new int[if[17]][][][];
        az.do = new String[if[18]];
        fQ.do = new int[if[17]][];
        AngelChip.do = null;
        AngelChip.if = null;
        AngelChip.do = null;
        if (aQ.void(ah.do.isEmpty() ? 1 : 0)) {
            ah.do.removeAllElements();
        }
        if (aQ.void(ah.if.isEmpty() ? 1 : 0)) {
            ah.if.removeAllElements();
        }
        bX.try();
        br.do.clear();
        br.do();
        if (aQ.void(bx.do instanceof fO) && aQ.void(bx.do instanceof aX)) {
            aQ.else();
        }
        int[] nArray = new int[if[19]];
        nArray[aQ.if[3]] = if[20];
        nArray[aQ.if[2]] = if[21];
        nArray[aQ.if[1]] = if[20];
        nArray[aQ.if[18]] = if[22];
        nArray[aQ.if[17]] = if[20];
        nArray[aQ.if[0]] = if[23];
        nArray[aQ.if[24]] = if[25];
        nArray[aQ.if[9]] = if[26];
        nArray[aQ.if[27]] = if[3];
        aC.do((String)aQ.do(nArray));
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
        if (aQ.const(aQ.char(System.currentTimeMillis() - l, 15000L))) {
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
        if (aQ.this(try ? 1 : 0)) {
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

    public static aQ do() {
        if (aQ.if(do)) {
            do = new aQ();
        }
        return do;
    }

    public static void do(String string) {
        AngelChip.do.do = null;
        AngelChip.do.do(if[30], string, if[2]);
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void try() {
        if (aQ.this(this ? 1 : 0)) {
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
        if (aQ.if(do)) {
            do = new Vector();
            String[] stringArray = br.do((int)(br.do + if[1]));
            if (aQ.do(stringArray) && aQ.void(stringArray.equals("") ? 1 : 0)) {
                stringArray = aQ.do((String)stringArray, ";");
                int n = if[3];
                while (aQ.try(n, stringArray.length)) {
                    do.addElement(stringArray[n].trim().toLowerCase());
                    ++n;
                    "".length();
                    if (((0x41 ^ 0x60) & ~(0x15 ^ 0x34)) == 0) continue;
                    return ((0x29 ^ 0x48) & ~(0x5C ^ 0x3D)) != 0;
                }
            }
        }
        if (aQ.void(do.isEmpty() ? 1 : 0) && aQ.this(do.contains(string.toLowerCase()) ? 1 : 0)) {
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
        if (aQ.const(aQ.for(System.currentTimeMillis() - l, 5000L))) {
            return if[2];
        }
        return if[3];
    }

    public static String do(int[] nArray) {
        int n = nArray.length - if[2];
        int n2 = if[3];
        StringBuffer stringBuffer = new StringBuffer();
        int n3 = if[3];
        while (aQ.try(n3, n)) {
            n2 += nArray[n3];
            stringBuffer.append((char)(nArray[n3] - n));
            "".length();
            ++n3;
            "".length();
            if (null == null) continue;
            return null;
        }
        if (aQ.void((n2 - nArray[n]) % n)) {
            return stringBuffer.toString();
        }
        return null;
    }

    public static boolean if(int n) {
        for = if[2];
        long l = System.currentTimeMillis();
        while (aQ.const(aQ.else(System.currentTimeMillis() - l, 30000L))) {
            if (aQ.void(for ? 1 : 0)) {
                return if[3];
            }
            if (aQ.int(fj.new, n)) {
                for = if[3];
                return if[2];
            }
            aQ.if(100L);
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
        if (aQ.this(if ? 1 : 0)) {
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
        if (aQ.try(n, n2)) {
            return n + do.nextInt(n2 - n + if[2]);
        }
        if (aQ.new(n, n2)) {
            return n2 + do.nextInt(n - n2 + if[2]);
        }
        return n;
    }

    private static int new(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean goto(int n) {
        if (aQ.int(n, if[38])) {
            return if[2];
        }
        return if[3];
    }

    public static String if(String object) {
        String string;
        block17: {
            string = "";
            if (!aQ.catch(object.length())) break block17;
            if (aQ.do(object.indexOf(if[28]), if[7])) {
                object = object.replace(if[28], if[29]);
            }
            object = aQ.do((String)object, ",");
            int[] nArray = new int[((String[])object).length];
            int n = if[3];
            while (aQ.try(n, ((String[])object).length)) {
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
            while (aQ.try(n, nArray.length)) {
                if (aQ.catch(n)) {
                    if (aQ.do(nArray[n], if[7])) {
                        int n2 = if[3];
                        int n3 = if[3];
                        while (aQ.try(n3, n)) {
                            if (aQ.do(nArray[n3], if[7]) && aQ.int(nArray[n], nArray[n3])) {
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
                        if (aQ.void(n2)) {
                            String string2;
                            StringBuffer stringBuffer = new StringBuffer().append(string);
                            if (aQ.catch(string.length())) {
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
                } else if (aQ.do(nArray[n], if[7])) {
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
        if (!aQ.void(aQ.new(n) ? 1 : 0) || aQ.int(n, if[43])) {
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
        if (aQ.this(byte ? 1 : 0)) {
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
        if (aQ.const(aQ.this(System.currentTimeMillis() - l2, l))) {
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
        if (aQ.const(aQ.catch(System.currentTimeMillis() - l2, l))) {
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
        if (aQ.this(do ? 1 : 0)) {
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
                if (!aQ.this(aQ.int() ? 1 : 0)) return null;
                InputStream inputStream = null;
                inputStreamReader = null;
                stringBuffer = new StringBuffer();
                try {
                    int n;
                    inputStream = this.getClass().getResourceAsStream("/version.txt");
                    inputStreamReader = new InputStreamReader(inputStream, "UTF-8");
                    while (aQ.do(n = inputStreamReader.read(), if[7])) {
                        stringBuffer.append((char)n);
                        "".length();
                        "".length();
                    }
                }
                catch (Exception exception) {
                    block25: {
                        "".length();
                        if (aQ.do(inputStream)) {
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
                    if (!aQ.do(inputStreamReader)) break block26;
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
                    if (aQ.do(inputStream)) {
                        try {
                            inputStream.close();
                            "".length();
                        }
                        catch (IOException iOException) {
                            "".length();
                        }
                    }
                    if (!aQ.do(inputStreamReader)) throw throwable;
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
                if (aQ.do(inputStream)) {
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
        cs.do((String)"BuildVersion", (int)if[4]);
        return stringBuffer.toString();
    }

    public static void do(long l) {
        if (aQ.this(ge.do ? 1 : 0)) {
            ge.do = if[3];
            return;
        }
        new ge(l).do();
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
        if (aQ.const(aQ.new(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    public static boolean for() {
        if (!aQ.void(bx.do instanceof gQ) || aQ.int(fj.new, if[7])) {
            return if[2];
        }
        return if[3];
    }

    public static void else() {
        bX.do.int();
        if (aQ.void(bx.do instanceof fO)) {
            gs.import();
        }
    }

    private static boolean this(int n) {
        return n != 0;
    }

    private static int byte(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public static boolean int() {
        if (aQ.do(if[4], cs.do((String)"BuildVersion"))) {
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
        if (aQ.this(new ? 1 : 0)) {
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
        if (aQ.const(aQ.case(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    public static void if(String string, fN fN2, fN fN3) {
        Vector<fN> vector = new Vector<fN>();
        vector.addElement(fN2);
        vector.addElement(fN3);
        bx.if((String)string, vector);
    }

    private static int case(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public static boolean int(int n) {
        if (!(aQ.void(aQ.do(n) ? 1 : 0) && aQ.void(aQ.class(n) ? 1 : 0) && aQ.void(aQ.float(n) ? 1 : 0) && aQ.void(aQ.case(n) ? 1 : 0) && aQ.void(aQ.char(n) ? 1 : 0) && aQ.void(aQ.else(n) ? 1 : 0) && aQ.void(aQ.goto(n) ? 1 : 0) && !aQ.this(aQ.break(n) ? 1 : 0))) {
            return if[2];
        }
        return if[3];
    }

    public static boolean new(int n) {
        if (!aQ.do(n, if[40]) || !aQ.do(n, if[41]) || aQ.int(n, if[42])) {
            return if[2];
        }
        return if[3];
    }

    public static void if(long l) {
        if (aQ.final(aQ.int(l, 0L))) {
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
        while (aQ.try(n, string.length())) {
            if (aQ.catch(n)) {
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
        if (aQ.const(aQ.try(System.currentTimeMillis() - l, 15000L))) {
            return if[2];
        }
        return if[3];
    }

    public static void do(Graphics graphics) {
        int n;
        int n2;
        if (aQ.this(bx.do instanceof gK)) {
            n2 = if[14];
            "".length();
            if ("   ".length() <= "  ".length()) {
                return;
            }
        } else {
            n2 = n = if[15];
        }
        if (aQ.do(bX.do) && aQ.catch(bX.do.toString().length()) && aQ.void(bx.do instanceof gK)) {
            if (aQ.try(bx.break % if[16], if[14])) {
                bx.int.do(graphics, "( " + bX.do.toString() + " )", bx.char / if[1], if[14], if[1]);
                "".length();
                if (((0xB9 ^ 0xA6) & ~(0x5E ^ 0x41)) >= " ".length()) {
                    return;
                }
            } else {
                bx.byte.do(graphics, "( " + bX.do.toString() + " )", bx.char / if[1], if[14], if[1]);
            }
        }
        if (aQ.void(int ? 1 : 0)) {
            String string;
            String string2;
            String string3;
            bx.int.do(graphics, "ID: " + AngelChip.do.do + " - LV: " + bX.do.do, if[17], n, if[3]);
            n += 14;
            StringBuffer stringBuffer = new StringBuffer().append("TK: ").append(bx.do((int)AngelChip.do.do[if[3]])).append("xu");
            if (aQ.catch(AngelChip.do.do[if[1]])) {
                string3 = " - " + bx.do((int)AngelChip.do.do[if[1]]) + "L";
                "".length();
                if (null != null) {
                    return;
                }
            } else {
                string3 = "";
            }
            StringBuffer stringBuffer2 = stringBuffer.append(string3);
            if (aQ.catch(AngelChip.do.break)) {
                string2 = " - " + bx.do((int)AngelChip.do.break) + "LK";
                "".length();
                if (((0x90 ^ 0xC7) & ~(0x91 ^ 0xC6)) == "  ".length()) {
                    return;
                }
            } else {
                string2 = "";
            }
            bx.int.do(graphics, stringBuffer2.append(string2).toString(), if[17], n, if[3]);
            bx.int.do(graphics, "Ng\u00e0y up: " + aQ.do().if, if[17], n += 14, if[3]);
            if (aQ.catch(aQ.const(do, 0L))) {
                bx.int.do(graphics, "Ng\u00e0y h\u1ebft h\u1ea1n: " + aQ.do().for, if[17], n += 14, if[3]);
            }
            if (aQ.catch(if)) {
                bx.int.do(graphics, "Xu c\u1ea7n up: " + bx.do((int)if), if[17], n += 14, if[3]);
            }
            n += 14;
            StringBuffer stringBuffer3 = new StringBuffer().append("Xu up \u0111\u01b0\u1ee3c: ");
            if (aQ.catch(for)) {
                string = bx.do((int)for);
                "".length();
                if ("  ".length() <= 0) {
                    return;
                }
            } else if (aQ.const(for)) {
                string = "-" + bx.do((int)Math.abs(for));
                "".length();
                if (null != null) {
                    return;
                }
            } else {
                string = "0";
            }
            bx.int.do(graphics, stringBuffer3.append(string).toString(), if[17], n, if[3]);
            if (aQ.do((int)AngelChip.do.for, if[7]) && aQ.this(bP.do ? 1 : 0)) {
                String string4;
                n += 14;
                StringBuffer stringBuffer4 = new StringBuffer().append("Tim thu \u0111\u01b0\u1ee3c: ");
                if (aQ.catch(int)) {
                    string4 = bx.do((int)int);
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
            if (aQ.do(bX.do)) {
                if (aQ.this(bX.do instanceof bS)) {
                    if (aQ.this(bS.do ? 1 : 0)) {
                        String string5;
                        int n3 = (int)((bS.do().do - System.currentTimeMillis()) / 1000L);
                        StringBuffer stringBuffer5 = new StringBuffer().append("Farming: ");
                        if (aQ.catch(n3)) {
                            fO.do();
                            "".length();
                            string5 = fO.do((int)n3);
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
                    bx.int.do(graphics, "C\u00e1 c\u00e2u \u0111\u01b0\u1ee3c: " + bS.new, if[17], n, if[3]);
                    bx.int.do(graphics, "C\u00e1 m\u1eadp: " + bS.do, if[17], n += 14, if[3]);
                    if (aQ.this(bS.int ? 1 : 0)) {
                        bx.int.do(graphics, "KCX: +" + bS.try, if[17], n += 14, if[3]);
                        return;
                    }
                } else if (aQ.this(bX.do instanceof P)) {
                    bx.int.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs.int, if[17], n, if[3]);
                    if (aQ.do(P.if, if[7]) && aQ.do(P.int, if[7])) {
                        bx.int.do(graphics, "S\u1ed1 l\u01b0\u1ee3ng: " + P.if + "/" + P.int, if[17], n += 14, if[3]);
                        return;
                    }
                } else {
                    if (aQ.this(bX.do instanceof d) && aQ.catch(aQ.const(d.do, 0L))) {
                        int n4 = (int)((d.if - d.do) / 1000L);
                        StringBuffer stringBuffer6 = new StringBuffer().append("Th\u1eddi gian: ");
                        fO.do();
                        "".length();
                        bx.int.do(graphics, stringBuffer6.append(fO.do((int)n4)).toString(), if[17], n, if[3]);
                        bx.int.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs.int, if[17], n += 14, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof ah)) {
                        bx.int.do(graphics, "Tr\u1ea3 l\u1eddi win: " + bX.do.do(), if[17], n, if[3]);
                        bx.int.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs.int, if[17], n += 14, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof al) && aQ.this(al.try ? 1 : 0)) {
                        String string6;
                        int n5 = (int)((al.do().if - System.currentTimeMillis()) / 1000L);
                        StringBuffer stringBuffer7 = new StringBuffer().append("Farming: ");
                        if (aQ.catch(n5)) {
                            fO.do();
                            "".length();
                            string6 = fO.do((int)n5);
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
                    if (aQ.this(bX.do instanceof dO)) {
                        bx.int.do(graphics, dO.do.if(), if[17], n, if[3]);
                        bx.int.do(graphics, dO.do.for(), if[17], n += 14, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof co)) {
                        bx.int.do(graphics, co.do.for(), if[17], n, if[3]);
                        bx.int.do(graphics, co.do.if(), if[17], n += 14, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof eZ)) {
                        String string7;
                        int n6 = (int)((eZ.do().do - System.currentTimeMillis()) / 1000L);
                        StringBuffer stringBuffer8 = new StringBuffer().append("Farming: ");
                        if (aQ.catch(n6)) {
                            fO.do();
                            "".length();
                            string7 = fO.do((int)n6);
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
                    if (aQ.this(bX.do instanceof fY) && aQ.catch(aQ.const(fY.do, 0L))) {
                        bx.int.do(graphics, "Ra t\u00f9 sau: " + fY.if(), if[17], n, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof gT)) {
                        bx.int.do(graphics, gT.do().if(), if[17], n, if[3]);
                        bx.int.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs.int, if[17], n += 14, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof gJ)) {
                        String string8;
                        StringBuffer stringBuffer9 = new StringBuffer().append("S\u1ed1 l\u1ea7n farm: ").append(gJ.if).append(" / ");
                        if (aQ.catch(gJ.do)) {
                            string8 = String.valueOf(gJ.do);
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
                    if (aQ.this(bX.do instanceof bO)) {
                        bx.int.do(graphics, "\u0110\u00e3 h\u00f4n: " + bO.do + " l\u1ea7n", if[17], n, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof N)) {
                        bx.int.do(graphics, "\u0110\u00e3 \u0111\u00e1nh: " + N.do + " l\u1ea7n", if[17], n, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof aZ)) {
                        String string9;
                        if (aQ.this(bx.do instanceof dT)) {
                            bx.int.do(graphics, "Friend: " + dT.do().do, if[17], n, if[3]);
                            n += 20;
                        }
                        StringBuffer stringBuffer10 = new StringBuffer().append("S\u1ed1 l\u1ea7n farm: ").append(aZ.do).append(" / ");
                        if (aQ.catch(aZ.int)) {
                            string9 = String.valueOf(aZ.int);
                            "".length();
                            if ((0x4D ^ 0x21 ^ (0x1F ^ 0x77)) == 0) {
                                return;
                            }
                        } else {
                            string9 = "KGH";
                        }
                        bx.int.do(graphics, stringBuffer10.append(string9).toString(), if[17], n, if[3]);
                        bx.int.do(graphics, "C\u1ecf \u0111\u00e3 di\u1ec7t: " + aZ.for, if[17], n += 14, if[3]);
                        bx.int.do(graphics, "S\u00e2u \u0111\u00e3 di\u1ec7t: " + aZ.if, if[17], n += 14, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof cO)) {
                        bx.int.do(graphics, "S\u1ed1 l\u1ea7n HPHV: " + bX.do.do(), if[17], n, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof an)) {
                        bx.int.do(graphics, "Bi\u1ebfn h\u00ecnh: " + bX.do.a_(), if[17], n, if[3]);
                        bx.int.do(graphics, "S\u1ed1 l\u1ea7n: " + bX.do.do(), if[17], n += 14, if[3]);
                        return;
                    }
                    if (aQ.this(bX.do instanceof gr)) {
                        String string10;
                        int n7 = (int)((gr.do().do - System.currentTimeMillis()) / 1000L);
                        StringBuffer stringBuffer11 = new StringBuffer().append("Farming: ");
                        if (aQ.catch(n7)) {
                            fO.do();
                            "".length();
                            string10 = fO.do((int)n7);
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
                    if (aQ.this(bX.do instanceof V)) {
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
        if (aQ.this(void ? 1 : 0)) {
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
        if (aQ.do(bX.do) && aQ.this(bX.do ? 1 : 0)) {
            return bX.do.do(string);
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
        if (aQ.this(char ? 1 : 0)) {
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
        if (aQ.const(aQ.byte(System.currentTimeMillis() - l2, l))) {
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
        if (aQ.this(case ? 1 : 0)) {
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
        if (aQ.this(string.equals("admin") ? 1 : 0) && aQ.do(n2 = string2.indexOf("T\u00e0i kho\u1ea3n c\u1ee7a b\u1ea1n b\u1ecb kh\u00f3a trong "), if[7]) && aQ.do(n = string2.indexOf(" ph\u00fat"), if[7])) {
            string = string2.substring(n2 + "T\u00e0i kho\u1ea3n c\u1ee7a b\u1ea1n b\u1ecb kh\u00f3a trong ".length(), n);
            try {
                fY.do = (long)(Integer.parseInt(string) + if[2]) * 60000L;
                return;
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
                fY.do = 0L;
                return;
            }
        }
        if (aQ.do(bX.do) && aQ.this(bX.do ? 1 : 0)) {
            bX.do.do(string, string2);
        }
    }

    public static void do(int n, String string) {
        AngelChip.do.do = null;
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
        if (aQ.const(aQ.class(System.currentTimeMillis() - l2, l))) {
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
        while (aQ.try(n, string.length())) {
            char c = string.charAt(n);
            if (aQ.if(c, if[12]) && aQ.for(c, if[13])) {
                string2 = string2 + c;
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
        if (aQ.do((Object)do) && aQ.catch(do.length)) {
            return do.length - if[2];
        }
        return if[3];
    }

    public static void do(String string, fN fN2) {
        Vector<fN> vector = new Vector<fN>();
        vector.addElement(fN2);
        bx.if((String)string, vector);
    }

    private static boolean new(int n, int n2) {
        return n > n2;
    }

    public static void if(String string) {
        if (aQ.do((Object)string) && aQ.void(string.trim().equals("") ? 1 : 0)) {
            aD.do = null;
            aD.do().do(new Hashtable(), "N\u1ed9i dung c\u1eadp nh\u1eadt", string, if[7]);
            bx.do = aD.do();
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
        if (aQ.this(goto ? 1 : 0)) {
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
        while (aQ.try(n, fj.if.size())) {
            dF dF2 = (dF)fj.if.elementAt(n);
            if (aQ.do(dF2) && aQ.this(dF2.do.toLowerCase().equals(string) ? 1 : 0)) {
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
        if (aQ.int(n, if[39])) {
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
        if (aQ.this(long ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            long = if[3];
        }
    }

    static {
        aQ.const();
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
        nArray[aQ.if[3]] = if[21];
        nArray[aQ.if[2]] = if[55];
        nArray[aQ.if[1]] = if[56];
        nArray[aQ.if[18]] = if[55];
        nArray[aQ.if[17]] = if[57];
        nArray[aQ.if[0]] = if[58];
        nArray[aQ.if[24]] = if[59];
        nArray[aQ.if[9]] = if[60];
        nArray[aQ.if[27]] = if[57];
        nArray[aQ.if[19]] = if[61];
        nArray[aQ.if[45]] = if[58];
        nArray[aQ.if[4]] = if[59];
        nArray[aQ.if[5]] = if[60];
        nArray[aQ.if[6]] = if[62];
        nArray[aQ.if[44]] = if[63];
        nArray[aQ.if[14]] = if[63];
        nArray[aQ.if[8]] = if[64];
        nArray[aQ.if[50]] = if[59];
        nArray[aQ.if[31]] = if[65];
        nArray[aQ.if[54]] = if[65];
        nArray[aQ.if[16]] = if[9];
        new = aQ.do(nArray);
        int[] nArray2 = new int[if[0]];
        nArray2[aQ.if[3]] = if[66];
        nArray2[aQ.if[2]] = if[67];
        nArray2[aQ.if[1]] = if[68];
        nArray2[aQ.if[18]] = if[69];
        nArray2[aQ.if[17]] = if[18];
        int = aQ.do(nArray2);
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
        if (aQ.const(aQ.goto(System.currentTimeMillis() - l2, l))) {
            return if[2];
        }
        return if[3];
    }

    private static int this(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean class(int n) {
        if (aQ.long(n) && !aQ.new(n, if[27]) || !aQ.do(n, if[45]) || aQ.int(n, if[4])) {
            return if[2];
        }
        return if[3];
    }

    private static int void(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static String new(String string) {
        if (aQ.do(string.indexOf(if[11]), if[7])) {
            StringBuffer stringBuffer = new StringBuffer();
            int n = if[3];
            while (aQ.try(n, string.length())) {
                char c = string.charAt(n);
                if (aQ.do((int)c, if[11])) {
                    stringBuffer.append(c);
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
        if (aQ.int(fj.new, n)) {
            return if[2];
        }
        if (aQ.int(n, if[43])) {
            if (aQ.void(aQ.break(fj.new) ? 1 : 0)) {
                if (aQ.void(aQ.try(if[39]) ? 1 : 0)) {
                    return if[3];
                }
                aQ.if(3500L);
            }
            if (aQ.this(aQ.break(fj.new) ? 1 : 0)) {
                eR.do().int(AngelChip.do.char);
                aQ.else(30000L);
                "".length();
            }
            if (aQ.int(fj.new, if[43])) {
                return if[2];
            }
            return if[3];
        }
        if (!aQ.long(n) || !aQ.for(n, if[11]) || !aQ.do(bd.do) || aQ.void(bd.do[n][if[3]]) && aQ.void(bd.do[n][if[2]])) {
            return if[3];
        }
        if (aQ.this(aQ.float(fj.new) ? 1 : 0) && (!aQ.do((int)AngelChip.do.byte, if[1]) || aQ.int(AngelChip.do.byte, if[6]))) {
            W.do().if(if[1], if[3]);
            aQ.if(1000L);
        }
        if (aQ.this(aQ.do(n) ? 1 : 0)) {
            if (!(!aQ.void(aQ.for() ? 1 : 0) || aQ.void(aQ.goto(fj.new) ? 1 : 0) && aQ.void(aQ.break(fj.new) ? 1 : 0) && aQ.void(aQ.else(fj.new) ? 1 : 0) && aQ.void(aQ.case(fj.new) ? 1 : 0) && aQ.void(aQ.char(fj.new) ? 1 : 0) && !aQ.void(aQ.do(fj.new) ? 1 : 0))) {
                gs.do().return();
                if (aQ.void(aQ.for() ? 1 : 0)) {
                    return if[3];
                }
                aQ.if(1000L);
            }
            if (aQ.this(aQ.for() ? 1 : 0)) {
                if (aQ.int(n, if[6])) {
                    gQ.do().do = if[2];
                    "".length();
                    if ((4 + 143 - 124 + 171 ^ 136 + 119 - 189 + 132) == -" ".length()) {
                        return ((0x22 ^ 0x5E ^ (0xB1 ^ 0x8A)) & (0x24 ^ 0x66 ^ (0xB8 ^ 0xBD) ^ -" ".length())) != 0;
                    }
                } else if (aQ.int(n, if[19])) {
                    gQ.do().do = if[18];
                    "".length();
                    if (-"   ".length() > 0) {
                        return ((0x2B ^ 0x78) & ~(0xC0 ^ 0x93)) != 0;
                    }
                } else if (aQ.int(n, if[32])) {
                    gQ.do().do = if[17];
                    "".length();
                    if (((0xFA ^ 0xA1) & ~(0x56 ^ 0xD)) != ((0x7B ^ 0x33) & ~(0x47 ^ 0xF))) {
                        return ((0xB4 ^ 0x97) & ~(0x84 ^ 0xA7)) != 0;
                    }
                } else if (aQ.this(aQ.class(n) ? 1 : 0)) {
                    gQ.do().do = if[0];
                    "".length();
                    if ((0x7A ^ 0x7F) <= 0) {
                        return ((0xA4 ^ 0x86) & ~(7 ^ 0x25)) != 0;
                    }
                } else {
                    gQ.do().do = if[24];
                }
                fV.do().int(if[19]);
                if (aQ.void(aQ.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
                if (aQ.int(n, fj.new)) {
                    return if[2];
                }
                aQ.if(3500L);
            }
            if (aQ.do(n, fj.new)) {
                fj.int = bd.do[n][if[3]];
                fj.byte = bd.do[n][if[2]];
                fp.do().do(n, if[7]);
                if (aQ.void(aQ.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
            }
            return if[2];
        }
        if (aQ.this(aQ.goto(n) ? 1 : 0)) {
            if (!aQ.do(fj.new, if[48]) || aQ.int(fj.new, if[49])) {
                dT.do().else();
                if (aQ.void(aQ.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
                if (aQ.int(fj.new, if[38])) {
                    return if[2];
                }
            }
            if (aQ.void(aQ.for() ? 1 : 0)) {
                gs.do().return();
                if (aQ.void(aQ.for() ? 1 : 0)) {
                    return if[3];
                }
                aQ.if(1000L);
            }
            if (aQ.do(bx.do)) {
                bx.case();
            }
            if (aQ.this(aQ.for() ? 1 : 0)) {
                bx.for((String)bT.Z);
                gQ.do().do = if[9];
                fV.do().int(if[45]);
                if (aQ.void(aQ.else(60000L) ? 1 : 0)) {
                    bx.case();
                    return if[3];
                }
            }
            bx.case();
            return if[2];
        }
        if (aQ.this(aQ.break(n) ? 1 : 0)) {
            if (aQ.void(aQ.for() ? 1 : 0)) {
                gs.do().return();
                if (aQ.void(aQ.for() ? 1 : 0)) {
                    return if[3];
                }
                aQ.if(1000L);
            }
            if (aQ.this(aQ.for() ? 1 : 0)) {
                gQ.do().do = if[3];
                fV.do().int(if[4]);
                if (aQ.void(aQ.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
            }
            return if[2];
        }
        if (!aQ.void(aQ.case(n) ? 1 : 0) || !aQ.void(aQ.char(n) ? 1 : 0) || aQ.this(aQ.else(n) ? 1 : 0)) {
            if (aQ.this(aQ.case(n) ? 1 : 0) && !aQ.void(aQ.case(fj.new) ? 1 : 0) || aQ.this(aQ.char(n) ? 1 : 0) && !aQ.void(aQ.char(fj.new) ? 1 : 0) || aQ.this(aQ.else(n) ? 1 : 0) && aQ.this(aQ.else(fj.new) ? 1 : 0)) {
                fj.int = bd.do[n][if[3]];
                fj.byte = bd.do[n][if[2]];
                if (!aQ.do(n, if[33]) || !aQ.do(n, if[35]) || aQ.int(n, if[37])) {
                    fV.do().if(if[50]);
                    "".length();
                    if ((0x58 ^ 0x5C) < 0) {
                        return ((0x27 ^ 9) & ~(0x54 ^ 0x7A)) != 0;
                    }
                } else if (!aQ.do(n, if[51]) || !aQ.do(n, if[36]) || aQ.int(n, if[52])) {
                    fV.do().if(if[31]);
                    "".length();
                    if (-" ".length() >= 0) {
                        return ((0x24 ^ 7 ^ (0x30 ^ 0x3F) & ~(0x9D ^ 0x92)) & (0x5B ^ 0x4C ^ (0xB7 ^ 0x83) ^ -" ".length())) != 0;
                    }
                } else if (!aQ.do(n, if[53]) || aQ.int(n, if[13])) {
                    fV.do().if(if[54]);
                    "".length();
                    if ((0x7B ^ 0x7F) > (0x57 ^ 0x53)) {
                        return ((8 ^ 0x54) & ~(3 ^ 0x5F)) != 0;
                    }
                } else if (!aQ.do(n, if[34]) || aQ.int(n, if[11])) {
                    fV.do().if(if[16]);
                }
                if (aQ.void(aQ.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
                return if[2];
            }
            if (aQ.void(aQ.for() ? 1 : 0)) {
                gs.do().return();
                if (aQ.void(aQ.for() ? 1 : 0)) {
                    return if[3];
                }
                aQ.if(1000L);
            }
            if (aQ.this(aQ.for() ? 1 : 0)) {
                gQ.do().do = if[1];
                fV.do().int(if[19]);
                if (aQ.void(aQ.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
                aQ.if(500L);
                if (aQ.this(aQ.case(n) ? 1 : 0)) {
                    fV.do().do(if[0], if[3], if[3]);
                    "".length();
                    if ((0xA9 ^ 0xAD) <= "  ".length()) {
                        return ((0x5B ^ 0x51) & ~(0x5A ^ 0x50)) != 0;
                    }
                } else if (aQ.this(aQ.char(n) ? 1 : 0)) {
                    fV.do().do(if[0], if[3], if[2]);
                    "".length();
                    if (((0x9F ^ 0xB9) & ~(9 ^ 0x2F)) != ((0xA8 ^ 0x92) & ~(0x7D ^ 0x47))) {
                        return ((0x60 ^ 0x29) & ~(0x3C ^ 0x75)) != 0;
                    }
                } else if (aQ.this(aQ.else(n) ? 1 : 0)) {
                    fV.do().do(if[0], if[3], if[1]);
                }
                if (aQ.void(aQ.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
                if (aQ.int(n, fj.new)) {
                    return if[2];
                }
                aQ.if(4000L);
            }
            if (aQ.do(n, fj.new)) {
                fj.int = bd.do[n][if[3]];
                fj.byte = bd.do[n][if[2]];
                if (!aQ.do(n, if[33]) || !aQ.do(n, if[35]) || aQ.int(n, if[37])) {
                    fV.do().if(if[50]);
                    "".length();
                    if (-" ".length() >= ((0x99 ^ 0xB9) & ~(0xC ^ 0x2C))) {
                        return ((0x31 ^ 0x2E) & ~(0xD9 ^ 0xC6)) != 0;
                    }
                } else if (!aQ.do(n, if[51]) || !aQ.do(n, if[36]) || aQ.int(n, if[52])) {
                    fV.do().if(if[31]);
                    "".length();
                    if (((0x23 ^ 0x45 ^ (0x80 ^ 0xC0)) & (0x53 ^ 0x70 ^ (0x76 ^ 0x73) ^ -" ".length())) > 0) {
                        return ((0xAE ^ 0xC4 ^ (0x1A ^ 0x57)) & (134 + 13 - 81 + 70 ^ 158 + 168 - 208 + 57 ^ -" ".length())) != 0;
                    }
                } else if (!aQ.do(n, if[53]) || aQ.int(n, if[13])) {
                    fV.do().if(if[54]);
                    "".length();
                    if (((0x2B ^ 0x7E ^ (0x65 ^ 0x51)) & (0xED ^ 0x9E ^ (0xA2 ^ 0xB0) ^ -" ".length())) != 0) {
                        return ((0x68 ^ 0x15 ^ (0x57 ^ 0x2D)) & (0x3C ^ 0x1D ^ (0xAF ^ 0x89) ^ -" ".length())) != 0;
                    }
                } else if (!aQ.do(n, if[34]) || aQ.int(n, if[11])) {
                    fV.do().if(if[16]);
                }
                if (aQ.void(aQ.else(30000L) ? 1 : 0)) {
                    return if[3];
                }
            }
            return if[2];
        }
        return if[3];
    }

    public static boolean byte(int n) {
        if (aQ.this(bx.do instanceof er)) {
            er.do().for();
        }
        if (aQ.this(bx.do instanceof fs)) {
            fs.do().int();
        }
        if (aQ.this(bx.do instanceof fX)) {
            fX.do().do.try();
        }
        if (aQ.this(bx.do instanceof W)) {
            W.do().if(if[1], if[3]);
            aQ.if(1000L);
        }
        if (!aQ.void(bx.do instanceof gK) || aQ.this(bx.do instanceof Y)) {
            Y.do.do(if[3]);
            if (aQ.this(aQ.else(30000L) ? 1 : 0)) {
                aQ.if(2000L);
            }
        }
        if (aQ.this(bx.do instanceof q)) {
            bx.do.if = if[3];
            eB.do().do();
            if (aQ.this(aQ.else(30000L) ? 1 : 0)) {
                aQ.if(2000L);
            }
        }
        if (!aQ.void(bx.do instanceof fQ) || aQ.this(bx.do instanceof eY)) {
            fV.do().int(if[19]);
            if (aQ.this(aQ.else(30000L) ? 1 : 0)) {
                aQ.if(2000L);
            }
        }
        if (aQ.this(bx.do instanceof aO)) {
            fj.int = if[46];
            fj.byte = if[47];
            aO.do().if(if[2], if[7]);
            if (aQ.this(aQ.else(30000L) ? 1 : 0)) {
                aQ.if(3500L);
            }
        }
        return aQ.try(n);
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
        if (aQ.this(else ? 1 : 0)) {
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
        if (!aQ.do((Object)string) || aQ.this(string.equals("") ? 1 : 0)) {
            String[] stringArray = new String[if[2]];
            stringArray[aQ.if[3]] = objectArray;
            return stringArray;
        }
        Vector<String> vector = new Vector<String>();
        if (aQ.void(objectArray.endsWith(string) ? 1 : 0)) {
            objectArray = (String)objectArray + string;
        }
        int n2 = if[3];
        while (aQ.do(n = objectArray.indexOf(string, n2), if[7])) {
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
        if (!aQ.do(n, if[44]) || !aQ.do(n, if[14]) || aQ.int(n, if[8])) {
            return if[2];
        }
        return if[3];
    }

    public static void do(String string, String string2, dh dh2) {
        Vector<fN> vector = new Vector<fN>();
        vector.addElement(new fN(string, dh2));
        vector.addElement(bx.do);
        bx.if((String)string2, vector);
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
        if (aQ.const(aQ.break(System.currentTimeMillis() - l2, l))) {
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
