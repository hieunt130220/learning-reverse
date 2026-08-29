/*
 * Decompiled with CFR 0.152.
 */
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from eI
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class ei_0 {
    public short do;
    public int[] do;
    public short if;
    public String do;
    private static int[] if;
    public byte do;
    public int do = "";

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    static {
        ei_0.do();
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    /*
     * Unable to fully structure code
     */
    public static ei_0 do(Vector var0, int var1_1) {
        var2_2 = var0.size();
        var3_3 = ei_0.if[1];
        "".length();
        if (-" ".length() <= 0) ** GOTO lbl11
        return null;
lbl-1000:
        // 1 sources

        {
            var4_4 = (ei_0)var0.elementAt(var3_3);
            if (ei_0.do(var4_4.do, var1_1)) {
                return var4_4;
            }
            ++var3_3;
lbl11:
            // 2 sources

            ** while (!ei_0.if((int)var3_3, (int)var2_2))
        }
lbl12:
        // 1 sources

        return null;
    }

    private static void do() {
        if = new int[2];
        ei_0.if[0] = "  ".length();
        ei_0.if[1] = (0x16 ^ 0x3F) & ~(0xA1 ^ 0x88);
    }
}

