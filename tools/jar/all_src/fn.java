/*
 * Decompiled with CFR 0.152.
 */
/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class fn {
    private static int[] do;
    public byte do;
    public byte if;
    public byte for;

    private static void do() {
        do = new int[1];
        fn.do[0] = (0xAE ^ 0xB0) & ~(0x98 ^ 0x86);
    }

    static {
        fn.do();
    }

    public fn(byte by2, byte by3) {
        this.do = by2;
        this.if = (byte)do[0];
        this.for = by3;
    }

    public fn() {
    }
}

