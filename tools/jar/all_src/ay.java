/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Alert
 *  javax.microedition.lcdui.AlertType
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
import javax.microedition.lcdui.Alert;
import javax.microedition.lcdui.AlertType;
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
public final class ay
extends Form
implements CommandListener {
    private final TextField do;
    private final TextField if;
    private final TextField for;
    private final ChoiceGroup do;
    private static final int[] do;
    private final TextField int = new TextField("T.gian b\u00e1n (ph\u00fat):", String.valueOf(d_0.new), do[0], do[1]);
    private final Command do;

    public ay() {
        super("C\u00e0i \u0111\u1eb7t b\u00e1n \u0111\u00e1");
        this.append((Item)this.int);
        "".length();
        this.for = new TextField("Qu\u00e3ng ngh\u1ec9 (ms):", String.valueOf(d_0.for), do[2], do[1]);
        this.append((Item)this.for);
        "".length();
        this.if = new TextField("Khu b\u00e1n t\u1eeb khu:", String.valueOf(d_0.try), do[3], do[1]);
        this.append((Item)this.if);
        "".length();
        this.do = new TextField("\u0110\u1ebfn khu:", String.valueOf(d_0.int), do[3], do[1]);
        this.append((Item)this.do);
        "".length();
        String[] stringArray = new String[do[0]];
        stringArray[ay.do[4]] = "Reset time khi b\u00e1n dc NHB";
        stringArray[ay.do[5]] = "Reset time khi b\u00e1n dc KCX";
        stringArray[ay.do[1]] = "B\u1ecf NHB n\u1ebfu ko b\u00e1n dc";
        stringArray[ay.do[3]] = "B\u1ecf KCX n\u1ebfu ko b\u00e1n dc";
        this.do = new ChoiceGroup("T\u00f9y ch\u1ecdn", do[1], stringArray, null);
        this.append((Item)this.do);
        "".length();
        this.do = new Command("Save", do[0], do[4]);
        this.addCommand(this.do);
        this.addCommand(new Command("Cancel", do[6], do[4]));
        this.setCommandListener(this);
        this.do.setSelectedIndex(do[4], d_0.do);
        this.do.setSelectedIndex(do[5], d_0.int);
        this.do.setSelectedIndex(do[1], d_0.for);
        this.do.setSelectedIndex(do[3], d_0.if);
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    public final void commandAction(Command command, Displayable displayable) {
        if (ay.do(command, this.do)) {
            try {
                d_0.new = Integer.parseInt(this.int.getString().trim());
                d_0.for = Integer.parseInt(this.for.getString().trim());
                d_0.try = Integer.parseInt(this.if.getString().trim());
                d_0.int = Integer.parseInt(this.do.getString().trim());
                d_0.do = this.do.isSelected(do[4]);
                d_0.int = this.do.isSelected(do[5]);
                d_0.for = this.do.isSelected(do[1]);
                d_0.if = this.do.isSelected(do[3]);
                d_0.do();
                bx.if("L\u01b0u c\u00e0i \u0111\u1eb7t th\u00e0nh c\u00f4ng");
                "".length();
            }
            catch (Exception exception) {
                "".length();
                Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)new Alert("L\u1ed7i", "C\u00f3 l\u1ed7i x\u1ea3y ra. H\u00e3y xem l\u1ea1i c\u00e0i \u0111\u1eb7t!", null, AlertType.ERROR));
                return;
            }
            if (null != null) {
                return;
            }
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    static {
        ay.do();
    }

    private static void do() {
        do = new int[7];
        ay.do[0] = 0x47 ^ 0x43;
        ay.do[1] = "  ".length();
        ay.do[2] = 0x70 ^ 0x61 ^ (0x38 ^ 0x2F);
        ay.do[3] = "   ".length();
        ay.do[4] = (0xB3 ^ 0x83 ^ (4 ^ 0x26)) & (115 + 11 - 82 + 88 ^ 58 + 50 - -38 + 4 ^ -" ".length());
        ay.do[5] = " ".length();
        ay.do[6] = 0x55 ^ 0xD ^ (0x5B ^ 4);
    }
}

