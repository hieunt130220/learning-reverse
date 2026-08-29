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
 *  javax.microedition.lcdui.List
 *  javax.microedition.lcdui.TextField
 *  javax.microedition.midlet.MIDlet
 */
import javax.microedition.lcdui.Command;
import javax.microedition.lcdui.CommandListener;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.Form;
import javax.microedition.lcdui.Item;
import javax.microedition.lcdui.List;
import javax.microedition.lcdui.TextField;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class aI
implements CommandListener {
    private Form do;
    private List do;
    private Command do;
    private Command if;
    private Command for;
    private Command int;
    private Command new;
    private TextField do = new Command("X\u00f3a", do[0], do[1]);
    private static final int[] do;
    private static boolean do;

    public aI() {
        this.if = new Command("Ch\u1ecdn t\u1ea5t c\u1ea3", do[2], do[2]);
        this.for = new Command("Th\u00eam", do[2], do[3]);
        this.int = new Command("\u0110\u00f3ng", do[4], do[4]);
        this.new = new Command("H\u1ee7y", do[4], do[0]);
    }

    private static boolean do(int n) {
        return n > 0;
    }

    static {
        aI.if();
        do = do[1];
    }

    public final void do() {
        if (aI.int(do ? 1 : 0) && aI.int(dy_0.if.isEmpty() ? 1 : 0)) {
            new Thread(new bd_0(this)).start();
            "".length();
            if (((11 + 70 - -3 + 46 ^ 174 + 165 - 177 + 20) & (97 + 54 - 74 + 57 ^ 12 + 102 - 37 + 101 ^ -" ".length())) != 0) {
                return;
            }
        } else {
            this.for();
        }
        do = do[2];
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static boolean for(int n) {
        return n >= 0;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    static void do(aI aI2) {
        aI2.for();
    }

    private static void if() {
        do = new int[10];
        aI.do[0] = 0x42 ^ 0xA ^ (0xCF ^ 0x83);
        aI.do[1] = (0x6F ^ 0x1B ^ (0x16 ^ 0x26)) & (0x37 ^ 0x2E ^ (0xCC ^ 0x91) ^ -" ".length());
        aI.do[2] = " ".length();
        aI.do[3] = "   ".length();
        aI.do[4] = "  ".length();
        aI.do[5] = 0x22 ^ 3 ^ (0xAA ^ 0x81);
        aI.do[6] = 0x51 ^ 0x45;
        aI.do[7] = 0xA4 ^ 0x8C;
        aI.do[8] = 0x93 ^ 0xA1;
        aI.do[9] = 0xFFFFECF7 & 0x1708;
    }

    private void for() {
        this.do = new List("Danh s\u00e1ch ID t\u1ef1 d\u00f9ng", do[4]);
        if (aI.int(dy_0.if.isEmpty() ? 1 : 0)) {
            int n = do[1];
            while (aI.do(n, dy_0.if.size())) {
                String string;
                short s2 = (Short)dy_0.if.elementAt(n);
                Object object = ac_0.do(s2);
                String string2 = ac_0.do((ao_0)object);
                StringBuffer stringBuffer = new StringBuffer().append(s2).append(": ");
                if (aI.if(string2.equals("tr\u00f2n") ? 1 : 0)) {
                    string = "Ko c\u00f3 d\u1eef li\u1ec7u";
                    "".length();
                    if (null != null) {
                        return;
                    }
                } else {
                    ao_0 ao_02 = object;
                    object = string2;
                    ao_0 ao_03 = ao_02;
                    string2 = "";
                    if (aI.if(ao_03.do, do[5])) {
                        string2 = "Qu\u1ea7n ";
                        "".length();
                        if ((0x1C ^ 0x18) < 0) {
                            return;
                        }
                    } else if (aI.if(ao_03.do, do[6])) {
                        string2 = "\u00c1o ";
                        "".length();
                        if ("  ".length() == 0) {
                            return;
                        }
                    } else if (aI.if(ao_03.do, do[7])) {
                        string2 = "M\u1eaft ";
                        "".length();
                        if ("   ".length() < "   ".length()) {
                            return;
                        }
                    } else if (aI.if(ao_03.do, do[8])) {
                        string2 = "T\u00f3c ";
                    }
                    string = string2 + (String)object;
                }
                this.do.append(stringBuffer.append(string).toString(), null);
                "".length();
                ++n;
                "".length();
                if (-" ".length() <= (0x5F ^ 0x5B)) continue;
                return;
            }
            this.do.addCommand(this.do);
            this.do.addCommand(this.if);
        }
        this.do.addCommand(this.for);
        this.do.addCommand(this.int);
        this.do.setCommandListener((CommandListener)this);
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)this.do);
    }

    private static boolean int(int n) {
        return n == 0;
    }

    public final void commandAction(Command object, Displayable object2) {
        if (aI.do(object2, this.do)) {
            if (aI.do(object, this.for) && aI.do((object = aq_0.if(this.do.getString().trim())).length())) {
                object2 = "";
                if (aI.int(dy_0.if.isEmpty() ? 1 : 0)) {
                    int n = do[1];
                    while (aI.do(n, dy_0.if.size())) {
                        short s2 = (Short)dy_0.if.elementAt(n);
                        object2 = (String)object2 + s2;
                        object2 = (String)object2 + ",";
                        ++n;
                        "".length();
                        if (((0xFE ^ 0xC3) & ~(0x9B ^ 0xA6)) == 0) continue;
                        return;
                    }
                }
                dy_0.if((String)object2 + (String)object);
                dy_0.try();
            }
            this.for();
            return;
        }
        if (aI.do(object2, this.do)) {
            if (aI.do(object, this.for)) {
                object = this;
                this.do = new Form("Th\u00eam ID t\u1ef1 d\u00f9ng");
                object.do = new TextField("Item ID:", "", do[9], do[1]);
                object.do.append((Item)object.do);
                "".length();
                object.do.append("- Th\u00eam nhi\u1ec1u ID? M\u1ed7i ID c\u00e1ch nhau d\u1ea5u ph\u1ea9y ,");
                "".length();
                object.do.append("- VD: 3958,4620");
                "".length();
                object.do.addCommand(object.for);
                object.do.addCommand(object.new);
                object.do.setCommandListener((CommandListener)object);
                Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)object.do);
                return;
            }
            if (aI.do(object, this.do)) {
                int n = do[1];
                object2 = "";
                int n2 = this.do.size() - do[2];
                while (aI.for(n2)) {
                    if (aI.if(this.do.isSelected(n2) ? 1 : 0)) {
                        this.do.delete(n2);
                        ++n;
                        "".length();
                        if (-" ".length() > (0x72 ^ 0x76)) {
                            return;
                        }
                    } else {
                        String[] stringArray = aq_0.do(this.do.getString(n2), ":");
                        if (aI.int(((String)object2).equals("") ? 1 : 0)) {
                            object2 = (String)object2 + ",";
                        }
                        object2 = (String)object2 + stringArray[do[1]];
                    }
                    --n2;
                    "".length();
                    if ("   ".length() > "  ".length()) continue;
                    return;
                }
                if (aI.do(n)) {
                    if (aI.int(((String)object2).equals("") ? 1 : 0)) {
                        dy_0.if((String)object2);
                        dy_0.try();
                        return;
                    }
                    dy_0.if.removeAllElements();
                    cs.if("useItemLists", "-1");
                }
                return;
            }
            if (aI.do(object, this.if)) {
                int n = do[1];
                while (aI.do(n, this.do.size())) {
                    this.do.setSelectedIndex(n, do[2]);
                    ++n;
                    "".length();
                    if (((0x6A ^ 0x33) & ~(0xFE ^ 0xA7)) >= ((0x65 ^ 0x57) & ~(0xD ^ 0x3F))) continue;
                    return;
                }
                return;
            }
        }
        if (aI.do(bx.do, fs.do())) {
            fs.do().int();
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }
}

