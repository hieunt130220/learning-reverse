/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Canvas
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Canvas;
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public abstract class m
extends Canvas {
    private static final int[] do;

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    protected final void keyReleased(int n) {
        if (m.do(n, ga_0.do)) {
            ga_0.do().do();
            return;
        }
        if (m.do(n, do[0])) {
            n = do[1];
        }
        this.do(n);
    }

    protected void do(int n) {
    }

    protected abstract void do(Graphics var1);

    static {
        m.do();
    }

    protected final void paint(Graphics graphics) {
        this.do(graphics);
    }

    protected final void keyPressed(int n) {
        if (m.do(n, do[0])) {
            n = do[1];
        }
        this.if(n);
    }

    protected final void keyRepeated(int n) {
        if (!m.if(n, ga_0.do) || m.do(ga_0.do) && m.do(n, do[2])) {
            R.do().do();
        }
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    private static void do() {
        do = new int[3];
        m.do[0] = -(0x12 ^ 0x18);
        m.do[1] = -(0xB1 ^ 0xB7);
        m.do[2] = 0x3D ^ 0x1E;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    protected void if(int n) {
    }
}

