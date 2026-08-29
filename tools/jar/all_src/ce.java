/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Command
 *  javax.microedition.lcdui.CommandListener
 *  javax.microedition.lcdui.Display
 *  javax.microedition.lcdui.Displayable
 *  javax.microedition.lcdui.List
 *  javax.microedition.midlet.MIDlet
 */
import java.util.Vector;
import javax.microedition.lcdui.Command;
import javax.microedition.lcdui.CommandListener;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.List;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class ce
implements CommandListener {
    private final List do;
    private static final int[] do;
    private final Command do = new List("Ch\u1ecdn m\u1ed9t ho\u1eb7c nhi\u1ec1u Kirby", do[0]);

    private static void if() {
        do = new int[4];
        ce.do[0] = "  ".length();
        ce.do[1] = (0x89 ^ 0xBF ^ (0xFE ^ 0x93)) & (3 ^ 0x5A ^ "  ".length() ^ -" ".length());
        ce.do[2] = 0x6E ^ 0x2B ^ (0x4C ^ 0xD);
        ce.do[3] = 0x7B ^ 0x4A ^ (0x96 ^ 0xA0);
    }

    public final void commandAction(Command object, Displayable displayable) {
        if (ce.do(object, this.do)) {
            object = new Vector();
            int n = do[1];
            while (ce.do(n, this.do.size())) {
                if (ce.do(this.do.isSelected(n) ? 1 : 0)) {
                    ((Vector)object).addElement(new Integer(n));
                }
                ++n;
                "".length();
                if ((0xCC ^ 0xA3 ^ (0xAC ^ 0xC7)) > 0) continue;
                return;
            }
            if (ce.if(((Vector)object).isEmpty() ? 1 : 0)) {
                int[] nArray = new int[((Vector)object).size()];
                int n2 = do[1];
                while (ce.do(n2, nArray.length)) {
                    nArray[n2] = (Integer)((Vector)object).elementAt(n2);
                    ++n2;
                    "".length();
                    if (-" ".length() == -" ".length()) continue;
                    return;
                }
                bx_0.do(new an(nArray));
                "".length();
                if ((0x17 ^ 0x21 ^ (0xAB ^ 0x99)) == "   ".length()) {
                    return;
                }
            } else {
                bx.if("B\u1ea1n kh\u00f4ng ch\u1ecdn b\u1ea5t k\u1ef3 Kirby n\u00e0o!");
            }
        }
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    public ce() {
        int n = do[1];
        while (ce.do(n, an.do.size())) {
            gm_0 gm_02 = (gm_0)an.do.elementAt(n);
            this.do.append(gm_02.do, null);
            "".length();
            ++n;
            "".length();
            if (null == null) continue;
            throw null;
        }
        this.do = new Command("B\u1eaft \u0111\u1ea7u", do[2], do[1]);
        this.do.addCommand(this.do);
        this.do.addCommand(new Command("\u0110\u00f3ng", do[3], do[1]));
        this.do.setCommandListener((CommandListener)this);
    }

    private static boolean if(int n) {
        return n == 0;
    }

    public final void do() {
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)this.do);
    }

    static {
        ce.if();
    }
}

