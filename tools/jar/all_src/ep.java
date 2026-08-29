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
 * Duplicate member names - consider using --renamedupmembers true
 */
public abstract class ep
extends dH {
    private static final int[] do;
    public static int catch;
    public int class = do[0];
    public static int const;
    private ep do;
    public static Image int;
    public static Image new;
    public static Image try;
    public static Image byte;
    public static int final;
    public static int float;
    public static int short;
    public static Image case;

    private static boolean do(Object object, Object object2) {
        return object != object2;
    }

    public void do(Graphics graphics) {
        if (ep.do(bx.do) && ep.do(bx.do) && ep.do(bx.do) && ep.do(cV.do ? 1 : 0)) {
            super.do(graphics);
            "".length();
            if (" ".length() > " ".length()) {
                return;
            }
        } else {
            bx.if(graphics);
        }
        if (ep.do(ag_0.do().do() ? 1 : 0)) {
            bx.do.do(graphics, "2.5.8", bx.do.if, bx.do.for, bx.do.do);
            "".length();
            if ("  ".length() < "  ".length()) {
                return;
            }
        } else if (!ep.do(bx.do, gx_0.do) || ep.if(bx.do, gQ.do)) {
            bx.do.do(graphics, ag_0.do().do, bx.do.if, bx.do.for, bx.do.do);
        }
        bx.do.do(graphics);
    }

    public void do(int n, boolean bl) {
        this.class = n;
    }

    public void do(boolean bl) {
        ((dH)this).new = bl;
    }

    public void if(Graphics graphics) {
    }

    private static void if() {
        do = new int[11];
        ep.do[0] = (0x77 ^ 0x7B) & ~(0x56 ^ 0x5A);
        ep.do[1] = " ".length();
        ep.do[2] = " ".length() ^ (0x9E ^ 0x95);
        ep.do[3] = 0xFFFFAFBE & 0x657A45;
        ep.do[4] = "  ".length();
        ep.do[5] = 0xFFFFFFDF & 0xCC762F;
        ep.do[6] = (0x40 ^ 0x50) & ~(0x3B ^ 0x2B) ^ (0xB9 ^ 0xAD);
        ep.do[7] = 0xFFFFD9EB & 0x496F5D;
        ep.do[8] = -(0xFFFFD5F3 & 0x6ADD) & (0xFFFFFFFF & 0x2F6FFF);
        ep.do[9] = -(0xFFFFE587 & 0x1B7F) & (0xFFFFFFF6 & 0xDBBB9F);
        ep.do[10] = -(0xFFFFDE7E & 0x638B) & (0xFFFFE2FF & 0xC1FF7F);
    }

    public void if(int n) {
    }

    public void try() {
        bx.new();
        this.do = bx.do;
        bx.do = this;
        bx.do.setFullScreenMode(do[1]);
    }

    static {
        ep.if();
        const = do[6];
        float = do[0];
        catch = do[6];
        int[] nArray = new int[do[4]];
        nArray[ep.do[0]] = do[7];
        nArray[ep.do[1]] = do[8];
        int[] nArray2 = new int[do[4]];
        nArray2[ep.do[0]] = do[9];
        nArray2[ep.do[1]] = do[10];
    }

    public final boolean do(ep ep2) {
        if (ep.if(this.do) && ep.if(ep2, this.do) && (!ep.do(bx.do, fs.do()) || ep.if(bx.do, er.do()))) {
            return do[1];
        }
        return do[0];
    }

    public abstract void byte();

    private static boolean do(Object object) {
        return object == null;
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    private static boolean if(Object object) {
        return object != null;
    }

    public static void float() {
        int n = bx.new + bx.if;
        if (ep.do(int)) {
            int = Image.createImage((int)bx.char, (int)n);
        }
        Graphics graphics = int.getGraphics();
        if (ep.if(bx.do, gK.do)) {
            gK.do.new(graphics);
            return;
        }
        if (!ep.do(bx.do, i_0.do) || ep.if(bx.do, bW.do)) {
            int n2;
            if (ep.do(bx.char, n)) {
                n2 = n / do[2];
                "".length();
                if ("  ".length() <= " ".length()) {
                    return;
                }
            } else {
                n2 = bx.char / do[2];
            }
            int n3 = do[0];
            while (ep.do(n3, n2)) {
                graphics.setColor(do[3]);
                graphics.drawRect(bx.long - n3 * n2 - do[1], n / do[4] - n3 * n2, n3 * n2 << do[1], n3 * n2 << do[1]);
                graphics.setColor(do[5]);
                graphics.drawRect(bx.long - n3 * n2, n / do[4] - n3 * n2 + do[1], n3 * n2 << do[1], n3 * n2 << do[1]);
                ++n3;
                "".length();
                if ((0x4B ^ 0x4F) > " ".length()) continue;
                return;
            }
        }
    }

    public void int() {
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean if(Object object, Object object2) {
        return object == object2;
    }
}

