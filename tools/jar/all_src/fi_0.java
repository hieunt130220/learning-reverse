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
 * Renamed from fI
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class fi_0
extends Form
implements CommandListener {
    private final Command do;
    private final TextField do;
    private final ChoiceGroup do;
    private final ChoiceGroup if;
    private static final int[] do;
    private final ChoiceGroup for;

    public final void commandAction(Command command, Displayable displayable) {
        block4: {
            if (!fi_0.do(command, this.do)) break block4;
            al.int = this.do.isSelected(do[2]);
            al.try = this.do.isSelected(do[3]);
            al.new = this.do.isSelected(do[0]);
            al.do = this.do.isSelected(do[4]);
            al.if = this.if.isSelected(do[2]);
            al.do = (byte)this.for.getSelectedIndex();
            try {
                al.do = Integer.parseInt(this.do.getString().trim());
                al.do().do = al.do * do[8];
                al.do().if = 0L;
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
            }
            "".length();
            if (" ".length() <= -" ".length()) {
                return;
            }
            if (fi_0.do(al.new ? 1 : 0) && fi_0.do(al.do ? 1 : 0)) {
                al.int = do[2];
            }
            al.new();
            bx.if("\u0110\u00e3 l\u01b0u c\u00e0i \u0111\u1eb7t!");
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    public fi_0() {
        super("C\u00e0i \u0111\u1eb7t Auto KC");
        String[] stringArray = new String[do[1]];
        stringArray[fi_0.do[2]] = "B\u00e1n \u0111\u00e1 khi \u0111\u1ea7y r\u01b0\u01a1ng";
        stringArray[fi_0.do[3]] = "T\u1ef1 v\u1ec1 ch\u0103m farm";
        stringArray[fi_0.do[0]] = "T\u1ef1 b\u1ecf KCX";
        stringArray[fi_0.do[4]] = "T\u1ef1 b\u1ecf NHB";
        this.do = new ChoiceGroup("T\u00f9y ch\u1ecdn", do[0], stringArray, null);
        this.append((Item)this.do);
        "".length();
        this.do = new TextField("T.gian v\u1ec1 farm (ph\u00fat):", String.valueOf(al.do), do[1], do[0]);
        this.append((Item)this.do);
        "".length();
        String[] stringArray2 = new String[do[3]];
        stringArray2[fi_0.do[2]] = "Thu ho\u1ea1ch \u0111\u00fang gi\u1edd";
        this.if = new ChoiceGroup("Farm th\u00f4ng minh", do[0], stringArray2, null);
        this.append((Item)this.if);
        "".length();
        String[] stringArray3 = new String[do[5]];
        stringArray3[fi_0.do[2]] = "V\u00e0ng";
        stringArray3[fi_0.do[3]] = "Tr\u1eafng";
        stringArray3[fi_0.do[0]] = "\u0110\u1ecf";
        stringArray3[fi_0.do[4]] = "Xanh lam";
        stringArray3[fi_0.do[1]] = "Xanh l\u00e1";
        stringArray3[fi_0.do[6]] = "T\u00edm";
        stringArray3[fi_0.do[7]] = "M\u1eb7c \u0111\u1ecbnh";
        this.for = new ChoiceGroup("Th\u1ee9 t\u1ef1 \u01b0u ti\u00ean", do[3], stringArray3, null);
        this.append((Item)this.for);
        "".length();
        this.do = new Command("L\u01b0u", do[1], do[2]);
        this.addCommand(this.do);
        this.addCommand(new Command("H\u1ee7y", do[5], do[2]));
        this.setCommandListener(this);
        this.do.setSelectedIndex(do[2], al.int);
        this.do.setSelectedIndex(do[3], al.try);
        this.do.setSelectedIndex(do[0], al.new);
        this.do.setSelectedIndex(do[4], al.do);
        this.if.setSelectedIndex(do[2], al.if);
        this.for.setSelectedIndex((int)al.do, do[3]);
    }

    static {
        fi_0.do();
    }

    private static void do() {
        do = new int[9];
        fi_0.do[0] = "  ".length();
        fi_0.do[1] = 124 + 49 - 82 + 54 ^ 147 + 14 - 141 + 129;
        fi_0.do[2] = (22 + 1 - -90 + 21 ^ 26 + 0 - -36 + 91) & (0x4D ^ 0x7E ^ (0x3C ^ 0x10) ^ -" ".length());
        fi_0.do[3] = " ".length();
        fi_0.do[4] = "   ".length();
        fi_0.do[5] = 0x6D ^ 0x30 ^ (0x9E ^ 0xC4);
        fi_0.do[6] = 0x42 ^ 0x65 ^ (0x8C ^ 0xAE);
        fi_0.do[7] = 0x4B ^ 0x4D;
        fi_0.do[8] = -(0xFFFFF79B & 0x1CF7) & (0xFFFFFEFE & 0xFFF3);
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static boolean do(int n) {
        return n != 0;
    }
}

