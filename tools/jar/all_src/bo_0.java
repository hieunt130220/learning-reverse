/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Canvas
 *  javax.microedition.lcdui.Display
 *  javax.microedition.lcdui.Displayable
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.midlet.MIDlet
 */
import javax.microedition.lcdui.Canvas;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.Graphics;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from bo
 * Duplicate member names - consider using --renamedupmembers true
 */
final class bo_0
extends Canvas {
    private final R do;
    private static final int[] do;

    static {
        bo_0.do();
    }

    public final void keyPressed(int n) {
        this.do.do.setString(String.valueOf(n));
        this.do.for.setString("0");
        this.do.if.setString("0");
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)this.do.if);
    }

    public bo_0(R r) {
        this.do = r;
        this.setFullScreenMode(do[0]);
    }

    private static void do() {
        do = new int[5];
        bo_0.do[0] = " ".length();
        bo_0.do[1] = 0xFFFFFFFF & 0xFFFFFF;
        bo_0.do[2] = (180 + 89 - 150 + 90 ^ 81 + 19 - 59 + 101) & (0x4F ^ 0x2E ^ (0xC ^ 0x32) ^ -" ".length());
        bo_0.do[3] = "  ".length();
        bo_0.do[4] = 0xA1 ^ 0x94 ^ (3 ^ 0x77);
    }

    public final void paint(Graphics graphics) {
        graphics.setColor(do[1]);
        graphics.fillRect(do[2], do[2], this.getWidth(), this.getHeight());
        graphics.setColor(do[2]);
        graphics.drawString("Nh\u1ea5n ph\u00edm \u0111\u1ec3 l\u1ea5y m\u00e3...", this.getWidth() / do[3], this.getHeight() / do[3], do[4]);
    }
}

