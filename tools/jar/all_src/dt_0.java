/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Canvas
 *  javax.microedition.lcdui.Display
 *  javax.microedition.lcdui.Displayable
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.midlet.MIDlet
 */
import javax.microedition.lcdui.Canvas;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.Graphics;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from dt
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class dt_0
extends Canvas {
    public static dt_0 do;
    private static final int[] do;
    public static boolean do;

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public dt_0() {
        this.setFullScreenMode(do[0]);
    }

    private static boolean do(int n) {
        return n < 0;
    }

    public final void keyPressed(int n) {
        if (!dt_0.do(n, do[9]) || !dt_0.do(n, do[10]) || !dt_0.do(n, do[11]) || dt_0.if(n, do[12])) {
            do = do[3];
            Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
        }
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    protected final void pointerPressed(int n, int n2) {
        do = do[3];
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)AngelChip.do);
    }

    private static void do(Graphics graphics, String string, int n) {
        graphics.drawString(string, do[1], n, do[2]);
    }

    static {
        dt_0.if();
        do = new dt_0();
        do = do[3];
    }

    public static void do() {
        do = do[0];
        Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)do);
    }

    public final void paint(Graphics graphics) {
        String string;
        graphics.setColor(do[3]);
        graphics.fillRect(do[3], do[3], this.getWidth(), this.getHeight());
        graphics.setColor(do[4]);
        int n = do[1];
        if (dt_0.for(ge_0.if ? 1 : 0)) {
            dt_0.do(graphics, "Status: Auto Login", do[1]);
            n += 16;
            dt_0.do(graphics, "User: " + fo_0.do().if.do(), do[5]);
            "".length();
            if (-" ".length() == "   ".length()) {
                return;
            }
        } else if (dt_0.do(bx_0.do) && dt_0.if(bx_0.do.toString().length())) {
            dt_0.do(graphics, "Status: " + bx_0.do.toString(), do[1]);
            n += 16;
            dt_0.do(graphics, "ID: " + (String)AngelChip.do.do + " - LV: " + bx_0.do.do, do[5]);
            n += 16;
            dt_0.do(graphics, "TK: " + bx.do(AngelChip.do.do[do[3]]) + "xu - " + bx.do(AngelChip.do.do[do[6]]) + "L - " + bx.do(AngelChip.do.break) + "LK", do[7]);
        }
        dt_0.do(graphics, "Ng\u00e0y up: " + aq_0.do().if, n += 16);
        if (dt_0.if(dt_0.do(aq_0.do, 0L))) {
            dt_0.do(graphics, "Ng\u00e0y h\u1ebft h\u1ea1n: " + aq_0.do().for, n += 16);
        }
        if (dt_0.if(aq_0.if)) {
            dt_0.do(graphics, "Xu c\u1ea7n up: " + bx.do(aq_0.if), n += 16);
        }
        n += 16;
        StringBuffer stringBuffer = new StringBuffer().append("Xu up \u0111\u01b0\u1ee3c: ");
        if (dt_0.if(aq_0.for)) {
            string = bx.do(aq_0.for);
            "".length();
            if (null != null) {
                return;
            }
        } else if (dt_0.do(aq_0.for)) {
            string = "-" + bx.do(Math.abs(aq_0.for));
            "".length();
            if (-(0x9B ^ 0x9E) >= 0) {
                return;
            }
        } else {
            string = "0";
        }
        dt_0.do(graphics, stringBuffer.append(string).toString(), n);
        if (dt_0.do(AngelChip.do.for, do[8]) && dt_0.for(bp_0.do ? 1 : 0)) {
            String string2;
            n += 16;
            StringBuffer stringBuffer2 = new StringBuffer().append("Tim thu \u0111\u01b0\u1ee3c: ");
            if (dt_0.if(aq_0.int)) {
                string2 = bx.do(aq_0.int);
                "".length();
                if (-"   ".length() > 0) {
                    return;
                }
            } else {
                string2 = "0";
            }
            dt_0.do(graphics, stringBuffer2.append(string2).toString(), n);
        }
        if (dt_0.do(bx_0.do)) {
            n += 24;
            if (dt_0.for(bx_0.do instanceof d_0) && dt_0.if(dt_0.do(d_0.do, 0L))) {
                int n2 = (int)((d_0.if - d_0.do) / 1000L);
                StringBuffer stringBuffer3 = new StringBuffer().append("Th\u1eddi gian: ");
                fo_0.do();
                "".length();
                dt_0.do(graphics, stringBuffer3.append(fo_0.do(n2)).toString(), n);
                dt_0.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs_0.int, n += 16);
                return;
            }
            if (dt_0.for(bx_0.do instanceof ah)) {
                dt_0.do(graphics, "Tr\u1ea3 l\u1eddi win: " + bx_0.do.do(), n);
                dt_0.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs_0.int, n += 16);
                return;
            }
            if (dt_0.for(bx_0.do instanceof bs_0)) {
                if (dt_0.for(bs_0.do ? 1 : 0)) {
                    String string3;
                    int n3 = (int)((bs_0.do().do - System.currentTimeMillis()) / 1000L);
                    StringBuffer stringBuffer4 = new StringBuffer().append("Farming: ");
                    if (dt_0.if(n3)) {
                        fo_0.do();
                        "".length();
                        string3 = fo_0.do(n3);
                        "".length();
                        if ((0xA0 ^ 0xAD ^ (0x6E ^ 0x66)) == 0) {
                            return;
                        }
                    } else {
                        string3 = "xin ch\u1edd...";
                    }
                    dt_0.do(graphics, stringBuffer4.append(string3).toString(), n);
                    n += 20;
                }
                dt_0.do(graphics, "C\u00e1 c\u00e2u \u0111\u01b0\u1ee3c: " + bs_0.new, n);
                dt_0.do(graphics, "C\u00e1 m\u1eadp: " + bs_0.do, n += 16);
                if (dt_0.for(bs_0.int ? 1 : 0)) {
                    dt_0.do(graphics, "KCX: +" + bs_0.try, n += 16);
                    return;
                }
            } else if (dt_0.for(bx_0.do instanceof al)) {
                dt_0.do(graphics, "P: " + y_0.do + " - B: " + y_0.if + " | kcx: +" + al.if + " - nhb: +" + al.for, n);
                if (dt_0.for(al.try ? 1 : 0)) {
                    String string4;
                    n += 16;
                    int n4 = (int)((al.do().if - System.currentTimeMillis()) / 1000L);
                    StringBuffer stringBuffer5 = new StringBuffer().append("Farming: ");
                    if (dt_0.if(n4)) {
                        fo_0.do();
                        "".length();
                        string4 = fo_0.do(n4);
                        "".length();
                        if (-(6 + 116 - 31 + 86 ^ 38 + 117 - 61 + 87) > 0) {
                            return;
                        }
                    } else {
                        string4 = "xin ch\u1edd...";
                    }
                    dt_0.do(graphics, stringBuffer5.append(string4).toString(), n);
                    return;
                }
            } else {
                if (dt_0.for(bx_0.do instanceof dO)) {
                    dt_0.do(graphics, dO.do.if(), n);
                    dt_0.do(graphics, dO.do.for(), n += 16);
                    return;
                }
                if (dt_0.for(bx_0.do instanceof co)) {
                    dt_0.do(graphics, co.do.for(), n);
                    dt_0.do(graphics, co.do.if(), n += 16);
                    return;
                }
                if (dt_0.for(bx_0.do instanceof ez_0)) {
                    String string5;
                    int n5 = (int)((ez_0.do().do - System.currentTimeMillis()) / 1000L);
                    StringBuffer stringBuffer6 = new StringBuffer().append("Farming: ");
                    if (dt_0.if(n5)) {
                        fo_0.do();
                        "".length();
                        string5 = fo_0.do(n5);
                        "".length();
                        if ((0x4A ^ 0x4E) <= "   ".length()) {
                            return;
                        }
                    } else {
                        string5 = "xin ch\u1edd...";
                    }
                    dt_0.do(graphics, stringBuffer6.append(string5).toString(), n);
                    return;
                }
                if (dt_0.for(bx_0.do instanceof fy_0) && dt_0.if(dt_0.do(fy_0.do, 0L))) {
                    dt_0.do(graphics, "Ra t\u00f9 sau: " + fy_0.if(), n);
                    return;
                }
                if (dt_0.for(bx_0.do instanceof gt_0)) {
                    dt_0.do(graphics, gt_0.do().if(), n);
                    dt_0.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs_0.int, n += 16);
                    return;
                }
                if (dt_0.for(bx_0.do instanceof gj_0)) {
                    String string6;
                    StringBuffer stringBuffer7 = new StringBuffer().append("S\u1ed1 l\u1ea7n farm: ").append(gj_0.if).append(" / ");
                    if (dt_0.if(gj_0.do)) {
                        string6 = String.valueOf(gj_0.do);
                        "".length();
                        if (-" ".length() > 0) {
                            return;
                        }
                    } else {
                        string6 = "KGH";
                    }
                    dt_0.do(graphics, stringBuffer7.append(string6).toString(), n);
                    return;
                }
                if (dt_0.for(bx_0.do instanceof bO)) {
                    dt_0.do(graphics, "\u0110\u00e3 h\u00f4n: " + bO.do + " l\u1ea7n", n);
                    return;
                }
                if (dt_0.for(bx_0.do instanceof N)) {
                    dt_0.do(graphics, "\u0110\u00e3 \u0111\u00e1nh: " + N.do + " l\u1ea7n", n);
                    return;
                }
                if (dt_0.for(bx_0.do instanceof az_0)) {
                    String string7;
                    if (dt_0.for(bx.do instanceof dT)) {
                        dt_0.do(graphics, "Friend: " + dT.do().do, n);
                        n += 20;
                    }
                    StringBuffer stringBuffer8 = new StringBuffer().append("S\u1ed1 l\u1ea7n farm: ").append(az_0.do).append(" / ");
                    if (dt_0.if(az_0.int)) {
                        string7 = String.valueOf(az_0.int);
                        "".length();
                        if ((117 + 64 - 75 + 73 ^ 86 + 51 - -16 + 30) <= 0) {
                            return;
                        }
                    } else {
                        string7 = "KGH";
                    }
                    dt_0.do(graphics, stringBuffer8.append(string7).toString(), n);
                    dt_0.do(graphics, "C\u1ecf \u0111\u00e3 di\u1ec7t: " + az_0.for, n += 16);
                    dt_0.do(graphics, "S\u00e2u \u0111\u00e3 di\u1ec7t: " + az_0.if, n += 16);
                    return;
                }
                if (dt_0.for(bx_0.do instanceof P)) {
                    dt_0.do(graphics, "Khu hi\u1ec7n t\u1ea1i: " + gs_0.int, n);
                    if (dt_0.do(P.if, do[8]) && dt_0.do(P.int, do[8])) {
                        dt_0.do(graphics, "S\u1ed1 l\u01b0\u1ee3ng: " + P.if + "/" + P.int, n += 16);
                        return;
                    }
                } else if (dt_0.for(bx_0.do instanceof co_0)) {
                    dt_0.do(graphics, "S\u1ed1 l\u1ea7n HPHV: " + bx_0.do.do(), n);
                }
            }
        }
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean for(int n) {
        return n != 0;
    }

    private static void if() {
        do = new int[13];
        dt_0.do[0] = " ".length();
        dt_0.do[1] = 30 + 68 - -25 + 51 ^ 31 + 163 - 143 + 113;
        dt_0.do[2] = 0xB5 ^ 0xA1;
        dt_0.do[3] = (0x9E ^ 0xC2 ^ (0xC4 ^ 0xB6)) & (0x96 ^ 0x8D ^ (0xF2 ^ 0xC7) ^ -" ".length());
        dt_0.do[4] = -" ".length() & (0xFFFFFFFF & 0xFFFFFF);
        dt_0.do[5] = 0x6F ^ 0x17 ^ (0x19 ^ 0x7B);
        dt_0.do[6] = "  ".length();
        dt_0.do[7] = 0x9C ^ 0xB6;
        dt_0.do[8] = -" ".length();
        dt_0.do[9] = 0x7C ^ 0x20;
        dt_0.do[10] = 0xF8 ^ 0x84;
        dt_0.do[11] = 0x27 ^ 0x5A ^ (0xAA ^ 0xB7);
        dt_0.do[12] = 0x31 ^ 0x4F;
    }
}

