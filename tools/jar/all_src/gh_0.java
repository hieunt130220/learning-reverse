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
 * Renamed from gH
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class gh_0
extends Form
implements CommandListener {
    private final TextField do;
    private final TextField if;
    private final Command do;
    private final TextField for;
    private final ChoiceGroup do = new TextField("Danh s\u00e1ch c\u1ea7n t\u00ecm:", P.if, do[0], do[1]);
    private final ChoiceGroup if;
    private final ChoiceGroup for;
    private final TextField int;
    private static final int[] do;

    private static void do() {
        do = new int[7];
        gh_0.do[0] = -(0xFFFFE876 & 0x77DB) & (0xFFFFFD71 & 0x66DF);
        gh_0.do[1] = (0xC9 ^ 0x82 ^ (0x35 ^ 0x6F)) & (0x22 ^ 0x7C ^ (0x4A ^ 5) ^ -" ".length());
        gh_0.do[2] = "   ".length();
        gh_0.do[3] = "  ".length();
        gh_0.do[4] = " ".length();
        gh_0.do[5] = 0xBB ^ 0xC6 ^ (0xC8 ^ 0xB1);
        gh_0.do[6] = 0xA4 ^ 0xA3;
    }

    public gh_0() {
        super("C\u00e0i \u0111\u1eb7t t\u00ecm IG");
        this.append((Item)this.do);
        "".length();
        this.int = new TextField("Khu b\u1eaft \u0111\u1ea7u:", String.valueOf(P.do), do[2], do[3]);
        this.append((Item)this.int);
        "".length();
        this.for = new TextField("Khu k\u1ebft th\u00fac:", String.valueOf(P.for), do[2], do[3]);
        this.append((Item)this.for);
        "".length();
        String[] stringArray = new String[do[3]];
        stringArray[gh_0.do[1]] = "T\u1ea5t c\u1ea3 map TP";
        stringArray[gh_0.do[4]] = "T\u1ef1 c\u00e0i \u0111\u1eb7t map";
        this.if = new ChoiceGroup("C\u00e0i \u0111\u1eb7t chuy\u1ec3n map", do[4], stringArray, null);
        this.append((Item)this.if);
        "".length();
        this.if = new TextField("Danh s\u00e1ch ID map:", P.do, do[0], do[1]);
        this.append((Item)this.if);
        "".length();
        String[] stringArray2 = new String[do[5]];
        stringArray2[gh_0.do[1]] = "B\u1ecf qua khu \u0111\u1ea7y";
        stringArray2[gh_0.do[4]] = "T\u1ef1 \u0111i\u1ec3m danh \u1edf CV";
        stringArray2[gh_0.do[3]] = "T\u1ef1 b\u1eadt Auto d\u00f9ng VP";
        stringArray2[gh_0.do[2]] = "\u0110\u00e1nh NPC";
        this.do = new ChoiceGroup("T\u00f9y ch\u1ecdn", do[3], stringArray2, null);
        this.append((Item)this.do);
        "".length();
        String[] stringArray3 = new String[do[2]];
        stringArray3[gh_0.do[1]] = "T\u1eaft Auto";
        stringArray3[gh_0.do[4]] = "B\u1eadt Auto Fish";
        stringArray3[gh_0.do[3]] = "B\u1eadt Auto KC";
        this.for = new ChoiceGroup("Sau khi nh\u1eadn \u0111\u1ee7 qu\u00e0", do[4], stringArray3, null);
        this.append((Item)this.for);
        "".length();
        this.append("- HD: M\u1ed7i nh\u00e2n v\u1eadt ho\u1eb7c map c\u00e1ch nhau d\u1ea5u ph\u1ea9y ,");
        "".length();
        this.do = new Command("Save", do[5], do[1]);
        this.addCommand(this.do);
        this.addCommand(new Command("Cancel", do[6], do[1]));
        this.setCommandListener(this);
        this.do.setSelectedIndex(do[1], P.if);
        this.do.setSelectedIndex(do[4], P.int);
        this.do.setSelectedIndex(do[3], P.do);
        this.do.setSelectedIndex(do[2], P.for);
        this.for.setSelectedIndex((int)P.do, do[4]);
        this.if.setSelectedIndex((int)P.if, do[4]);
    }

    public final void commandAction(Command command, Displayable displayable) {
        if (gh_0.do(command, this.do)) {
            try {
                P.if = this.do.getString().trim();
                P.do = Integer.parseInt(this.int.getString().trim());
                P.for = Integer.parseInt(this.for.getString().trim());
                P.if = this.do.isSelected(do[1]);
                P.int = this.do.isSelected(do[4]);
                P.do = this.do.isSelected(do[3]);
                P.for = this.do.isSelected(do[2]);
                P.do = (byte)this.for.getSelectedIndex();
                P.if = (byte)this.if.getSelectedIndex();
                P.do = aq_0.if(this.if.getString().trim());
                P.do();
                bx.if("L\u01b0u c\u00e0i \u0111\u1eb7t th\u00e0nh c\u00f4ng");
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
                Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)new Alert("L\u1ed7i", "C\u00f3 l\u1ed7i x\u1ea3y ra. H\u00e3y xem l\u1ea1i c\u00e0i \u0111\u1eb7t!", null, AlertType.ERROR));
                return;
            }
            "".length();
            if (((196 + 118 - 291 + 176 ^ 109 + 67 - 74 + 40) & (60 + 98 - 125 + 162 ^ 118 + 5 - 51 + 66 ^ -" ".length())) == "  ".length()) {
                return;
            }
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    static {
        gh_0.do();
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }
}

