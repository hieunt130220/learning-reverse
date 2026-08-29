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
import javax.microedition.lcdui.ItemStateListener;
import javax.microedition.lcdui.TextField;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class cb
extends Form
implements CommandListener,
ItemStateListener {
    private final TextField do;
    private final ChoiceGroup do;
    private final ChoiceGroup if;
    private static final int[] do;
    private final Command do;
    private final TextField if;
    private final TextField for;
    private final ChoiceGroup for = new TextField("Ngo\u1ea1i tr\u1eeb:", bs_0.do, do[0], do[1]);
    private final ChoiceGroup int;
    private final ChoiceGroup new;

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static void do() {
        do = new int[9];
        cb.do[0] = 0xFFFFBDE7 & 0x4618;
        cb.do[1] = (0x59 ^ 0x4F) & ~(0x7D ^ 0x6B);
        cb.do[2] = 0x4E ^ 0x4A;
        cb.do[3] = "  ".length();
        cb.do[4] = "   ".length();
        cb.do[5] = " ".length();
        cb.do[6] = 0x53 ^ 0x54;
        cb.do[7] = 0xFFFFFF6B & 0xEAF4;
        cb.do[8] = -" ".length();
    }

    static {
        cb.do();
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    public cb() {
        super("C\u00e0i \u0111\u1eb7t Auto Fish");
        this.if = new TextField("T.gian v\u1ec1 farm (ph\u00fat):", String.valueOf(bs_0.case), do[2], do[3]);
        this.do = new TextField("B\u00e1n KCX khi \u0111\u1ea1t s\u1ed1 l\u01b0\u1ee3ng:", String.valueOf(bs_0.int), do[4], do[3]);
        String[] stringArray = new String[do[5]];
        stringArray[cb.do[1]] = "Thu ho\u1ea1ch \u0111\u00fang gi\u1edd";
        this.for = new ChoiceGroup("Farm th\u00f4ng minh", do[3], stringArray, null);
        String[] stringArray2 = new String[do[4]];
        stringArray2[cb.do[1]] = "C\u00e1 r\u00f4, ch\u00e9p v\u00e0ng, l\u00f2ng tong";
        stringArray2[cb.do[5]] = "C\u00e1 l\u00f3c, c\u00e1 n\u00f3c, cua";
        stringArray2[cb.do[3]] = "C\u00e1 m\u1eadp, chim, \u0111u\u1ed1i, ng\u1ef1a";
        this.do = new ChoiceGroup("Ch\u1ecdn map c\u00e2u c\u00e1", do[5], stringArray2, null);
        this.append((Item)this.do);
        "".length();
        String[] stringArray3 = new String[do[4]];
        stringArray3[cb.do[1]] = "T\u1ef1 mua v\u00e9 c\u00e2u";
        stringArray3[cb.do[5]] = "V\u1ec1 ch\u0103m farm";
        stringArray3[cb.do[3]] = "B\u00e1n kim c\u01b0\u01a1ng xanh";
        this.if = new ChoiceGroup("T\u00f9y ch\u1ecdn", do[3], stringArray3, null);
        this.append((Item)this.if);
        "".length();
        if (cb.do(bs_0.do ? 1 : 0)) {
            this.append((Item)this.if);
            "".length();
            this.append((Item)this.for);
            "".length();
        }
        if (cb.do(bs_0.int ? 1 : 0)) {
            this.append((Item)this.do);
            "".length();
        }
        String[] stringArray4 = new String[do[2]];
        stringArray4[cb.do[1]] = "Kh\u00f4ng t\u1ef1 mua";
        stringArray4[cb.do[5]] = "Mua c\u1ea7n VIP";
        stringArray4[cb.do[3]] = "Mua c\u1ea7n S\u1eaft";
        stringArray4[cb.do[4]] = "Mua c\u1ea7n Tre";
        this.int = new ChoiceGroup("T\u1ef1 mua c\u1ea7n c\u00e2u?", do[5], stringArray4, null);
        this.append((Item)this.int);
        "".length();
        String[] stringArray5 = new String[do[4]];
        stringArray5[cb.do[1]] = "B\u00e1n t\u1ea1i ch\u1ed7";
        stringArray5[cb.do[5]] = "B\u00e1n khu sinh th\u00e1i";
        stringArray5[cb.do[3]] = "B\u1ecf c\u00e1";
        this.new = new ChoiceGroup("C\u00e0i \u0111\u1eb7t b\u00e1n c\u00e1", do[5], stringArray5, null);
        this.append((Item)this.new);
        "".length();
        if (cb.do(bs_0.for, do[3])) {
            this.append((Item)this.for);
            "".length();
        }
        this.do = new Command("Save", do[2], do[1]);
        this.addCommand(this.do);
        this.addCommand(new Command("Cancel", do[6], do[1]));
        this.setCommandListener(this);
        this.setItemStateListener(this);
        this.do.setSelectedIndex((int)bs_0.do, do[5]);
        this.int.setSelectedIndex((int)bs_0.if, do[5]);
        this.new.setSelectedIndex((int)bs_0.for, do[5]);
        this.if.setSelectedIndex(do[1], bs_0.for);
        this.if.setSelectedIndex(do[5], bs_0.do);
        this.if.setSelectedIndex(do[3], bs_0.int);
        this.for.setSelectedIndex(do[1], bs_0.if);
    }

    public final void itemStateChanged(Item item) {
        if (cb.do(item, this.new)) {
            int n = this.do((Item)this.for);
            if (cb.do(this.new.isSelected(do[3]) ? 1 : 0)) {
                if (cb.do(n, do[8])) {
                    this.for.setString(bs_0.do);
                    this.insert(this.do((Item)this.new) + do[5], (Item)this.for);
                    return;
                }
            } else if (cb.for(n, do[8])) {
                this.delete(n);
            }
            return;
        }
        if (cb.do(item, this.if)) {
            int n = this.do((Item)this.if);
            int n2 = this.do((Item)this.if);
            int n3 = this.do((Item)this.for);
            if (cb.do(this.if.isSelected(do[5]) ? 1 : 0)) {
                if (cb.do(n2, do[8])) {
                    n2 = n + do[5];
                    this.if.setString(String.valueOf(bs_0.case));
                    this.insert(n2, (Item)this.if);
                }
                if (cb.do(n3, do[8])) {
                    n3 = n2 + do[5];
                    this.for.setSelectedIndex(do[1], bs_0.if);
                    this.insert(n3, (Item)this.for);
                    "".length();
                    if ("   ".length() >= (0x32 ^ 0x36)) {
                        return;
                    }
                }
            } else {
                if (cb.for(n3, do[8])) {
                    this.delete(n3);
                }
                if (cb.for(n2, do[8])) {
                    this.delete(n2);
                }
            }
            n2 = this.do((Item)this.do);
            if (cb.do(this.if.isSelected(do[3]) ? 1 : 0)) {
                if (cb.do(n2, do[8])) {
                    int n4;
                    n2 = this.do((Item)this.for);
                    this.do.setString(String.valueOf(bs_0.int));
                    if (cb.for(n2, do[8])) {
                        n4 = n2 + do[5];
                        "".length();
                        if ("   ".length() == (36 + 187 - 89 + 63 ^ 69 + 153 - 123 + 94)) {
                            return;
                        }
                    } else {
                        n4 = n + do[5];
                    }
                    this.insert(n4, (Item)this.do);
                    return;
                }
            } else if (cb.for(n2, do[8])) {
                this.delete(n2);
            }
        }
    }

    public final void commandAction(Command command, Displayable displayable) {
        if (cb.do(command, this.do)) {
            try {
                bs_0.do = (byte)this.do.getSelectedIndex();
                bs_0.if = (byte)this.int.getSelectedIndex();
                bs_0.for = (byte)this.new.getSelectedIndex();
                bs_0.do = this.for.getString().trim();
                bs_0.for = this.if.isSelected(do[1]);
                bs_0.do = this.if.isSelected(do[5]);
                bs_0.int = this.if.isSelected(do[3]);
                bs_0.case = Integer.parseInt(this.if.getString().trim());
                bs_0.int = Integer.parseInt(this.do.getString().trim());
                bs_0.if = this.for.isSelected(do[1]);
                bs_0.do().if = bs_0.case * do[7];
                bs_0.do().do = 0L;
                bs_0.byte();
                bx.if("L\u01b0u c\u00e0i \u0111\u1eb7t th\u00e0nh c\u00f4ng");
                "".length();
            }
            catch (Exception exception) {
                "".length();
                Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)new Alert("L\u1ed7i", "C\u00f3 l\u1ed7i x\u1ea3y ra. H\u00e3y xem l\u1ea1i c\u00e0i \u0111\u1eb7t!", null, AlertType.ERROR));
                return;
            }
            if ("  ".length() <= 0) {
                return;
            }
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    private int do(Item item) {
        int n = do[1];
        while (cb.if(n, this.size())) {
            if (cb.do(this.get(n), item)) {
                return n;
            }
            ++n;
            "".length();
            if (((0xB ^ 0x7E ^ (0x6A ^ 0x18)) & (0xD7 ^ 0xA9 ^ (8 ^ 0x71) ^ -" ".length())) >= 0) continue;
            return (53 + 116 - 87 + 45 ^ (8 ^ 0x2D)) & (0x3B ^ 0x4A ^ (0xB5 ^ 0x9E) ^ -" ".length());
        }
        return do[8];
    }
}

