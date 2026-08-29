/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from aT
 */
final class at_0
implements dh_0 {
    private static final int[] do;

    private static boolean do(int n) {
        return n > 0;
    }

    static {
        at_0.if();
    }

    private static void if() {
        do = new int[2];
        at_0.do[0] = (0x23 ^ 0x3E) & ~(0xAC ^ 0xB1);
        at_0.do[1] = "   ".length();
    }

    public at_0(short s2) {
        cd.if = s2;
        cd.do = do[0];
    }

    public final void do() {
        block6: {
            block4: {
                String string = aq_0.for(bx.do.do.do());
                if (!at_0.do(string.length())) break block4;
                try {
                    cd.do = Integer.parseInt(string);
                }
                catch (NumberFormatException numberFormatException) {
                    "".length();
                }
                "".length();
                if ((0x1B ^ 0x1F) != (0xC6 ^ 0xC2)) {
                    return;
                }
                if (at_0.do(cd.do)) {
                    bx_0.do(new cd(do[1]));
                    return;
                }
                break block6;
            }
            cd.do = dT.for.size();
            bx_0.do(new cd(do[1]));
        }
    }
}

