/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.ChoiceGroup
 *  javax.microedition.lcdui.Command
 *  javax.microedition.lcdui.CommandListener
 *  javax.microedition.lcdui.Display
 *  javax.microedition.lcdui.Displayable
 *  javax.microedition.lcdui.Form
 *  javax.microedition.lcdui.Item
 *  javax.microedition.lcdui.TextField
 *  javax.microedition.midlet.MIDlet
 */
import javax.microedition.lcdui.ChoiceGroup;
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
 * Renamed from bi
 * Duplicate member names - consider using --renamedupmembers true
 */
final class bi_0
extends Form
implements CommandListener {
    private final TextField do;
    private final ChoiceGroup do;
    private static final int[] do;
    private final Command do;
    private static boolean do;
    private static int do;

    public bi_0() {
        super("C\u00e0i \u0111\u1eb7t \u0111\u00e1nh boss");
        String[] stringArray = new String[do[1]];
        stringArray[bi_0.do[2]] = "\u0110\u00e2y l\u00e0 acc ch\u00ednh";
        this.do = new ChoiceGroup("Buff nick n\u00e0y?", do[0], stringArray, null);
        this.append((Item)this.do);
        "".length();
        this.do = new TextField("S\u1ed1 l\u01b0\u1ee3ng acc c\u1ee7a b\u1ea1n:", String.valueOf(do), do[0], do[0]);
        this.append((Item)this.do);
        "".length();
        this.do = new Command("\u0110\u00e1nh", do[3], do[2]);
        this.addCommand(this.do);
        this.addCommand(new Command("H\u1ee7y", do[4], do[2]));
        this.setCommandListener(this);
        this.do.setSelectedIndex(do[2], do);
    }

    public final void do() {
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)this);
    }

    static {
        bi_0.if();
        do = do[1];
        do = do[5];
    }

    public final void commandAction(Command command, Displayable displayable) {
        block3: {
            if (!bi_0.do(command, this.do)) break block3;
            do = this.do.isSelected(do[2]);
            try {
                do = Integer.parseInt(this.do.getString().trim());
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
                do = do[2];
            }
            "".length();
            if ("  ".length() < -" ".length()) {
                return;
            }
            V.do().do(do, do);
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static void if() {
        do = new int[6];
        bi_0.do[0] = "  ".length();
        bi_0.do[1] = " ".length();
        bi_0.do[2] = (0x31 ^ 0x37) & ~(0x30 ^ 0x36);
        bi_0.do[3] = 0x1C ^ 0x67 ^ 58 + 39 - 43 + 73;
        bi_0.do[4] = 0x95 ^ 0x92;
        bi_0.do[5] = 0x1D ^ 0x7F ^ (0x10 ^ 0x66);
    }
}

