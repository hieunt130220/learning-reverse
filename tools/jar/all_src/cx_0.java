/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 */
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from cx
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class cx_0 {
    public int do;
    public int if;
    private static int[] do;
    public Image do;
    public int for;

    public final void do(int n, int n2, int n3, int n4, Graphics graphics) {
        if (cx_0.do(n) && cx_0.do(n, this.for)) {
            graphics.drawRegion(this.do, n * this.do, n2 * this.if, this.do, this.if, do[0], n3, n4, do[0]);
        }
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    public final void do(int n, int n2, int n3, int n4, int n5, Graphics graphics) {
        if (cx_0.do(n) && cx_0.do(n, this.for)) {
            graphics.drawRegion(this.do, do[0], n * this.if, this.do, this.if, n4, n2, n3, n5);
        }
    }

    static {
        cx_0.do();
    }

    public cx_0(Image image, int n, int n2) {
        this.do = image;
        this.do = n;
        this.if = n2;
        this.for = image.getHeight() / n2;
    }

    public static cx_0 do(String string, int n, int n2) {
        return new cx_0(f_0.do(string), n, n2);
    }

    public final void if(int n, int n2, int n3, int n4, Graphics graphics) {
        graphics.drawRegion(this.do, do[0], n * this.if, this.do, this.if, n4, n2, n3, do[0]);
    }

    private static boolean do(int n) {
        return n >= 0;
    }

    private static void do() {
        do = new int[1];
        cx_0.do[0] = (0x58 ^ 5) & ~(0xF3 ^ 0xAE);
    }

    public final void if(int n, int n2, int n3, int n4, int n5, Graphics graphics) {
        if (cx_0.do(n) && cx_0.do(n, this.for)) {
            graphics.drawRegion(this.do, n * this.do, n2 * this.if, this.do, this.if, do[0], n3, n4, n5);
        }
    }
}

