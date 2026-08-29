/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.io.ConnectionNotFoundException
 *  javax.microedition.lcdui.Display
 *  javax.microedition.lcdui.Displayable
 *  javax.microedition.midlet.MIDlet
 */
package main;

import java.util.Vector;
import javax.microedition.io.ConnectionNotFoundException;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.midlet.MIDlet;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public class AngelChip
extends MIDlet {
    public static AngelChip do;
    public static String do;
    public static int[][][] do;
    public static String if;
    public static Vector do;
    public static String[][][] do;
    private static final int[] do;
    public static String[][][] if;
    public static String for;
    public static bx do;
    public static int do;
    public static byte do;
    public static int if;
    public static bB do;
    public static eh do;

    private static boolean do(Object object) {
        return object != null;
    }

    public static void do() {
        try {
            do.destroyApp(do[1]);
            return;
        }
        catch (Exception exception) {
            "".length();
            return;
        }
    }

    public static void do(String string, String string2) {
        new Thread(new s(string2, string)).start();
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static void if() {
        do = new int[3];
        AngelChip.do[0] = (0x54 ^ 0x72) & ~(0x87 ^ 0xA1);
        AngelChip.do[1] = " ".length();
        AngelChip.do[2] = 0x13 ^ 9 ^ (0x3F ^ 0x2D);
    }

    protected void pauseApp() {
    }

    public AngelChip() {
        do = this;
        do = new bx();
        do.do();
        do = new eh();
        do = new bB();
        br_0.do();
        ax_0.do().try();
        do.sizeChanged(do[0], do[0]);
        do.for();
        Display.getDisplay((MIDlet)this).setCurrent((Displayable)do);
        ag_0.do().do(fj_0.do());
        String string = hi.do("avatar");
        if (!AngelChip.do((Object)string) || AngelChip.do(string.equals("2.5.8") ? 1 : 0)) {
            ac_0.do();
        }
    }

    public static void do(String string) {
        try {
            do.platformRequest(string);
            "".length();
            do.notifyDestroyed();
            return;
        }
        catch (ConnectionNotFoundException connectionNotFoundException) {
            "".length();
            return;
        }
    }

    public void destroyApp(boolean bl) {
        do.notifyDestroyed();
    }

    protected void startApp() {
        Display.getDisplay((MIDlet)this).setCurrent((Displayable)do);
    }

    static {
        AngelChip.if();
        if = do[2];
        do = (byte)do[0];
        for = "";
    }
}

