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
 *  javax.microedition.lcdui.ItemStateListener
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
import javax.microedition.lcdui.ItemStateListener;
import javax.microedition.lcdui.TextField;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class cn
extends Form
implements CommandListener,
ItemStateListener {
    private final ChoiceGroup do;
    private final ChoiceGroup if;
    private static final int[] do;
    private final TextField do;
    private final TextField if;
    private final ChoiceGroup for;
    private final ChoiceGroup int;
    private final ChoiceGroup new;
    private final TextField for;
    private final TextField int;
    private final TextField new;
    private final Command do;
    private final TextField try;
    private final TextField byte;

    static {
        cn.do();
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static boolean do(int n, int n2) {
        return n > n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean if(int n) {
        return n >= 0;
    }

    public cn() {
        super("C\u00e0i \u0111\u1eb7t Auto Farm");
        String[] stringArray = new String[do[1]];
        stringArray[cn.do[2]] = "L\u00e1i bu\u00f4n h\u1ed7 tr\u1ee3";
        stringArray[cn.do[0]] = "Farm b\u00ecnh th\u01b0\u1eddng";
        this.int = new ChoiceGroup("C\u01a1 ch\u1ebf Auto", do[0], stringArray, null);
        this.append((Item)this.int);
        "".length();
        this.try = new TextField("M\u00f3n \u0103n d\u1ef1 b\u1ecb (id1,id2,..)", bt_0.if, do[3], do[2]);
        this.append((Item)this.try);
        "".length();
        this.new = new TextField("C\u00e2y tr\u1ed3ng d\u1ef1 b\u1ecb (id1,id2,..)", bt_0.for, do[3], do[2]);
        this.append((Item)this.new);
        "".length();
        this.if = new TextField("Thay th\u1ebf c\u00e2y khi \u0111\u1ea1t s\u1ed1 l\u01b0\u1ee3ng:", String.valueOf(bt_0.new), do[4], do[1]);
        this.append((Item)this.if);
        "".length();
        this.do = new TextField("B\u00e1n n\u00f4ng s\u1ea3n: -1 (all) or (id1,id2,...)", bt_0.do, do[3], do[2]);
        this.append((Item)this.do);
        "".length();
        this.for = new TextField("B\u00e1n n\u00f4ng s\u1ea3n khi \u0111\u1ea1t s\u1ed1 l\u01b0\u1ee3ng:", String.valueOf(bt_0.byte), do[4], do[1]);
        this.append((Item)this.for);
        "".length();
        this.int = new TextField("S\u1ed1 l\u01b0\u1ee3ng n\u00f4ng s\u1ea3n khi b\u00e1n:", String.valueOf(bt_0.case), do[4], do[1]);
        this.append((Item)this.int);
        "".length();
        String[] stringArray2 = new String[do[5]];
        stringArray2[cn.do[2]] = "B\u00e1o danh h\u00e0ng ng\u00e0y";
        stringArray2[cn.do[0]] = "N\u00e2ng c\u1ea5p c\u00e2y kh\u1ebf";
        stringArray2[cn.do[1]] = "Nhi\u1ec7m v\u1ee5 \u1ea5p r\u1ed3ng";
        stringArray2[cn.do[6]] = "Nhi\u1ec7m v\u1ee5 luy\u1ec7n r\u1ed3ng";
        stringArray2[cn.do[7]] = "Giao \u0111\u01a1n h\u00e0ng";
        stringArray2[cn.do[4]] = "Ko t\u1ef1 mua (h\u1ea1t gi\u1ed1ng/v\u1eadt nu\u00f4i) d\u00f9ng l\u01b0\u1ee3ng";
        this.do = new ChoiceGroup("T\u00f9y ch\u1ecdn", do[1], stringArray2, null);
        this.append((Item)this.do);
        "".length();
        this.byte = new TextField("N\u00e2ng c\u00e2y kh\u1ebf \u0111\u1ebfn c\u1ea5p:", String.valueOf(bt_0.try), do[1], do[1]);
        this.append((Item)this.byte);
        "".length();
        String[] stringArray3 = new String[do[7]];
        stringArray3[cn.do[2]] = "Thu ho\u1ea1ch tim";
        stringArray3[cn.do[0]] = "Cho em b\u00e9 \u0103n";
        stringArray3[cn.do[1]] = "Mua s\u1eefa l\u01b0\u1ee3ng khi ko \u0111\u1ee7 NS";
        stringArray3[cn.do[6]] = "N\u00e2ng c\u1ea5p em b\u00e9";
        this.new = new ChoiceGroup("Ch\u1ee9c n\u0103ng v\u1ee3 ch\u1ed3ng", do[1], stringArray3, null);
        this.append((Item)this.new);
        "".length();
        String[] stringArray4 = new String[do[6]];
        stringArray4[cn.do[2]] = "C\u00e1";
        stringArray4[cn.do[0]] = "R\u00f9a";
        stringArray4[cn.do[1]] = "Kh\u00f4ng";
        this.if = new ChoiceGroup("B\u1ed5 sung h\u1ed3 c\u00e1 n\u1ebfu ch\u01b0a full", do[0], stringArray4, null);
        this.append((Item)this.if);
        "".length();
        String[] stringArray5 = new String[do[7]];
        stringArray5[cn.do[2]] = "G\u00e0";
        stringArray5[cn.do[0]] = "V\u1ecbt";
        stringArray5[cn.do[1]] = "Heo";
        stringArray5[cn.do[6]] = "Kh\u00f4ng";
        this.for = new ChoiceGroup("B\u1ed5 sung v\u1eadt nu\u00f4i n\u1ebfu ch\u01b0a full", do[0], stringArray5, null);
        this.append((Item)this.for);
        "".length();
        this.do = new Command("Save", do[7], do[2]);
        this.addCommand(this.do);
        this.addCommand(new Command("Cancel", do[8], do[2]));
        this.setCommandListener(this);
        this.setItemStateListener(this);
        this.int.setSelectedIndex((int)bt_0.do, do[0]);
        this.if.setSelectedIndex((int)bt_0.if, do[0]);
        this.for.setSelectedIndex((int)bt_0.for, do[0]);
        this.do.setSelectedIndex(do[2], bt_0.this);
        this.do.setSelectedIndex(do[0], bt_0.else);
        this.do.setSelectedIndex(do[1], bt_0.char);
        this.do.setSelectedIndex(do[6], bt_0.long);
        this.do.setSelectedIndex(do[7], bt_0.goto);
        this.do.setSelectedIndex(do[4], bt_0.void);
        this.new.setSelectedIndex(do[2], bp_0.do);
        this.new.setSelectedIndex(do[0], bp_0.new);
        this.new.setSelectedIndex(do[1], bp_0.int);
        this.new.setSelectedIndex(do[6], bp_0.try);
    }

    private static void do() {
        do = new int[12];
        cn.do[0] = " ".length();
        cn.do[1] = "  ".length();
        cn.do[2] = (17 + 71 - 84 + 183 ^ 22 + 97 - 86 + 117) & (0x3E ^ 0x54 ^ (0x60 ^ 0x27) ^ -" ".length());
        cn.do[3] = -(0xFFFFD37B & 0x3F8D) & (0xFFFFFF0E & 0x17F9);
        cn.do[4] = 0x4D ^ 0x11 ^ (0x17 ^ 0x4E);
        cn.do[5] = 0x28 ^ 0x20 ^ (0x15 ^ 0x1B);
        cn.do[6] = "   ".length();
        cn.do[7] = 0x24 ^ 0x4E ^ (0x2C ^ 0x42);
        cn.do[8] = 87 + 150 - 151 + 101 ^ 155 + 155 - 279 + 157;
        cn.do[9] = -(0xFFFFB3E7 & 0x4EDB) & (0xFFFFF7FB & 0x7FF6);
        cn.do[10] = 0xFFFFFFAB & 0x7D54;
        cn.do[11] = 60 + 45 - 57 + 83 ^ 3 + 130 - 90 + 134;
    }

    public final void itemStateChanged(Item item) {
        if (cn.do(item, this.new)) {
            if (cn.do(this.new.isSelected(do[6]) ? 1 : 0) && cn.for(this.new.isSelected(do[0]) ? 1 : 0)) {
                this.new.setSelectedIndex(do[0], do[0]);
                return;
            }
            if (cn.for(this.new.isSelected(do[0]) ? 1 : 0) && cn.do(this.new.isSelected(do[1]) ? 1 : 0)) {
                this.new.setSelectedIndex(do[1], do[2]);
            }
        }
    }

    public final void commandAction(Command object, Displayable displayable) {
        block20: {
            block19: {
                block18: {
                    if (!cn.do(object, this.do)) break block20;
                    bt_0.do = (byte)this.int.getSelectedIndex();
                    bt_0.if = this.try.getString().trim();
                    try {
                        bt_0.new = Integer.parseInt(this.if.getString().trim());
                    }
                    catch (NumberFormatException numberFormatException) {
                        "".length();
                        bt_0.new = do[9];
                    }
                    "".length();
                    if ("   ".length() < 0) {
                        return;
                    }
                    bt_0.for = aq_0.if(this.new.getString().trim());
                    object = this.do.getString().trim();
                    if (cn.do(object.equals("-1") ? 1 : 0)) {
                        bt_0.do = object;
                        "".length();
                        if (-" ".length() != -" ".length()) {
                            return;
                        }
                    } else {
                        bt_0.do = aq_0.if((String)object);
                    }
                    try {
                        bt_0.byte = Integer.parseInt(this.for.getString().trim());
                        if (!cn.do(bt_0.byte, do[10])) break block18;
                        bt_0.byte = do[10];
                    }
                    catch (NumberFormatException numberFormatException) {
                        "".length();
                        bt_0.byte = do[10];
                    }
                }
                "".length();
                if (((0xC4 ^ 0xB8 ^ (0x44 ^ 0x67)) & ("   ".length() ^ (0x26 ^ 0x7A) ^ -" ".length())) == "   ".length()) {
                    return;
                }
                try {
                    bt_0.case = Integer.parseInt(this.int.getString().trim());
                }
                catch (NumberFormatException numberFormatException) {
                    "".length();
                    bt_0.case = do[2];
                }
                "".length();
                if ("   ".length() < 0) {
                    return;
                }
                bt_0.if = (byte)this.if.getSelectedIndex();
                bt_0.for = (byte)this.for.getSelectedIndex();
                bt_0.this = this.do.isSelected(do[2]);
                bt_0.else = this.do.isSelected(do[0]);
                bt_0.char = this.do.isSelected(do[1]);
                bt_0.long = this.do.isSelected(do[6]);
                bt_0.goto = this.do.isSelected(do[7]);
                bt_0.void = this.do.isSelected(do[4]);
                bp_0.do = this.new.isSelected(do[2]);
                bp_0.int = this.new.isSelected(do[1]);
                bp_0.try = this.new.isSelected(do[6]);
                if (cn.do(bp_0.try ? 1 : 0)) {
                    bp_0.new = do[0];
                    "".length();
                    if (((9 ^ 1) & ~(0x51 ^ 0x59)) < -" ".length()) {
                        return;
                    }
                } else {
                    bp_0.new = this.new.isSelected(do[0]);
                }
                try {
                    bt_0.try = Integer.parseInt(this.byte.getString().trim());
                    if (cn.if(bt_0.try) && !cn.do(bt_0.try, do[11])) break block19;
                    bt_0.try = do[11];
                }
                catch (NumberFormatException numberFormatException) {
                    "".length();
                    bt_0.try = do[11];
                }
            }
            "".length();
            if ((0xA8 ^ 0xAC) < 0) {
                return;
            }
            bt_0.this();
            bx.if("L\u01b0u c\u00e0i \u0111\u1eb7t th\u00e0nh c\u00f4ng");
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    private static boolean for(int n) {
        return n == 0;
    }
}

