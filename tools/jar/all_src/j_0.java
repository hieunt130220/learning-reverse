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
 *  javax.microedition.lcdui.ItemStateListener
 *  javax.microedition.lcdui.List
 *  javax.microedition.lcdui.TextField
 *  javax.microedition.midlet.MIDlet
 */
import java.util.Enumeration;
import javax.microedition.lcdui.Alert;
import javax.microedition.lcdui.AlertType;
import javax.microedition.lcdui.ChoiceGroup;
import javax.microedition.lcdui.Command;
import javax.microedition.lcdui.CommandListener;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.Form;
import javax.microedition.lcdui.Item;
import javax.microedition.lcdui.ItemStateListener;
import javax.microedition.lcdui.List;
import javax.microedition.lcdui.TextField;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from j
 */
public final class j_0
implements dh_0,
CommandListener,
ItemStateListener {
    private final ChoiceGroup do;
    private final TextField do;
    private final Command do;
    private final Command if;
    private final Command for;
    private final Command int;
    private List do;
    private k[] do;
    private static boolean do;
    private static final int[] do;
    private final Command new;
    private String do;
    private final Command try;
    private final Command byte;
    private int do;
    private final TextField if = new TextField("T\u00e0i kho\u1ea3n:", null, do[0], do[1]);
    private Form do = new TextField("M\u1eadt kh\u1ea9u:", null, do[0], do[2]);
    private final Command case;

    static k[] do(j_0 j_02) {
        return j_02.do;
    }

    public final void do() {
        bx.int();
        k.do.do.removeAllElements();
        k.for();
        if (j_0.for(k.do.do.isEmpty() ? 1 : 0)) {
            this.do = new List("Qu\u1ea3n l\u00fd t\u00e0i kho\u1ea3n", do[6]);
            this.do = new k[k.do.do.size()];
            int n = do[1];
            Enumeration enumeration = k.do.do();
            while (j_0.if(enumeration.hasMoreElements() ? 1 : 0)) {
                String string = (String)enumeration.nextElement();
                this.do[n] = (k)k.do.do(string);
                this.do.append(n + do[4] + ". " + this.do[n].if, null);
                "".length();
                if (j_0.for(this.do.equals("") ? 1 : 0)) {
                    if (j_0.if(this.do.equals(this.do[n].if) ? 1 : 0)) {
                        this.do = n;
                        this.do = "";
                        "".length();
                        if ((0xA5 ^ 0xA1) <= "   ".length()) {
                            return;
                        }
                    }
                } else if (j_0.do(this.do, do[7]) && j_0.if(string.equals(fo_0.do().if.do().trim().toLowerCase()) ? 1 : 0)) {
                    this.do = n;
                }
                ++n;
                "".length();
                if ("  ".length() != -" ".length()) continue;
                return;
            }
            this.do = "";
            if (j_0.int(this.do)) {
                this.do = do[1];
                "".length();
                if ("   ".length() == 0) {
                    return;
                }
            } else if (j_0.for(this.do, this.do.size())) {
                this.do = this.do.size() - do[4];
            }
            this.do.addCommand(this.case);
            this.do.addCommand(this.int);
            this.do.addCommand(this.new);
            this.do.addCommand(this.for);
            this.do.addCommand(this.byte);
            this.do.setSelectedIndex(this.do, do[4]);
            this.do.setCommandListener((CommandListener)this);
            j_0.do((Displayable)this.do);
            "".length();
            if (((0x26 ^ 0x74 ^ (0x8D ^ 0xC4)) & (3 + 111 - 96 + 139 ^ 66 + 58 - 26 + 36 ^ -" ".length())) > 0) {
                return;
            }
        } else {
            Form form = new Form("Th\u00eam t\u00e0i kho\u1ea3n");
            form.append("Danh s\u00e1ch tr\u1ed1ng!");
            "".length();
            form.addCommand(this.byte);
            form.addCommand(this.for);
            form.setCommandListener((CommandListener)this);
            j_0.do((Displayable)form);
        }
        bx.case();
    }

    private static boolean do(int n) {
        return n >= 0;
    }

    private static boolean if(int n) {
        return n != 0;
    }

    static {
        j_0.if();
        do = do[1];
    }

    static int do(j_0 j_02) {
        return j_02.do;
    }

    private static boolean for(int n) {
        return n == 0;
    }

    public j_0() {
        String[] stringArray = new String[do[4]];
        stringArray[j_0.do[1]] = "Hi\u1ec7n m\u1eadt kh\u1ea9u";
        this.do = new ChoiceGroup("", do[3], stringArray, null);
        this.case = new Command("\u0110\u0103ng nh\u1eadp", do[5], do[4]);
        this.byte = new Command("Tho\u00e1t", do[3], do[3]);
        this.new = new Command("X\u00f3a", do[4], do[3]);
        this.int = new Command("S\u1eeda", do[4], do[3]);
        this.for = new Command("Th\u00eam", do[4], do[3]);
        this.do = new Command("L\u01b0u", do[5], do[4]);
        this.try = new Command("H\u1ee7y", do[6], do[3]);
        this.if = new Command("\u0110\u1ed3ng \u00fd", do[5], do[4]);
        j_0 j_02 = this;
        this.do = new Form("");
        j_02.do.append((Item)j_02.if);
        "".length();
        j_02.do.append((Item)j_02.do);
        "".length();
        j_02.do.append((Item)j_02.do);
        "".length();
        j_02.do.addCommand(j_02.do);
        j_02.do.addCommand(j_02.try);
        if (j_0.if(do ? 1 : 0)) {
            j_02.do.setConstraints(do[1]);
            j_02.do.setSelectedIndex(do[1], do[4]);
        }
        j_02.do.setCommandListener((CommandListener)j_02);
        j_02.do.setItemStateListener((ItemStateListener)j_02);
        this.do = do[7];
        this.do = "";
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static boolean if(Object object, Object object2) {
        return object != object2;
    }

    private static boolean int(int n) {
        return n < 0;
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    static Command do(j_0 j_02) {
        return j_02.if;
    }

    private static void do(Displayable displayable) {
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent(displayable);
    }

    private static boolean for(int n, int n2) {
        return n >= n2;
    }

    static int do(j_0 j_02, int n) {
        j_02.do = n;
        return j_02.do;
    }

    public final void itemStateChanged(Item item) {
        if (j_0.do(item, this.do)) {
            if (j_0.if((do = this.do.isSelected(do[1])) ? 1 : 0)) {
                this.do.setConstraints(do[1]);
                this.do.setString(this.do.getString());
                return;
            }
            this.do.setConstraints(do[2]);
            this.do.setString(this.do.getString());
        }
    }

    public final void commandAction(Command object, Displayable object2) {
        if (j_0.do(object, this.byte)) {
            j_0.do((Displayable)AngelChip.do);
            return;
        }
        if (j_0.do(object, this.for)) {
            this.do = do[7];
            this.do.setTitle("Th\u00eam t\u00e0i kho\u1ea3n");
            this.if.setString("");
            this.do.setString("");
            j_0.do((Displayable)this.do);
            return;
        }
        if (j_0.do(object2, this.do)) {
            this.do = this.do.getSelectedIndex();
            if (!j_0.if(object, this.case) || j_0.do(object, List.SELECT_COMMAND)) {
                fo_0.do().if.do(this.do[this.do].if);
                fo_0.do().int.do(this.do[this.do].do);
                fo_0.do().if(do[4], do[1]);
                j_0.do((Displayable)AngelChip.do);
                return;
            }
            if (j_0.do(object, this.new)) {
                String string = "X\u00f3a acc n\u00e0y kh\u1ecfi danh s\u00e1ch \u0111\u00e3 l\u01b0u, d\u1eef li\u1ec7u up thu\u00ea c\u1ee7a acc n\u00e0y bao g\u1ed3m ng\u00e0y up, xu up \u0111\u01b0\u1ee3c,... c\u0169ng b\u1ecb x\u00f3a theo! B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a t\u00e0i kho\u1ea3n n\u00e0y?";
                object2 = "C\u1ea3nh b\u00e1o";
                object = this;
                object2 = new Alert((String)object2, string, null, AlertType.WARNING);
                object2.addCommand(((j_0)object).if);
                object2.addCommand(new Command("Kh\u00f4ng", do[4], do[3]));
                object2.setCommandListener((CommandListener)new bz_0((j_0)object));
                j_0.do((Displayable)object2);
                return;
            }
            if (j_0.do(object, this.int)) {
                this.do.setTitle("S\u1eeda t\u00e0i kho\u1ea3n");
                this.if.setString(this.do[this.do].if);
                this.do.setString(this.do[this.do].do);
                j_0.do((Displayable)this.do);
                return;
            }
            return;
        }
        if (j_0.do(object2, this.do)) {
            if (j_0.do(object, this.do)) {
                object = this.if.getString().trim();
                object2 = this.do.getString().trim();
                if (!j_0.for(((String)object).equals("") ? 1 : 0) || j_0.if(((String)object2).equals("") ? 1 : 0)) {
                    j_0.do((Displayable)new Alert("L\u1ed7i", "B\u1ea1n ch\u01b0a nh\u1eadp t\u00e0i kho\u1ea3n ho\u1eb7c m\u1eadt kh\u1ea9u!", null, AlertType.WARNING));
                    return;
                }
                this.do = object;
                String string = ((String)object).toLowerCase();
                if (j_0.do(this.do) && j_0.if(this.do, this.do.length)) {
                    String string2 = this.do[this.do].if.toLowerCase();
                    if (j_0.for(string2.equals(string) ? 1 : 0)) {
                        if (j_0.if(k.do.do(string) ? 1 : 0)) {
                            k.do.do(string, string, new k((String)object, (String)object2));
                            k.do.do(string2);
                            "".length();
                            if (((0x78 ^ 0x47 ^ (0xC9 ^ 0xAF)) & (215 + 133 - 254 + 148 ^ 80 + 8 - 78 + 161 ^ -" ".length())) != 0) {
                                return;
                            }
                        } else {
                            k.do.do(string2, string, new k((String)object, (String)object2));
                        }
                        cs.do("_" + string2 + "Coin");
                        cs.do("_" + string2 + "Data");
                        "".length();
                        if (((120 + 98 - 132 + 62 ^ 95 + 35 - 96 + 125) & (0xE9 ^ 0x84 ^ (0xC3 ^ 0xA5) ^ -" ".length())) != 0) {
                            return;
                        }
                    } else {
                        k.do.do(string2, string, new k((String)object, (String)object2));
                        "".length();
                        if (-(0x67 ^ 0x51 ^ (0x37 ^ 5)) >= 0) {
                            return;
                        }
                    }
                } else if (j_0.for(k.do.do(string) ? 1 : 0)) {
                    k.do.do(string, new k((String)object, (String)object2));
                    "".length();
                    if ("   ".length() > "   ".length()) {
                        return;
                    }
                } else {
                    k k2 = (k)k.do.do(string);
                    if (j_0.do(k2) && j_0.if(k2.do.equals(object2) ? 1 : 0)) {
                        j_0.do((Displayable)new Alert("L\u1ed7i", "T\u00e0i kho\u1ea3n \"" + (String)object + "\" \u0111\u00e3 t\u1ed3n t\u1ea1i!", null, AlertType.ERROR));
                        return;
                    }
                    k.do.do(string, string, new k((String)object, (String)object2));
                }
                k.do();
                "".length();
                k.if();
                this.do();
                return;
            }
            if (j_0.do(object, this.try)) {
                this.do();
                return;
            }
            return;
        }
        j_0.do((Displayable)AngelChip.do);
    }

    private static void if() {
        do = new int[8];
        j_0.do[0] = 0xAA ^ 0x8A;
        j_0.do[1] = (0xDC ^ 0x94) & ~(0xFB ^ 0xB3);
        j_0.do[2] = -(0xFFFFAEE8 & 0x7FDF) & (0xFFFFEFF7 & 0x13ECF);
        j_0.do[3] = "  ".length();
        j_0.do[4] = " ".length();
        j_0.do[5] = 0xD ^ 9 ^ (0xFE ^ 0xB6) & ~(0xD8 ^ 0x90);
        j_0.do[6] = "   ".length();
        j_0.do[7] = -" ".length();
    }

    private static boolean do(Object object) {
        return object != null;
    }
}

