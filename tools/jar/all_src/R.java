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
 *  javax.microedition.lcdui.TextField
 *  javax.microedition.midlet.MIDlet
 */
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
public final class R
implements dh_0,
CommandListener {
    final TextField do;
    private final TextField int;
    final TextField if;
    private static R do;
    final Form do;
    private final Command do;
    final Form if;
    private static final int[] do;
    private final TextField new;
    private final Command if = new Command("H\u1ee7y", do[0], do[1]);
    private final Command for;
    final TextField for;

    static {
        R.if();
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean do(Object object, Object object2) {
        return object == object2;
    }

    private static void if() {
        do = new int[9];
        R.do[0] = "   ".length();
        R.do[1] = "  ".length();
        R.do[2] = 0xFFFF8C20 & 0x77DF;
        R.do[3] = (0x21 ^ 0x28) & ~(0xA2 ^ 0xAB);
        R.do[4] = 0x9E ^ 0x9A;
        R.do[5] = " ".length();
        R.do[6] = (2 ^ 0x2A) & ~(0x49 ^ 0x61) ^ (6 ^ 3);
        R.do[7] = 0x78 ^ 0xC ^ (0x42 ^ 0xD);
        R.do[8] = 0x2C ^ 0;
    }

    public static R do() {
        if (R.do(do)) {
            do = new R();
        }
        return do;
    }

    public final void do() {
        if (R.if(ga_0.do ? 1 : 0)) {
            ga_0.do = do[3];
            ga_0.do();
            "".length();
            ga_0.if();
        }
        if (R.if(ga_0.do)) {
            this.new.setString(String.valueOf(ga_0.do));
            "".length();
            if ("  ".length() < -" ".length()) {
                return;
            }
        } else {
            this.new.setString("35");
        }
        this.int.setString(ga_0.do);
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)this.do);
    }

    private static boolean if(int n) {
        return n != 0;
    }

    public R() {
        this.do = new Form("C\u00e0i \u0111\u1eb7t Auto Click");
        this.int = new TextField("D\u1eef li\u1ec7u AutoClick:", "", do[2], do[3]);
        this.new = new TextField("Ph\u00edm b\u1eadt/t\u1eaft auto:", "35", do[4], do[3]);
        this.for = new Command("L\u01b0u", do[4], do[3]);
        this.do = new Command("L\u1ea5y m\u00e3 ph\u00edm", do[5], do[5]);
        this.do.append((Item)this.int);
        "".length();
        this.do.append((Item)this.new);
        "".length();
        this.do.append("- Nh\u1ea5n gi\u1eef ph\u00edm b\u1eadt/t\u1eaft auto s\u1ebd m\u1edf c\u00e0i \u0111\u1eb7t. Ph\u00edm b\u1eadt/t\u1eaft auto m\u1eb7c \u0111\u1ecbnh 35 l\u00e0 ph\u00edm #");
        "".length();
        this.do.append("- N\u1ebfu b\u1ea1n kh\u00f4ng bi\u1ebft c\u00e0i \u0111\u1eb7t th\u1ebf n\u00e0o h\u00e3y nh\u1ea5n v\u00e0o menu \"L\u1ea5y m\u00e3 ph\u00edm\" \u0111\u1ec3 \u0111\u1eb7t ph\u00edm. L\u1eb7p l\u1ea1i thao t\u00e1c \u0111\u1ec3 \u0111\u1eb7t ph\u00edm ti\u1ebfp theo!");
        "".length();
        this.do.addCommand(this.for);
        this.do.addCommand(this.do);
        this.do.addCommand(this.if);
        this.do.setCommandListener((CommandListener)this);
        this.if = new Form("\u0110\u1eb7t m\u00e3 ph\u00edm");
        this.do = new TextField("M\u00e3 ph\u00edm:", "", do[4], do[3]);
        this.for = new TextField("Nh\u1ea5n ph\u00edm n\u00e0y sau (s):", "0", do[4], do[1]);
        this.if = new TextField("Nh\u1ea5n gi\u1eef trong (ms):", "0", do[6], do[1]);
        this.if.append((Item)this.do);
        "".length();
        this.if.append((Item)this.for);
        "".length();
        this.if.append((Item)this.if);
        "".length();
        this.if.append("- C\u00e0i \u0111\u1eb7t nh\u1ea5n gi\u1eef gi\u00fap \u0111i\u1ec1u khi\u1ec3n nh\u00e2n v\u1eadt di chuy\u1ec3n. Th\u1eddi gian t\u00ednh b\u1eb1ng ms (1s = 1000ms)");
        "".length();
        this.if.addCommand(this.for);
        this.if.addCommand(this.if);
        this.if.setCommandListener((CommandListener)this);
    }

    public final void commandAction(Command object, Displayable object2) {
        block22: {
            block23: {
                String string;
                if (R.do(object2, this.if)) {
                    if (R.do(object, this.for)) {
                        object = this.do.getString().trim();
                        object2 = this.for.getString().trim();
                        String string2 = this.if.getString().trim();
                        String string3 = this.int.getString().trim();
                        if (R.do(((String)object).equals("") ? 1 : 0)) {
                            String string4;
                            Object object3;
                            StringBuffer stringBuffer = new StringBuffer().append((String)object).append(":");
                            if (R.do(((String)object2).equals("") ? 1 : 0)) {
                                object3 = object2;
                                "".length();
                                if (-" ".length() >= 0) {
                                    return;
                                }
                            } else {
                                object3 = "0";
                            }
                            StringBuffer stringBuffer2 = stringBuffer.append((String)object3).append(":");
                            if (R.do(string2.equals("") ? 1 : 0)) {
                                string4 = string2;
                                "".length();
                                if ((1 ^ 0xD ^ (0x4C ^ 0x44)) == -" ".length()) {
                                    return;
                                }
                            } else {
                                string4 = "0";
                            }
                            object = stringBuffer2.append(string4).toString();
                            if (R.if(string3.equals("") ? 1 : 0)) {
                                this.int.setString((String)object);
                                "".length();
                                if ((0x74 ^ 0x71) <= 0) {
                                    return;
                                }
                            } else {
                                String string5;
                                StringBuffer stringBuffer3 = new StringBuffer().append(string3);
                                if (R.do(string3.endsWith(",") ? 1 : 0)) {
                                    string5 = ",";
                                    "".length();
                                    if ((" ".length() & (" ".length() ^ -" ".length())) != ((82 + 11 - -128 + 11 ^ 141 + 2 - -11 + 14) & (27 + 197 - 128 + 142 ^ 5 + 136 - 108 + 141 ^ -" ".length()))) {
                                        return;
                                    }
                                } else {
                                    string5 = "";
                                }
                                this.int.setString(stringBuffer3.append(string5).append((String)object).toString());
                            }
                        }
                    }
                    Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)this.do);
                    return;
                }
                if (!R.do(object2, this.do)) break block22;
                if (R.do(object, this.do)) {
                    Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)new bo_0(this));
                    return;
                }
                if (!R.do(object, this.for)) break block23;
                try {
                    ga_0.do = Integer.parseInt(this.new.getString().trim());
                }
                catch (NumberFormatException numberFormatException) {
                    "".length();
                    ga_0.do = do[3];
                }
                "".length();
                if ("  ".length() == 0) {
                    return;
                }
                if (R.do(((String)(object = this.int.getString().trim())).equals("") ? 1 : 0)) {
                    string = ((String)object).replace(do[7], do[8]);
                    "".length();
                    if (" ".length() > (7 ^ 3)) {
                        return;
                    }
                } else {
                    string = "";
                }
                ga_0.do = string;
                ga_0.for();
                bx.if("\u0110\u00e3 l\u01b0u c\u00e0i \u0111\u1eb7t!");
            }
            Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
        }
    }

    private static boolean do(Object object) {
        return object == null;
    }
}

