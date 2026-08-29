/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class cq {
    public final int do;
    private static final int[] do;
    public final int if;
    public final int for;

    public cq(int n, int n2, int n3) {
        this.do = n;
        this.if = n2;
        this.for = n3;
    }

    static {
        cq.do();
    }

    public cq(int n, int n2) {
        this.do = n;
        this.if = n2;
        this.for = do[0];
    }

    private static void do() {
        do = new int[1];
        cq.do[0] = -" ".length();
    }
}

