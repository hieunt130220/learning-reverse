/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Command
 *  javax.microedition.lcdui.CommandListener
 *  javax.microedition.lcdui.Display
 *  javax.microedition.lcdui.Displayable
 *  javax.microedition.lcdui.TextField
 *  javax.microedition.midlet.MIDlet
 */
import javax.microedition.lcdui.Command;
import javax.microedition.lcdui.CommandListener;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.TextField;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from aK
 * Duplicate member names - consider using --renamedupmembers true
 */
final class ak_0
implements CommandListener {
    private final TextField do;
    private final Command do;
    private static int[] do;

    private static void do() {
        do = new int[2];
        ak_0.do[0] = "  ".length();
        ak_0.do[1] = " ".length();
    }

    public final void commandAction(Command command, Displayable displayable) {
        block3: {
            block2: {
                if (!ak_0.do(command, this.do)) break block2;
                if (!ak_0.do(this.do.getString().equals("") ? 1 : 0)) break block3;
                fv_0.do().do(do[0], this.do.getString());
            }
            bx.do.setFullScreenMode(do[1]);
            Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)bx.do);
        }
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    ak_0(Command command, TextField textField) {
        this.do = command;
        this.do = textField;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    static {
        ak_0.do();
    }
}

