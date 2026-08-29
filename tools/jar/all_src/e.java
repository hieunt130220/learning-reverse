/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Image
 */
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class e {
    private static int[] do;
    public int do;
    public short do;
    public Image do = do[0];
    public short if;

    public e(Image image) {
        this.do = image;
        this.do = do[1];
        this.if = (short)image.getWidth();
        this.do = (short)image.getHeight();
    }

    private static void do() {
        do = new int[2];
        e.do[0] = -" ".length();
        e.do[1] = (0xE3 ^ 0x9E ^ (0xD2 ^ 0x9A)) & (0x7D ^ 0x26 ^ (0x7B ^ 0x15) ^ -" ".length());
    }

    static {
        e.do();
    }

    public e() {
    }
}

