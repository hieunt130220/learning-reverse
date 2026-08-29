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
public final class D
extends Form
implements CommandListener {
    private final boolean do;
    private final Command do;
    private static final int[] do;
    private final ChoiceGroup do;
    private final ChoiceGroup if;
    private final ChoiceGroup for;
    private final ChoiceGroup int;
    private final ChoiceGroup new;
    private final TextField do = gr.for;

    public final void commandAction(Command command, Displayable displayable) {
        block5: {
            if (!D.do(command, this.do)) break block5;
            gr.do = (byte)this.do.getSelectedIndex();
            gr.do = this.if.isSelected(do[2]);
            gr.for = this.int.isSelected(do[2]);
            gr.if = this.new.isSelected(do[2]);
            gr.int = this.new.isSelected(do[0]);
            try {
                gr.do = Integer.parseInt(this.do.getString().toString());
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
            }
            "".length();
            if ((0xA5 ^ 0xA1) < "   ".length()) {
                return;
            }
            if (D.do(this.do ? 1 : 0) && D.if(gr.for ? 1 : 0) && D.if(D.do(gr.do().do, 0L))) {
                gr.do().do = 0L;
            }
            int n = do[2];
            while (D.do(n, gr.do.length)) {
                gr.do[n] = this.for.isSelected(n);
                ++n;
                "".length();
                if (-" ".length() <= 0) continue;
                return;
            }
            gr.try();
            bx.if("\u0110\u00e3 l\u01b0u c\u00e0i \u0111\u1eb7t!");
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    static {
        D.if();
    }

    public final void do() {
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)this);
    }

    public D() {
        super("C\u00e0i \u0111\u1eb7t \u0111ua pet");
        int n;
        String[] stringArray = new String[do[1]];
        stringArray[D.do[2]] = "100";
        stringArray[D.do[0]] = "500";
        stringArray[D.do[3]] = "1000";
        stringArray[D.do[4]] = "2000";
        stringArray[D.do[5]] = "5000";
        stringArray[D.do[6]] = "10000";
        stringArray[D.do[7]] = "20000";
        stringArray[D.do[8]] = "30000";
        stringArray[D.do[9]] = "50000";
        this.do = new ChoiceGroup("Xu \u0111\u1eb7t c\u01b0\u1ee3c", do[0], stringArray, null);
        this.append((Item)this.do);
        "".length();
        String[] stringArray2 = new String[do[9]];
        stringArray2[D.do[2]] = "X2";
        stringArray2[D.do[0]] = "X3";
        stringArray2[D.do[3]] = "X4";
        stringArray2[D.do[4]] = "X5";
        stringArray2[D.do[5]] = "X6";
        stringArray2[D.do[6]] = "X7";
        stringArray2[D.do[7]] = "X8";
        stringArray2[D.do[8]] = "X9 tr\u1edf l\u00ean";
        this.for = new ChoiceGroup("Ch\u1ecdn c\u1eeda \u0111\u1eb7t", do[3], stringArray2, null);
        this.append((Item)this.for);
        "".length();
        String[] stringArray3 = new String[do[3]];
        stringArray3[D.do[2]] = "B\u1eadt";
        stringArray3[D.do[0]] = "T\u1eaft";
        this.if = new ChoiceGroup("T\u1ef1 v\u1ec1 ch\u0103m Farm", do[0], stringArray3, null);
        this.append((Item)this.if);
        "".length();
        this.do = new TextField("T.gian v\u1ec1 farm (ph\u00fat):", String.valueOf(gr.do), do[5], do[3]);
        this.append((Item)this.do);
        "".length();
        String[] stringArray4 = new String[do[0]];
        stringArray4[D.do[2]] = "Thu ho\u1ea1ch \u0111\u00fang gi\u1edd";
        this.int = new ChoiceGroup("Farm th\u00f4ng minh", do[3], stringArray4, null);
        this.append((Item)this.int);
        "".length();
        String[] stringArray5 = new String[do[3]];
        stringArray5[D.do[2]] = "B\u1ecf X2/X5 quay s\u1ed1";
        stringArray5[D.do[0]] = "B\u1ecf X2/X5 n\u00e2ng c\u1ea5p";
        this.new = new ChoiceGroup("B\u1ecf v\u1eadt ph\u1ea9m", do[3], stringArray5, null);
        this.append((Item)this.new);
        "".length();
        this.do = new Command("L\u01b0u", do[5], do[2]);
        this.addCommand(this.do);
        this.addCommand(new Command("H\u1ee7y", do[8], do[2]));
        this.setCommandListener(this);
        this.do.setSelectedIndex((int)gr.do, do[0]);
        if (D.if(gr.do ? 1 : 0)) {
            n = do[2];
            "".length();
            if (-" ".length() != -" ".length()) {
                throw null;
            }
        } else {
            n = do[0];
        }
        this.if.setSelectedIndex(n, do[0]);
        this.int.setSelectedIndex(do[2], gr.for);
        this.new.setSelectedIndex(do[2], gr.if);
        this.new.setSelectedIndex(do[0], gr.int);
        int n2 = do[2];
        while (D.do(n2, gr.do.length)) {
            this.for.setSelectedIndex(n2, gr.do[n2]);
            ++n2;
            "".length();
            if ((32 + 58 - -15 + 76 ^ 161 + 66 - 213 + 163) > 0) continue;
            throw null;
        }
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static void if() {
        do = new int[10];
        D.do[0] = " ".length();
        D.do[1] = 0xCF ^ 0xC6;
        D.do[2] = (0x53 ^ 0x67 ^ (0x25 ^ 0x4B)) & (43 + 21 - -22 + 72 ^ 88 + 21 - 39 + 126 ^ -" ".length());
        D.do[3] = "  ".length();
        D.do[4] = "   ".length();
        D.do[5] = 0x5F ^ 0x5B;
        D.do[6] = 0x71 ^ 0x74;
        D.do[7] = 0x50 ^ 0x56;
        D.do[8] = 0xD ^ 0xA;
        D.do[9] = 0x73 ^ 0x7B;
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }
}

