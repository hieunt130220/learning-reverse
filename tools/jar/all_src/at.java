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
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class at
extends Form
implements CommandListener {
    private final TextField do;
    private final ChoiceGroup do;
    private final ChoiceGroup if;
    private static final int[] do;
    private final Command do;

    public at() {
        super("C\u00e0i \u0111\u1eb7t Auto Treo Nick");
        String[] stringArray = new String[do[1]];
        stringArray[at.do[2]] = "\u0110\u0103ng xu\u1ea5t";
        stringArray[at.do[0]] = "\u0110\u1ee9ng c\u01b0\u1eddi";
        this.if = new ChoiceGroup("T\u00f9y ch\u1ecdn", do[0], stringArray, null);
        this.append((Item)this.if);
        "".length();
        this.do = new TextField("T.gian v\u1ec1 farm (ph\u00fat):", String.valueOf(ez_0.do), do[3], do[1]);
        this.append((Item)this.do);
        "".length();
        String[] stringArray2 = new String[do[0]];
        stringArray2[at.do[2]] = "Thu ho\u1ea1ch \u0111\u00fang gi\u1edd";
        this.do = new ChoiceGroup("Farm th\u00f4ng minh", do[1], stringArray2, null);
        this.append((Item)this.do);
        "".length();
        this.do = new Command("L\u01b0u", do[3], do[2]);
        this.addCommand(this.do);
        this.addCommand(new Command("H\u1ee7y", do[4], do[2]));
        this.setCommandListener(this);
        this.if.setSelectedIndex((int)ez_0.do, do[0]);
        this.do.setSelectedIndex(do[2], ez_0.do);
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    static {
        at.do();
    }

    private static void do() {
        do = new int[6];
        at.do[0] = " ".length();
        at.do[1] = "  ".length();
        at.do[2] = (0x13 ^ 0x2B) & ~(0x8A ^ 0xB2);
        at.do[3] = 0xF ^ 0xB;
        at.do[4] = 0xC6 ^ 0xC1;
        at.do[5] = -(78 + 28 - 8 + 49) & (0xFFFFEFFF & 0xFAF2);
    }

    private static boolean if(int n) {
        return n == 0;
    }

    public final void commandAction(Command command, Displayable displayable) {
        block7: {
            if (!at.do(command, this.do)) break block7;
            ez_0.do = (byte)this.if.getSelectedIndex();
            if (at.do(this.do.isSelected(do[2]) ? 1 : 0)) {
                if (at.if(ez_0.do ? 1 : 0)) {
                    ez_0.do().do = 0L;
                }
                ez_0.do = do[0];
                "".length();
                if ((" ".length() ^ (0x60 ^ 0x65)) <= 0) {
                    return;
                }
            } else {
                ez_0.do = do[2];
            }
            try {
                ez_0.do = Integer.parseInt(this.do.getString().trim());
                ez_0.do().if = ez_0.do * do[5];
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
            }
            "".length();
            if ("  ".length() == 0) {
                return;
            }
            ez_0.new();
            bx.if("\u0110\u00e3 l\u01b0u c\u00e0i \u0111\u1eb7t!");
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }
}

