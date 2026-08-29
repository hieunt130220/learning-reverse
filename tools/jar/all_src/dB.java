/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class dB
implements Runnable {
    private static int[] do;
    private ag_0 do;

    private static boolean do(int n) {
        return n > 0;
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    dB(ag_0 ag_02) {
        this.do = ag_02;
    }

    private static void do() {
        do = new int[9];
        dB.do[0] = 226 + 190 - 265 + 104;
        dB.do[1] = 133 + 3 - 32 + 32 ^ 33 + 0 - -44 + 51;
        dB.do[2] = (0x91 ^ 0x88) & ~(0x3A ^ 0x23);
        dB.do[3] = 0x12 ^ 0x17;
        dB.do[4] = 0xFFFF8FC7 & 0x7438;
        dB.do[5] = 0x1A ^ 0x7C;
        dB.do[6] = -" ".length();
        dB.do[7] = -(0x59 ^ 0x28 ^ (0x6D ^ 7));
        dB.do[8] = " ".length();
    }

    /*
     * Unable to fully structure code
     */
    private void do(bm var1_1) {
        var2_2 = var1_1.do.readByte();
        this.do.do = new byte[var2_2];
        var3_3 = dB.do[2];
        "".length();
        if (((20 + 146 - 139 + 136 ^ 11 + 65 - -44 + 23) & (100 + 20 - 16 + 53 ^ 91 + 123 - 69 + 32 ^ -" ".length())) == 0) ** GOTO lbl10
        return;
lbl-1000:
        // 1 sources

        {
            this.do.do[var3_3] = var1_1.do.readByte();
            ++var3_3;
lbl10:
            // 2 sources

            ** while (!dB.do((int)var3_3, (int)var2_2))
        }
lbl11:
        // 1 sources

        var3_3 = dB.do[2];
        "".length();
        if (((141 ^ 179) & ~(139 ^ 181)) >= 0) ** GOTO lbl19
        return;
lbl-1000:
        // 1 sources

        {
            v0 = var3_3 + dB.do[8];
            this.do.do[v0] = (byte)(this.do.do[v0] ^ this.do.do[var3_3]);
            ++var3_3;
lbl19:
            // 2 sources

            ** while (!dB.do((int)var3_3, (int)(this.do.do.length - dB.do[8])))
        }
lbl20:
        // 1 sources

        this.do.if = dB.do[8];
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean if(int n) {
        return n == 0;
    }

    private static boolean for(int n, int n2) {
        return n == n2;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void run() {
        try {
            "".length();
            if ("  ".length() == " ".length()) {
                return;
            }
            while (true) {
                byte[] byArray;
                byte by2;
                Object object;
                block22: {
                    int n;
                    int n2;
                    int n3;
                    if (dB.if(this.do.do() ? 1 : 0)) {
                        "".length();
                        break;
                    }
                    object = this;
                    by2 = ((dB)object).do.do.readByte();
                    if (dB.for(((dB)object).do.if ? 1 : 0)) {
                        by2 = ag_0.do(((dB)object).do, by2);
                    }
                    if (dB.for(((dB)object).do.if ? 1 : 0)) {
                        byte by3 = ((dB)object).do.do.readByte();
                        n3 = ((dB)object).do.do.readByte();
                        n2 = (ag_0.do(((dB)object).do, by3) & do[0]) << do[1] | ag_0.do(((dB)object).do, (byte)n3) & do[0];
                        "".length();
                        if ("   ".length() < 0) {
                            return;
                        }
                    } else {
                        n2 = ((dB)object).do.do.readUnsignedShort();
                    }
                    byArray = new byte[n2];
                    n3 = do[2];
                    int n4 = do[2];
                    "".length();
                    while (true) {
                        if (!dB.if(n3, do[6]) || dB.do(n4, n2)) {
                            if (dB.for(((dB)object).do.if ? 1 : 0)) {
                                n = do[2];
                                "".length();
                                if (-" ".length() < 0) break;
                                return;
                            }
                            break block22;
                        }
                        n3 = ((dB)object).do.do.read(byArray, n4, n2 - n4);
                        if (!dB.do(n3)) continue;
                        ((dB)object).do.if += (n4 += n3) + do[3];
                        n = ag_0.do().if + ag_0.do().do;
                        ((dB)object).do.do = String.valueOf(n / do[4]) + "." + n % do[4] / do[5] + "Kb";
                    }
                    while (!dB.do(n, byArray.length)) {
                        byArray[n] = ag_0.do(((dB)object).do, byArray[n]);
                        ++n;
                    }
                }
                object = new bm(by2, byArray);
                try {
                    if (dB.for(((bm)object).do, do[7])) {
                        this.do((bm)object);
                        "".length();
                        continue;
                    }
                    this.do.do.for((bm)object);
                    "".length();
                }
                catch (Exception exception) {
                    exception.printStackTrace();
                }
            }
        }
        catch (Exception exception) {
            "".length();
        }
        if (dB.for(this.do.int ? 1 : 0)) {
            if (dB.do(this.do.do)) {
                if (dB.do(dB.do(System.currentTimeMillis() - this.do.do, 500L))) {
                    this.do.do.do();
                    "".length();
                } else {
                    this.do.do.for();
                }
            }
            if (dB.do(ag_0.do(this.do))) {
                ag_0.do(this.do);
            }
        }
    }

    static {
        dB.do();
    }

    private static boolean for(int n) {
        return n != 0;
    }

    private static boolean do(Object object) {
        return object != null;
    }
}

