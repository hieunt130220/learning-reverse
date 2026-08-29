/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Alert
 *  javax.microedition.lcdui.AlertType
 *  javax.microedition.lcdui.Command
 *  javax.microedition.lcdui.CommandListener
 *  javax.microedition.lcdui.Display
 *  javax.microedition.lcdui.Displayable
 *  javax.microedition.lcdui.Form
 *  javax.microedition.lcdui.Item
 *  javax.microedition.lcdui.ItemStateListener
 *  javax.microedition.lcdui.StringItem
 *  javax.microedition.lcdui.TextField
 *  javax.microedition.midlet.MIDlet
 */
import javax.microedition.lcdui.Alert;
import javax.microedition.lcdui.AlertType;
import javax.microedition.lcdui.Command;
import javax.microedition.lcdui.CommandListener;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.Form;
import javax.microedition.lcdui.Item;
import javax.microedition.lcdui.ItemStateListener;
import javax.microedition.lcdui.StringItem;
import javax.microedition.lcdui.TextField;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class gI
extends Form
implements CommandListener,
ItemStateListener {
    private final TextField do;
    private static final int[] do;
    private final TextField if;
    private final StringItem do;
    private final Command do;
    private final TextField for = new TextField("Xu kh\u1edfi \u0111i\u1ec3m:", String.valueOf((int)dC.if), do[0], do[1]);

    private static boolean do(Object object, Object object2) {
        return object != object2;
    }

    private static int do(float f, float f2) {
        return f == f2 ? 0 : (f > f2 ? 1 : -1);
    }

    private static boolean do(int n) {
        return n < 0;
    }

    private static boolean if(int n) {
        return n >= 0;
    }

    private static boolean if(Object object, Object object2) {
        return object == object2;
    }

    private static boolean for(int n) {
        return n > 0;
    }

    private static boolean do(int n, int n2) {
        return n <= n2;
    }

    public final void commandAction(Command command, Displayable displayable) {
        if (gI.if(command, this.do)) {
            try {
                float f = Integer.parseInt(this.for.getString().trim());
                float f2 = Float.parseFloat(this.do.getString().trim());
                if (!gI.if(gI.for(f, 1000.0f)) || gI.for(gI.if(f, 3.0E7f))) {
                    Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)new Alert("L\u1ed7i", "Xu c\u01b0\u1ee3c ko h\u1ee3p l\u1ec7!", null, AlertType.ERROR));
                    return;
                }
                if (gI.do(gI.for(f2, 1.0f))) {
                    Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)new Alert("L\u1ed7i", "T\u1ef7 l\u1ec7 nh\u00e2n ko h\u1ee3p l\u1ec7!", null, AlertType.ERROR));
                    return;
                }
                dC.if = f;
                dC.do = f2;
                dC.new();
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

    public gI() {
        super("C\u00e0i \u0111\u1eb7t Auto TX");
        this.append((Item)this.for);
        "".length();
        this.do = new TextField("T\u1ef7 l\u1ec7 nh\u00e2n ti\u1ec1n c\u01b0\u1ee3c:", String.valueOf(dC.do), do[0], do[2]);
        this.append((Item)this.do);
        "".length();
        this.if = new TextField("Th\u1eed t\u00ednh s\u1ed1 l\u1ea7n thua li\u00ean ti\u1ebfp:", "10", do[1], do[1]);
        this.append((Item)this.if);
        "".length();
        this.do = new StringItem("KQ th\u1eed t\u00ednh to\u00e1n:", gI.do(dC.if, dC.do, do[0]));
        this.append((Item)this.do);
        "".length();
        this.do = new Command("Save", do[3], do[2]);
        this.addCommand(this.do);
        this.addCommand(new Command("Cancel", do[4], do[2]));
        this.setCommandListener(this);
        this.setItemStateListener(this);
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    static {
        gI.do();
    }

    private static int if(float f, float f2) {
        return f == f2 ? 0 : (f > f2 ? 1 : -1);
    }

    public final void itemStateChanged(Item item) {
        if (!gI.do(item, this.for) || !gI.do(item, this.do) || gI.if(item, this.if)) {
            try {
                float f = Integer.parseInt(this.for.getString().trim());
                float f2 = Float.parseFloat(this.do.getString().trim());
                int n = Integer.parseInt(this.if.getString().trim());
                if (gI.if(gI.do(f, 1000.0f)) && gI.if(gI.do(f2, 1.0f))) {
                    this.do.setText(gI.do(f, f2, n));
                }
                return;
            }
            catch (NumberFormatException numberFormatException) {
                "".length();
            }
        }
    }

    private static int for(float f, float f2) {
        return f == f2 ? 0 : (f < f2 ? -1 : 1);
    }

    private static void do() {
        do = new int[6];
        gI.do[0] = 0x3B ^ 0x31;
        gI.do[1] = "  ".length();
        gI.do[2] = (34 + 53 - 45 + 124 ^ 146 + 3 - 1 + 4) & (18 + 15 - 19 + 138 ^ 29 + 111 - 83 + 109 ^ -" ".length());
        gI.do[3] = 0x79 ^ 0x7D;
        gI.do[4] = 0x73 ^ 0x74;
        gI.do[5] = " ".length();
    }

    private static String do(float f, float f2, int n) {
        int n2;
        float f3 = f;
        int n3 = n2 = (int)f;
        if (gI.if(n, do[1])) {
            int n4 = do[1];
            while (gI.do(n4, n)) {
                n3 = (int)Math.ceil(f3 *= f2);
                n2 += n3;
                ++n4;
                "".length();
                if ("  ".length() >= 0) continue;
                return null;
            }
            "".length();
            if (null != null) {
                return null;
            }
        } else {
            n = do[5];
        }
        return "- Xu kh\u1edfi \u0111i\u1ec3m:  " + bx.do((int)f) + "\n- T\u1ef7 l\u1ec7 nh\u00e2n:   x" + f2 + "\n- L\u1ea7n \u0111\u1eb7t th\u1ee9 " + n + ":  " + bx.do(n3) + "\n- T\u1ed5ng xu c\u01b0\u1ee3c:  " + bx.do(n2) + "\n- N\u1ebfu \u0111\u01b0\u1ee3c \u0103n:  " + bx.do((int)((double)n3 + (double)n3 * 0.95));
    }
}

