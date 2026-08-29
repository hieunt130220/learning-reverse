/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from eU
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class eu_0
implements bK {
    private static int[] do;
    public static eu_0 do;

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    private static void do() {
        do = new int[4];
        eu_0.do[0] = -" ".length();
        eu_0.do[1] = (0x5D ^ 0x17) & ~(0xEF ^ 0xA5);
        eu_0.do[2] = 0x14 ^ 0x12;
        eu_0.do[3] = "   ".length();
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void do(bm bm2) {
        try {
            int n = bm2.do.readByte();
            int n2 = bm2.do.readByte();
            if (eu_0.do(y_0.do((byte)n, (byte)n2) ? 1 : 0)) {
                return;
            }
            switch (bm2.do) {
                case 20: {
                    ab_0.do.int = n = bm2.do.readByte();
                    ab_0.do.do((byte)n);
                    return;
                }
                case 21: {
                    n = bm2.do.readByte();
                    if (eu_0.if(n, do[0])) {
                        ab_0.do.case();
                        ab_0.do.do = do[1];
                        return;
                    }
                    if (!eu_0.do(n, do[0])) return;
                    n2 = do[1];
                    "".length();
                    while (true) {
                        if (eu_0.for(n2, do[2])) {
                            ab_0.do.if((byte)n);
                            return;
                        }
                        ab_0.do.do[n][n2] = bm2.do.readByte();
                        ++n2;
                    }
                }
                case 49: {
                    return;
                }
                case 37: {
                    byte[] byArray = new byte[do[3]];
                    n = do[1];
                    "".length();
                    if (((0x9A ^ 0xB8) & ~(0x8C ^ 0xAE)) > "   ".length()) {
                        return;
                    }
                    while (true) {
                        if (eu_0.for(n, do[3])) {
                            ab_0.do.do(byArray);
                            y_0.void();
                            return;
                        }
                        byArray[n] = bm2.do.readByte();
                        ++n;
                    }
                }
                case 100: {
                    n = bm2.do.readByte();
                    ab_0.do.for((byte)n);
                    return;
                }
                case 65: {
                    n = bm2.do.readByte();
                    n2 = bm2.do.readByte();
                    byte by2 = bm2.do.readByte();
                    byte by3 = bm2.do.readByte();
                    if (!eu_0.do(n2, by2)) return;
                    if (!eu_0.if(by3)) return;
                    ab_0.do.do[n][by2] = by3;
                    ab_0.do.do((byte)n, (byte)n2, by2);
                    return;
                }
                case 60: {
                    n = bm2.do.readByte();
                    n2 = bm2.do.readByte();
                    int n3 = bm2.do.readInt();
                    ab_0.do.do((byte)n, (byte)n2, n3);
                    return;
                }
                case 51: {
                    int[] nArray = new int[y_0.do.size()];
                    n2 = do[1];
                    "".length();
                    while (true) {
                        if (eu_0.for(n2, nArray.length)) {
                            ab_0.do.do(nArray);
                            return;
                        }
                        nArray[n2] = bm2.do.readInt();
                        ++n2;
                    }
                }
                case 62: {
                    ab_0.do.int = n = bm2.do.readByte();
                    n2 = do[1];
                    "".length();
                    block16: while (true) {
                        if (eu_0.for(n2, y_0.do.size())) {
                            ab_0.do.else();
                            return;
                        }
                        n = do[1];
                        "".length();
                        if (" ".length() <= ((0x27 ^ 9 ^ (0x59 ^ 0x7F)) & (31 + 125 - 54 + 25 ^ (8 ^ 0x7F) ^ -" ".length()))) {
                            return;
                        }
                        while (true) {
                            if (eu_0.for(n, do[2])) {
                                ++n2;
                                continue block16;
                            }
                            ab_0.do.do[n2][n] = bm2.do.readByte();
                            ++n;
                        }
                        break;
                    }
                }
            }
            return;
        }
        catch (Exception exception) {
            exception.printStackTrace();
        }
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private static boolean for(int n, int n2) {
        return n >= n2;
    }

    static {
        eu_0.do();
    }
}

