/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from eS
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class es_0 {
    private static final int[] do;
    private static final byte[] do;

    private static boolean do(int n) {
        return n != 0;
    }

    public static byte[] do(String string) {
        String string2;
        int n;
        int n2;
        if (es_0.do(string.indexOf(do[0]), do[1])) {
            StringBuffer stringBuffer = new StringBuffer();
            n2 = do[2];
            while (es_0.if(n2, string.length())) {
                n = string.charAt(n2);
                if (es_0.do(n, do[0])) {
                    stringBuffer.append((char)n);
                    "".length();
                }
                ++n2;
                "".length();
                if ("   ".length() > ((0x7A ^ 0x49 ^ (0xA0 ^ 0x80)) & (0x58 ^ 0x16 ^ (0xDF ^ 0x82) ^ -" ".length()))) continue;
                return null;
            }
            string2 = stringBuffer.toString();
            "".length();
            if ("   ".length() <= ((0xA6 ^ 0xBC) & ~(0xB6 ^ 0xAC))) {
                return null;
            }
        } else {
            string2 = string;
        }
        string = string2;
        int n3 = do[2];
        if (es_0.do(string.endsWith("=") ? 1 : 0)) {
            ++n3;
        }
        if (es_0.do(string.endsWith("==") ? 1 : 0)) {
            ++n3;
        }
        byte[] byArray = new byte[(string.length() + do[3]) / do[4] * do[3] - n3];
        n2 = do[2];
        try {
            int n4;
            n = do[2];
            while (es_0.if(n, string.length()) && es_0.do(n4 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(string.charAt(n)), do[1])) {
                switch (n % do[4]) {
                    case 0: {
                        byArray[n2] = (byte)(n4 << do[5]);
                        "".length();
                        if (null == null) break;
                        return null;
                    }
                    case 1: {
                        int n5 = n2++;
                        byArray[n5] = (byte)(byArray[n5] | (byte)(n4 >> do[4] & do[3]));
                        byArray[n2] = (byte)(n4 << do[4]);
                        "".length();
                        if ("  ".length() > 0) break;
                        return null;
                    }
                    case 2: {
                        int n6 = n2++;
                        byArray[n6] = (byte)(byArray[n6] | (byte)(n4 >> do[5] & do[6]));
                        byArray[n2] = (byte)(n4 << do[7]);
                        "".length();
                        if (-"  ".length() < 0) break;
                        return null;
                    }
                    case 3: {
                        int n7 = n2++;
                        byArray[n7] = (byte)(byArray[n7] | (byte)(n4 & do[8]));
                    }
                }
                ++n;
                "".length();
                if ((89 + 173 - 91 + 26 ^ 26 + 90 - 99 + 176) != -" ".length()) continue;
                return null;
            }
        }
        catch (ArrayIndexOutOfBoundsException arrayIndexOutOfBoundsException) {
            "".length();
        }
        "".length();
        if (null != null) {
            return null;
        }
        return byArray;
    }

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    private static void do() {
        do = new int[10];
        es_0.do[0] = 0xD ^ 7;
        es_0.do[1] = -" ".length();
        es_0.do[2] = (0x7B ^ 0x34) & ~(0xFD ^ 0xB2);
        es_0.do[3] = "   ".length();
        es_0.do[4] = 101 + 119 - 143 + 71 ^ 4 + 67 - -65 + 8;
        es_0.do[5] = "  ".length();
        es_0.do[6] = 194 + 101 - 269 + 175 ^ 144 + 44 - 104 + 114;
        es_0.do[7] = 120 + 186 - 205 + 88 ^ 88 + 62 - 69 + 106;
        es_0.do[8] = 93 + 6 - 28 + 104 ^ 119 + 6 - 81 + 100;
        es_0.do[9] = 0x4A ^ 0xA;
    }

    static {
        es_0.do();
        do = new byte[do[9]];
        int n = do[2];
        while (es_0.if(n, do[9])) {
            byte by2;
            es_0.do[n] = by2 = (byte)"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(n);
            ++n;
            "".length();
            if (null == null) continue;
            break;
        }
    }
}

