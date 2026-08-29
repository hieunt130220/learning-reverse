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
public final class Z
extends Form
implements CommandListener {
    private static final int[] do;
    private final Command do;
    private final TextField do;
    private final ChoiceGroup do = new TextField("T.gian chuy\u1ec3n map (ms):", String.valueOf(av.do), do[0], do[1]);

    static {
        Z.if();
    }

    public Z() {
        super("C\u00e0i \u0111\u1eb7t Auto Ai C\u1eadp");
        int n;
        this.append((Item)this.do);
        "".length();
        String[] stringArray = new String[do[1]];
        stringArray[Z.do[3]] = "Nh\u1eadn \u0111\u1ed3 Pharaoh";
        stringArray[Z.do[2]] = "B\u1ecf \u0111\u1ed3 Pharaoh";
        this.do = new ChoiceGroup("C\u00f3 nh\u1eadn qu\u00e0 kh\u00f4ng?", do[2], stringArray, null);
        this.append((Item)this.do);
        "".length();
        this.do = new Command("L\u01b0u", do[4], do[3]);
        this.addCommand(this.do);
        this.addCommand(new Command("H\u1ee7y", do[5], do[3]));
        this.setCommandListener(this);
        if (Z.do(av.do ? 1 : 0)) {
            n = do[2];
            "".length();
            if (-(0xBC ^ 0xB8) >= 0) {
                throw null;
            }
        } else {
            n = do[3];
        }
        this.do.setSelectedIndex(n, do[2]);
    }

    public final void commandAction(Command command, Displayable displayable) {
        block3: {
            if (!Z.do(command, this.do)) break block3;
            av.do = this.do.isSelected(do[2]);
            try {
                av.do = Long.parseLong(this.do.getString().trim());
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
            }
            "".length();
            if (((0x88 ^ 0x9C) & ~(0x5F ^ 0x4B)) > 0) {
                return;
            }
            av.int();
            bx.if("\u0110\u00e3 l\u01b0u c\u00e0i \u0111\u1eb7t!");
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    public final void do() {
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)this);
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static void if() {
        do = new int[6];
        Z.do[0] = 0x85 ^ 0x80;
        Z.do[1] = "  ".length();
        Z.do[2] = " ".length();
        Z.do[3] = (0x15 ^ 0x3D) & ~(0xEF ^ 0xC7);
        Z.do[4] = 0x1F ^ 0x73 ^ (0xC6 ^ 0xAE);
        Z.do[5] = 0xA6 ^ 0xA1;
    }
}

