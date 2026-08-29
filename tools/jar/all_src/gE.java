/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class gE
implements dh_0 {
    private final int do;
    private final int if;
    private static int[] do;
    private final Vector do;
    final gs_0 do;

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    gE(gs_0 gs_02, Vector vector, int n, int n2) {
        this.do = gs_02;
        this.do = vector;
        this.do = n;
        this.if = n2;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    /*
     * Enabled aggressive block sorting
     */
    public final void do() {
        Object object;
        Vector<Object> vector = new Vector<Object>();
        int n = do[0];
        "".length();
        while (!gE.do(n, this.do.size())) {
            object = (cj)this.do.elementAt(n);
            ao_0 ao_02 = ac_0.do(((cj)object).do);
            if (gE.do(ao_02) && gE.for(ao_02.do, do[1]) && gE.for(ao_02.do, do[2])) {
                vector.addElement(object);
            }
            ++n;
        }
        if (gE.do(fs.try, vector.size())) {
            return;
        }
        cj cj2 = (cj)vector.elementAt(fs.try);
        object = ac_0.do(cj2.do);
        if (!gE.do(ac_0.do((int)((ao_0)object).do) ? 1 : 0) || gE.if(this.do, do[3])) {
            bx.do(bT.aJ, new gp_0(this, (ao_0)object, this.do, vector, this.do, cj2, this.if));
        }
    }

    private static void if() {
        do = new int[4];
        gE.do[0] = (0xC1 ^ 0x9B) & ~(0x2F ^ 0x75);
        gE.do[1] = 0x37 ^ 0x29;
        gE.do[2] = 0x3A ^ 0x12;
        gE.do[3] = " ".length();
    }

    static {
        gE.if();
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }
}

