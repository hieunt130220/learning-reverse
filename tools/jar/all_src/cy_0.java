/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Command
 *  javax.microedition.lcdui.CommandListener
 *  javax.microedition.lcdui.Display
 *  javax.microedition.lcdui.Displayable
 *  javax.microedition.lcdui.Image
 *  javax.microedition.lcdui.List
 *  javax.microedition.midlet.MIDlet
 */
import java.io.IOException;
import java.util.Enumeration;
import javax.microedition.lcdui.Command;
import javax.microedition.lcdui.CommandListener;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.Image;
import javax.microedition.lcdui.List;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from cy
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class cy_0
implements dh_0,
CommandListener {
    private static final int[] do;
    private final List do;
    private final Command do;
    private final Command if;
    private Image do = new Command("Ch\u1ecdn", do[1], do[2]);

    public final void commandAction(Command object, Displayable displayable) {
        if (!cy_0.do(object, this.do) || cy_0.if(object, List.SELECT_COMMAND)) {
            object = this.do.getString(this.do.getSelectedIndex()).trim().toLowerCase();
            if (cy_0.do(object = (k)k.do.do(object))) {
                fo_0.do().if.do(object.if);
                fo_0.do().int.do(object.do);
                fo_0.do().if(do[5], do[2]);
            }
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    public cy_0() {
        this.if = new Command("\u0110\u00f3ng", do[3], do[2]);
        try {
            this.do = Image.createImage((String)(bT.if() + "/user_go.png"));
            return;
        }
        catch (IOException iOException) {
            "".length();
            this.do = null;
            return;
        }
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean if(int n) {
        return n < 0;
    }

    private static boolean for(int n) {
        return n == 0;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean do(Object object, Object object2) {
        return object != object2;
    }

    public final void do() {
        bx.int();
        k.do.do.removeAllElements();
        k.for();
        if (cy_0.for(k.do.do.isEmpty() ? 1 : 0)) {
            int n = do[2];
            int n2 = do[4];
            String string = fo_0.do().if.do().trim().toLowerCase();
            Enumeration enumeration = k.do.do();
            while (cy_0.do(enumeration.hasMoreElements() ? 1 : 0)) {
                String string2 = (String)enumeration.nextElement();
                k k2 = (k)k.do.do(string2);
                if (cy_0.do(k2)) {
                    this.do.append(k2.if, this.do);
                    "".length();
                    if (cy_0.do(n2, do[4]) && cy_0.do(string2.equals(string) ? 1 : 0)) {
                        n2 = n;
                    }
                    ++n;
                }
                "".length();
                if (null == null) continue;
                return;
            }
            if (cy_0.if(n2)) {
                n2 = do[2];
                "".length();
                if (((25 + 184 - 33 + 46 ^ 97 + 43 - 44 + 46) & (185 + 105 - 162 + 111 ^ 30 + 36 - -97 + 28 ^ -" ".length())) >= " ".length()) {
                    return;
                }
            } else if (cy_0.if(n2, this.do.size())) {
                n2 = this.do.size() - do[5];
            }
            this.do.addCommand(this.do);
            this.do.addCommand(this.if);
            this.do.setSelectedIndex(n2, do[5]);
            this.do.setCommandListener((CommandListener)this);
            Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)this.do);
            bx.case();
            return;
        }
        bx.if("Hi\u1ec7n ch\u01b0a c\u00f3 t\u00e0i kho\u1ea3n n\u00e0o \u0111\u01b0\u1ee3c l\u01b0u!");
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(Object object, Object object2) {
        return object == object2;
    }

    private static void if() {
        do = new int[6];
        cy_0.do[0] = "   ".length();
        cy_0.do[1] = 0xB5 ^ 0x84 ^ (0x30 ^ 5);
        cy_0.do[2] = "  ".length() & ~"  ".length();
        cy_0.do[3] = 74 + 78 - 127 + 124 ^ 134 + 127 - 165 + 50;
        cy_0.do[4] = -" ".length();
        cy_0.do[5] = " ".length();
    }

    static {
        cy_0.if();
    }
}

