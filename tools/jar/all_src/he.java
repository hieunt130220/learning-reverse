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
public final class he
implements CommandListener {
    private Command do;
    private static final int[] do;
    private Command if;
    private Form do;
    private TextField do;
    private Command for;
    private Command int = new Command("X\u00f3a", do[0], do[1]);
    private static boolean do;
    private Command new = new Command("Ch\u1ecdn t\u1ea5t c\u1ea3", do[2], do[2]);
    private List do;

    static {
        he.for();
        do = do[1];
    }

    static void do(he he2) {
        he2.if();
    }

    public he() {
        this.for = new Command("Th\u00eam", do[2], do[3]);
        this.do = new Command("\u0110\u00f3ng", do[4], do[4]);
        this.if = new Command("H\u1ee7y", do[4], do[0]);
    }

    private void if() {
        this.do = new List("Danh s\u00e1ch ID t\u1ef1 b\u1ecf", do[4]);
        if (he.int(dy_0.do.isEmpty() ? 1 : 0)) {
            int n = do[1];
            while (he.if(n, dy_0.do.size())) {
                String string;
                short s2 = (Short)dy_0.do.elementAt(n);
                Object object = ac_0.do(s2);
                String string2 = ac_0.do((ao_0)object);
                StringBuffer stringBuffer = new StringBuffer().append(s2).append(": ");
                if (he.for(string2.equals("tr\u00f2n") ? 1 : 0)) {
                    string = "Ko c\u00f3 d\u1eef li\u1ec7u";
                    "".length();
                    if ("  ".length() < 0) {
                        return;
                    }
                } else {
                    ao_0 ao_02 = object;
                    object = string2;
                    ao_0 ao_03 = ao_02;
                    string2 = "";
                    if (he.do(ao_03.do, do[5])) {
                        string2 = "Qu\u1ea7n ";
                        "".length();
                        if ("   ".length() <= 0) {
                            return;
                        }
                    } else if (he.do(ao_03.do, do[6])) {
                        string2 = "\u00c1o ";
                        "".length();
                        if ("   ".length() <= 0) {
                            return;
                        }
                    } else if (he.do(ao_03.do, do[7])) {
                        string2 = "M\u1eaft ";
                        "".length();
                        if ((0x66 ^ 0x62) < "   ".length()) {
                            return;
                        }
                    } else if (he.do(ao_03.do, do[8])) {
                        string2 = "T\u00f3c ";
                    }
                    string = string2 + (String)object;
                }
                this.do.append(stringBuffer.append(string).toString(), null);
                "".length();
                ++n;
                "".length();
                if (null == null) continue;
                return;
            }
            this.do.addCommand(this.int);
            this.do.addCommand(this.new);
        }
        this.do.addCommand(this.for);
        this.do.addCommand(this.do);
        this.do.setCommandListener((CommandListener)this);
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)this.do);
    }

    public final void do() {
        if (he.int(do ? 1 : 0) && he.int(dy_0.do.isEmpty() ? 1 : 0)) {
            new Thread(new by_0(this)).start();
            "".length();
            if (null != null) {
                return;
            }
        } else {
            this.if();
        }
        do = do[2];
    }

    private static void for() {
        do = new int[10];
        he.do[0] = 0x84 ^ 0x80;
        he.do[1] = (0x60 ^ 0x46) & ~(0x2F ^ 9);
        he.do[2] = " ".length();
        he.do[3] = "   ".length();
        he.do[4] = "  ".length();
        he.do[5] = 0x58 ^ 0x52;
        he.do[6] = 0x78 ^ 0x36 ^ (0xDB ^ 0x81);
        he.do[7] = 0x52 ^ 0x35 ^ (0xD6 ^ 0x99);
        he.do[8] = 140 + 107 - 68 + 2 ^ 112 + 101 - 160 + 82;
        he.do[9] = -(0xFFFFF7E7 & 0x7BFE) & (0xFFFFFFFF & 0x77E5);
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    public final void commandAction(Command object, Displayable object2) {
        if (he.do(object2, this.do)) {
            if (he.do(object, this.for) && he.do((object = aq_0.if(this.do.getString().trim())).length())) {
                object2 = "";
                if (he.int(dy_0.do.isEmpty() ? 1 : 0)) {
                    int n = do[1];
                    while (he.if(n, dy_0.do.size())) {
                        short s2 = (Short)dy_0.do.elementAt(n);
                        object2 = (String)object2 + s2;
                        object2 = (String)object2 + ",";
                        ++n;
                        "".length();
                        if (-" ".length() < "   ".length()) continue;
                        return;
                    }
                }
                dy_0.for((String)object2 + (String)object);
                dy_0.new();
            }
            this.if();
            return;
        }
        if (he.do(object2, this.do)) {
            if (he.do(object, this.for)) {
                object = this;
                this.do = new Form("Th\u00eam ID t\u1ef1 b\u1ecf");
                object.do = new TextField("Item ID:", "", do[9], do[1]);
                object.do.append((Item)object.do);
                "".length();
                object.do.append("- Th\u00eam nhi\u1ec1u ID? M\u1ed7i ID c\u00e1ch nhau d\u1ea5u ph\u1ea9y ,");
                "".length();
                object.do.append("- VD: 2135,2136");
                "".length();
                object.do.addCommand(object.for);
                object.do.addCommand(object.if);
                object.do.setCommandListener((CommandListener)object);
                Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)object.do);
                return;
            }
            if (he.do(object, this.int)) {
                int n = do[1];
                object2 = "";
                int n2 = this.do.size() - do[2];
                while (he.if(n2)) {
                    if (he.for(this.do.isSelected(n2) ? 1 : 0)) {
                        this.do.delete(n2);
                        ++n;
                        "".length();
                        if (" ".length() == 0) {
                            return;
                        }
                    } else {
                        String[] stringArray = aq_0.do(this.do.getString(n2), ":");
                        if (he.int(((String)object2).equals("") ? 1 : 0)) {
                            object2 = (String)object2 + ",";
                        }
                        object2 = (String)object2 + stringArray[do[1]];
                    }
                    --n2;
                    "".length();
                    if (-" ".length() <= 0) continue;
                    return;
                }
                if (he.do(n)) {
                    if (he.int(((String)object2).equals("") ? 1 : 0)) {
                        dy_0.for((String)object2);
                        dy_0.new();
                        return;
                    }
                    dy_0.do.removeAllElements();
                    cs.if("delItemLists", "-1");
                }
                return;
            }
            if (he.do(object, this.new)) {
                int n = do[1];
                while (he.if(n, this.do.size())) {
                    this.do.setSelectedIndex(n, do[2]);
                    ++n;
                    "".length();
                    if (null == null) continue;
                    return;
                }
                return;
            }
        }
        if (he.do(bx.do, fs.do())) {
            fs.do().int();
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    private static boolean do(int n) {
        return n > 0;
    }

    private static boolean if(int n) {
        return n >= 0;
    }

    private static boolean for(int n) {
        return n != 0;
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    private static boolean int(int n) {
        return n == 0;
    }
}

