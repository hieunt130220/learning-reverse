/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 */
import java.io.DataInputStream;
import java.util.Vector;
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from eC
 */
public final class ec_0
implements gb {
    private static int[] do;
    private char do;
    private static String[] do;
    private int do;
    private byte[] do;
    private char if;
    private String do;
    private Image do;

    /*
     * Enabled aggressive block sorting
     */
    public final String[] do(String object, int n) {
        object = this.do((String)object, n);
        n = ((Vector)object).size();
        String[] stringArray = new String[n];
        int n2 = do[1];
        "".length();
        while (!ec_0.int(n2, n)) {
            stringArray[n2] = (String)((Vector)object).elementAt(n2);
            ++n2;
        }
        return stringArray;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public ec_0(int n) {
        try {
            DataInputStream dataInputStream = new DataInputStream(hi.do(String.valueOf(bT.if()) + "/font/" + do[n]));
            this.do = dataInputStream.readUTF();
            this.do = new byte[this.do.length()];
            int n2 = do[1];
            "".length();
            if (" ".length() >= "  ".length()) {
                throw null;
            }
            while (true) {
                if (ec_0.int(n2, this.do.length)) {
                    this.do = dataInputStream.readByte();
                    f_0.do(bT.dp);
                    this.do = f_0.do(String.valueOf(n));
                    f_0.do();
                    return;
                }
                this.do[n2] = dataInputStream.readByte();
                ++n2;
            }
        }
        catch (Exception exception) {
            exception.printStackTrace();
            return;
        }
    }

    private static void do() {
        do = new int[13];
        ec_0.do[0] = 0x19 ^ 0x49 ^ (0xC0 ^ 0x98);
        ec_0.do[1] = (0xC6 ^ 0xA7) & ~(0xD8 ^ 0xB9);
        ec_0.do[2] = " ".length();
        ec_0.do[3] = "  ".length();
        ec_0.do[4] = "   ".length();
        ec_0.do[5] = 0xD2 ^ 0xC1 ^ (0xBD ^ 0xAA);
        ec_0.do[6] = 0x5F ^ 0x5A;
        ec_0.do[7] = 0x39 ^ 0x3F;
        ec_0.do[8] = 0xF ^ 0x56 ^ (0xED ^ 0xB3);
        ec_0.do[9] = 0xE0 ^ 0xC0;
        ec_0.do[10] = -" ".length();
        ec_0.do[11] = 0x8E ^ 0x9A;
        ec_0.do[12] = 0x3F ^ 0x35;
    }

    private static boolean do(int n, int n2) {
        return n <= n2;
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    /*
     * Enabled aggressive block sorting
     */
    public final Vector do(String string, int n) {
        Vector<String> vector = new Vector<String>();
        int n2 = string.length();
        if (ec_0.do(n2, do[2])) {
            Vector<String> vector2 = new Vector<String>();
            vector2.addElement(string);
            return vector2;
        }
        String string2 = "";
        int n3 = do[1];
        int n4 = do[1];
        "".length();
        while (true) {
            if (!ec_0.int(this.do(string2), n)) {
                string2 = String.valueOf(string2) + string.charAt(n4);
                if (ec_0.if(string.charAt(++n4), do[12])) {
                    if (!ec_0.int(n4, n2 - do[2])) continue;
                    n4 = n2 - do[2];
                    "".length();
                    if ("   ".length() <= 0) {
                        return null;
                    }
                }
            }
            if (ec_0.if(n4, n2 - do[2]) && ec_0.if(string.charAt(n4 + do[2]), do[9])) {
                int n5 = n4;
                while (ec_0.if(string.charAt(n4 + do[2]), do[12]) && (!ec_0.for(string.charAt(n4 + do[2]), do[9]) || ec_0.for(string.charAt(n4), do[9])) && ec_0.if(n4, n3)) {
                    --n4;
                    "".length();
                    if ("   ".length() > 0) continue;
                    return null;
                }
                if (ec_0.for(n4, n3)) {
                    n4 = n5;
                }
            }
            vector.addElement(string.substring(n3, n4 + do[2]));
            if (!ec_0.if(n4, n2 - do[2])) break;
            n3 = n4 + do[2];
            "".length();
            while (ec_0.if(n3, n2 - do[2]) && !ec_0.if(string.charAt(n3), do[9])) {
                ++n3;
            }
            if (!ec_0.if(n3, n2 - do[2])) break;
            n4 = n3;
            string2 = "";
            "".length();
        }
        return vector;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static boolean if(int n) {
        return n >= 0;
    }

    /*
     * Unable to fully structure code
     */
    public final String do(String var1_1, String var2_2, String var3_3) {
        var4_4 = new StringBuffer();
        var5_5 = var1_1.indexOf(var2_2);
        var6_6 = ec_0.do[1];
        var7_7 = var2_2.length();
        "".length();
        if (-" ".length() <= " ".length()) ** GOTO lbl15
        return null;
lbl-1000:
        // 1 sources

        {
            var4_4.append(var1_1.substring(var6_6, var5_5)).append(var3_3);
            "".length();
            var6_6 = var5_5 + var7_7;
            var5_5 = var1_1.indexOf(var2_2, var6_6);
lbl15:
            // 2 sources

            ** while (!ec_0.for((int)var5_5, (int)ec_0.do[10]))
        }
lbl16:
        // 1 sources

        var4_4.append(var1_1.substring(var6_6, var1_1.length()));
        "".length();
        return var4_4.toString();
    }

    private static boolean for(int n, int n2) {
        return n == n2;
    }

    /*
     * Unable to fully structure code
     */
    public final int do(String var1_1) {
        var2_2 = ec_0.do[1];
        var3_3 = ec_0.do[1];
        "".length();
        if (" ".length() > ((88 ^ 23) & ~(208 ^ 159))) ** GOTO lbl20
        return (138 ^ 188) & ~(130 ^ 180);
lbl-1000:
        // 1 sources

        {
            this.if = var1_1.charAt(var3_3);
            if (ec_0.for(this.if, ec_0.do[9])) {
                var2_2 += this.do[ec_0.do[1]] >> ec_0.do[2];
                "".length();
                if (-" ".length() != -" ".length()) {
                    return (175 ^ 182 ^ (11 ^ 50)) & (1 ^ 8 ^ (29 ^ 52) ^ -" ".length());
                }
            } else {
                var4_4 = this.do.indexOf(this.if);
                if (ec_0.for(var4_4, ec_0.do[10])) {
                    var4_4 = ec_0.do[1];
                }
                var2_2 += this.do[var4_4];
            }
            ++var3_3;
lbl20:
            // 2 sources

            ** while (!ec_0.int((int)var3_3, (int)var1_1.length()))
        }
lbl21:
        // 1 sources

        return var2_2;
    }

    static {
        ec_0.do();
        String[] stringArray = new String[do[0]];
        stringArray[ec_0.do[1]] = "normal";
        stringArray[ec_0.do[2]] = "border";
        stringArray[ec_0.do[3]] = "arial";
        stringArray[ec_0.do[4]] = "black";
        stringArray[ec_0.do[5]] = "number";
        stringArray[ec_0.do[6]] = "smallRed";
        stringArray[ec_0.do[7]] = "smallYellow";
        stringArray[ec_0.do[8]] = "big";
        do = stringArray;
    }

    /*
     * Enabled aggressive block sorting
     */
    public final void do(Graphics graphics, String string, int n, int n2, int n3) {
        int n4 = string.length();
        if (ec_0.do(n3)) {
            n3 = n;
            "".length();
            if ("  ".length() < -" ".length()) {
                return;
            }
        } else if (ec_0.for(n3, do[2])) {
            n3 = n - this.do(string);
            "".length();
            if (-" ".length() == (145 + 35 - 122 + 121 ^ 181 + 123 - 254 + 133)) {
                return;
            }
        } else {
            n3 = n - (this.do(string) >> do[2]);
        }
        int n5 = do[1];
        "".length();
        while (!ec_0.int(n5, n4)) {
            this.do = string.charAt(n5);
            if (ec_0.for(this.do, do[9])) {
                n3 += this.do[do[1]] >> do[2];
                "".length();
                if ("   ".length() < 0) {
                    return;
                }
            } else {
                n = this.do.indexOf(this.do);
                if (ec_0.for(n, do[10])) {
                    n = do[1];
                }
                if (ec_0.if(n)) {
                    graphics.drawRegion(this.do, do[1], n * this.do, this.do.getWidth(), this.do, do[1], n3, n2, do[11]);
                }
                n3 += this.do[n];
            }
            ++n5;
        }
    }

    public final int do() {
        return this.do;
    }

    private static boolean int(int n, int n2) {
        return n >= n2;
    }
}

