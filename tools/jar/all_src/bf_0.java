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
 * Renamed from bf
 * Duplicate member names - consider using --renamedupmembers true
 */
final class bf_0
extends Form
implements CommandListener {
    private static final int[] do;
    private final TextField do;
    private final Command do;

    private static void do() {
        do = new int[4];
        bf_0.do[0] = 0xFFFFDE25 & 0x25DA;
        bf_0.do[1] = (0x26 ^ 0x13 ^ 73 + 48 - 100 + 106) & (0xE0 ^ 0x8D ^ (0xBD ^ 0x9A) ^ -" ".length());
        bf_0.do[2] = 0xF0 ^ 0xC1 ^ (0x4E ^ 0x7B);
        bf_0.do[3] = 174 + 27 - 29 + 20 ^ 8 + 111 - 32 + 112;
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    public final void commandAction(Command command, Displayable displayable) {
        if (bf_0.do(command, this.do)) {
            k.do();
            "".length();
            k.do(this.do.getString().trim());
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    static {
        bf_0.do();
    }

    public bf_0() {
        super("Xu\u1ea5t d\u1eef li\u1ec7u");
        k.do();
        "".length();
        this.do = new TextField("\u0110\u01b0\u1eddng d\u1eabn: ", k.do(), do[0], do[1]);
        this.append((Item)this.do);
        "".length();
        this.do = new Command("Xu\u1ea5t", do[2], do[1]);
        this.addCommand(this.do);
        this.addCommand(new Command("H\u1ee7y", do[3], do[1]));
        this.setCommandListener(this);
    }
}

