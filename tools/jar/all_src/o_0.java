/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 */
import java.io.IOException;
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from O
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class o_0
extends ep {
    public int do = do[0];
    private static int[] do;
    public static o_0 do;
    public static Image do;

    private static boolean do(Object object) {
        return object == null;
    }

    private static boolean do(int n, int n2) {
        return n > n2;
    }

    private static void if() {
        do = new int[5];
        o_0.do[0] = (3 ^ 0x10) & ~(0x1B ^ 8);
        o_0.do[1] = " ".length();
        o_0.do[2] = 0x69 ^ 0x7C;
        o_0.do[3] = "  ".length();
        o_0.do[4] = "   ".length();
    }

    public static o_0 do() {
        if (o_0.do(do)) {
            do = new o_0();
            return do;
        }
        return do;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    public final void do(Graphics graphics) {
        bx.do.for(graphics);
        if (o_0.do(this.do, do[1])) {
            graphics.drawImage(do, bx.long, bx.goto / do[3], do[4]);
        }
    }

    public final void try() {
        bx.if.removeAllElements();
        bx.do.for();
        aO.do = do[1];
        try {
            do = Image.createImage((String)(String.valueOf(bT.if()) + "/on/logo.on"));
            "".length();
        }
        catch (IOException iOException) {
            iOException.printStackTrace();
        }
        if ("  ".length() < -" ".length()) {
            return;
        }
        super.try();
    }

    static {
        o_0.if();
    }

    public final void byte() {
        if (o_0.do(this.do, do[2])) {
            fj.int = ((bp)AngelChip.do).int;
            fj.byte = ((bp)AngelChip.do).for;
            aO.do().try();
            "".length();
            if ("  ".length() != "  ".length()) {
                return;
            }
        } else if (o_0.do(this.do)) {
            bx.do.int();
        }
        this.do += do[1];
    }
}

