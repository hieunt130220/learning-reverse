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
 *  javax.microedition.midlet.MIDlet
 */
import javax.microedition.lcdui.ChoiceGroup;
import javax.microedition.lcdui.Command;
import javax.microedition.lcdui.CommandListener;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.Form;
import javax.microedition.lcdui.Item;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class ar
extends Form
implements CommandListener {
    private final ChoiceGroup do;
    private static final int[] do;
    private final ChoiceGroup if;
    private final Command do;

    static {
        ar.do();
    }

    private static void do() {
        do = new int[6];
        ar.do[0] = "  ".length();
        ar.do[1] = 0x50 ^ 0x54;
        ar.do[2] = (0x3F ^ 0x61) & ~(0x19 ^ 0x47);
        ar.do[3] = " ".length();
        ar.do[4] = "   ".length();
        ar.do[5] = 0 ^ 0x53 ^ (0x94 ^ 0xC0);
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    public final void commandAction(Command command, Displayable displayable) {
        if (ar.do(command, this.do)) {
            az_0.if = this.do.isSelected(do[2]);
            az_0.do = this.do.isSelected(do[3]);
            az_0.new = this.do.isSelected(do[0]);
            az_0.case = this.do.isSelected(do[4]);
            az_0.byte = this.if.isSelected(do[2]);
            az_0.for = this.if.isSelected(do[3]);
            az_0.try = this.if.isSelected(do[0]);
            az_0.int = this.if.isSelected(do[4]);
            az_0.int();
            bx.if("\u0110\u00e3 l\u01b0u c\u00e0i \u0111\u1eb7t!");
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    public ar() {
        super("C\u00e0i \u0111\u1eb7t ch\u0103m farm b\u1ea1n b\u00e8");
        String[] stringArray = new String[do[1]];
        stringArray[ar.do[2]] = "T\u01b0\u1edbi n\u01b0\u1edbc";
        stringArray[ar.do[3]] = "Di\u1ec7t s\u00e2u";
        stringArray[ar.do[0]] = "Di\u1ec7t c\u1ecf";
        stringArray[ar.do[4]] = "B\u00f3n ph\u00e2n";
        this.do = new ChoiceGroup("Ch\u0103m s\u00f3c c\u00e2y tr\u1ed3ng", do[0], stringArray, null);
        this.append((Item)this.do);
        "".length();
        String[] stringArray2 = new String[do[1]];
        stringArray2[ar.do[2]] = "Cho \u0103n";
        stringArray2[ar.do[3]] = "Ch\u1eefa b\u1ec7nh c\u00fam";
        stringArray2[ar.do[0]] = "Ch\u1eefa b\u1ec7nh ti\u00eau ch\u1ea3y";
        stringArray2[ar.do[4]] = "B\u01a1m thu\u1ed1c b\u1ed5";
        this.if = new ChoiceGroup("Ch\u0103m s\u00f3c v\u1eadt nu\u00f4i", do[0], stringArray2, null);
        this.append((Item)this.if);
        "".length();
        this.append("L\u01b0u \u00fd: n\u1ebfu l\u00e1i bu\u00f4n h\u1ed7 tr\u1ee3 \u0111ang \u0111\u01b0\u1ee3c k\u00edch ho\u1ea1t. B\u1ea1n c\u1ea7n \u0111\u0103ng xu\u1ea5t ra v\u00e0 \u0111\u0103ng nh\u1eadp l\u1ea1i m\u1edbi c\u00f3 th\u1ec3 ch\u0103m farm b\u1ea1n b\u00e8!");
        "".length();
        this.do = new Command("L\u01b0u", do[1], do[2]);
        this.addCommand(this.do);
        this.addCommand(new Command("H\u1ee7y", do[5], do[2]));
        this.setCommandListener(this);
        this.do.setSelectedIndex(do[2], az_0.if);
        this.do.setSelectedIndex(do[3], az_0.do);
        this.do.setSelectedIndex(do[0], az_0.new);
        this.do.setSelectedIndex(do[4], az_0.case);
        this.if.setSelectedIndex(do[2], az_0.byte);
        this.if.setSelectedIndex(do[3], az_0.for);
        this.if.setSelectedIndex(do[0], az_0.try);
        this.if.setSelectedIndex(do[4], az_0.int);
    }
}

