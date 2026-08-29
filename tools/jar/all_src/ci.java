/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Command
 *  javax.microedition.lcdui.CommandListener
 *  javax.microedition.lcdui.Display
 *  javax.microedition.lcdui.Displayable
 *  javax.microedition.lcdui.Form
 *  javax.microedition.lcdui.Item
 *  javax.microedition.lcdui.TextField
 *  javax.microedition.midlet.MIDlet
 */
import javax.microedition.lcdui.Command;
import javax.microedition.lcdui.CommandListener;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.Form;
import javax.microedition.lcdui.Item;
import javax.microedition.lcdui.TextField;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
final class ci
extends Form
implements CommandListener {
    private static final int[] do;
    private final Command do;
    private final TextField do;

    static {
        ci.do();
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    public ci() {
        super("Nh\u1eadp d\u1eef li\u1ec7u");
        k.do();
        "".length();
        this.do = new TextField("\u0110\u01b0\u1eddng d\u1eabn: ", k.do(), do[0], do[1]);
        this.append((Item)this.do);
        "".length();
        this.do = new Command("Nh\u1eadp", do[2], do[1]);
        this.addCommand(this.do);
        this.addCommand(new Command("H\u1ee7y", do[3], do[1]));
        this.setCommandListener(this);
    }

    public final void commandAction(Command object, Displayable displayable) {
        if (ci.do(object, this.do)) {
            k.do();
            "".length();
            object = k.do(this.do.getString().trim());
            if (ci.do(object) && ci.do(((String)object).equals("") ? 1 : 0)) {
                bx.int();
                k.do.do.removeAllElements();
                k.for();
                k.if((String)object);
                k.do();
                "".length();
                k.if();
                bx.if("Nh\u1eadp d\u1eef li\u1ec7u th\u00e0nh c\u00f4ng! H\u00e3y x\u00f3a file d\u1eef li\u1ec7u TK \u0111\u1ec3 tr\u00e1nh b\u1ecb l\u1ed9");
                "".length();
                if (" ".length() == 0) {
                    return;
                }
            } else {
                bx.if("Nh\u1eadp d\u1eef li\u1ec7u th\u1ea5t b\u1ea1i! H\u00e3y ki\u1ec3m tra l\u1ea1i \u0111\u01b0\u1eddng d\u1eabn t\u1edbi file d\u1eef li\u1ec7u.");
            }
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    private static void do() {
        do = new int[4];
        ci.do[0] = 0xFFFF9D6E & 0x6691;
        ci.do[1] = (0x63 ^ 0x40) & ~(0x4E ^ 0x6D);
        ci.do[2] = 0x39 ^ 0x3D;
        ci.do[3] = 0x49 ^ 0x4E;
    }
}

