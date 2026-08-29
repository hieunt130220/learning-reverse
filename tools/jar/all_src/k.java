/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.io.Connector
 *  javax.microedition.io.file.FileConnection
 *  javax.microedition.io.file.FileSystemRegistry
 *  javax.microedition.lcdui.Display
 *  javax.microedition.lcdui.Displayable
 *  javax.microedition.midlet.MIDlet
 */
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.util.Enumeration;
import java.util.Vector;
import javax.microedition.io.Connector;
import javax.microedition.io.file.FileConnection;
import javax.microedition.io.file.FileSystemRegistry;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class k
implements dh_0 {
    public String do;
    private static k do;
    private static final int[] do;
    private byte do;
    public String if;
    public static hd do;

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private String if() {
        InputStream inputStream = null;
        StringBuffer stringBuffer = new StringBuffer();
        try {
            int n;
            inputStream = this.getClass().getResourceAsStream("/acc.txt");
            while (k.do(n = inputStream.read(), do[4])) {
                stringBuffer.append((char)n);
                "".length();
                "".length();
                if (((0x26 ^ 0x33) & ~(0x78 ^ 0x6D)) >= -" ".length()) continue;
                return null;
            }
        }
        catch (Exception exception) {
            "".length();
            if (!k.do(inputStream)) return stringBuffer.toString();
            try {
                inputStream.close();
                "".length();
            }
            catch (IOException iOException) {
                "".length();
                "".length();
                return stringBuffer.toString();
            }
            if ("  ".length() > 0) return stringBuffer.toString();
            return null;
        }
        catch (Throwable throwable) {
            if (!k.do(inputStream)) throw throwable;
            try {
                inputStream.close();
                "".length();
            }
            catch (IOException iOException) {
                "".length();
                throw throwable;
            }
            if ((0x8F ^ 0x8B) > "   ".length()) throw throwable;
            return null;
        }
        if (!k.do(inputStream)) return stringBuffer.toString();
        try {
            inputStream.close();
            "".length();
            return stringBuffer.toString();
        }
        catch (IOException iOException) {
            "".length();
            "".length();
            if ("   ".length() > "  ".length()) return stringBuffer.toString();
            return null;
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static String do(String string) {
        InputStream inputStream = null;
        FileConnection fileConnection = null;
        String string2 = null;
        try {
            fileConnection = (FileConnection)Connector.open((String)string, (int)do[1]);
            if (k.for(fileConnection.exists() ? 1 : 0)) {
                int n = (int)fileConnection.fileSize();
                inputStream = fileConnection.openInputStream();
                byte[] byArray = new byte[n];
                n = inputStream.read(byArray, do[0], n);
                string2 = new String(byArray, do[0], n);
            }
        }
        catch (IOException iOException) {
            "".length();
            try {
                if (k.do(inputStream)) {
                    inputStream.close();
                }
                if (k.do(fileConnection)) {
                    fileConnection.close();
                }
                "".length();
                return string2;
            }
            catch (IOException iOException2) {
                "".length();
                "".length();
                if ("   ".length() > -" ".length()) return string2;
                return null;
            }
        }
        catch (Throwable throwable) {
            try {
                if (k.do(inputStream)) {
                    inputStream.close();
                }
                if (k.do(fileConnection)) {
                    fileConnection.close();
                }
                "".length();
            }
            catch (IOException iOException) {
                "".length();
                throw throwable;
            }
            if ("  ".length() > 0) throw throwable;
            return null;
        }
        try {
            if (k.do(inputStream)) {
                inputStream.close();
            }
            if (k.do(fileConnection)) {
                fileConnection.close();
            }
            "".length();
        }
        catch (IOException iOException) {
            "".length();
            "".length();
            if ("  ".length() > 0) return string2;
            return null;
        }
        if ("   ".length() > -" ".length()) return string2;
        return null;
    }

    private static boolean do(int n) {
        return n > 0;
    }

    private static boolean if(int n) {
        return n == 0;
    }

    /*
     * Loose catch block
     */
    public static void do(String string) {
        bx.int();
        k.do.do.removeAllElements();
        k.for();
        FileConnection fileConnection = null;
        DataOutputStream dataOutputStream = null;
        fileConnection = (FileConnection)Connector.open((String)string);
        if (k.if(fileConnection.exists() ? 1 : 0)) {
            fileConnection.create();
        }
        dataOutputStream = fileConnection.openDataOutputStream();
        try {
            ((OutputStream)dataOutputStream).write(k.for().getBytes("UTF-8"));
            "".length();
        }
        catch (UnsupportedEncodingException unsupportedEncodingException) {
            "".length();
            ((OutputStream)dataOutputStream).write(k.for().getBytes());
        }
        if (" ".length() <= 0) {
            return;
        }
        ((OutputStream)dataOutputStream).flush();
        bx.if("Xu\u1ea5t d\u1eef li\u1ec7u th\u00e0nh c\u00f4ng! File \u0111\u01b0\u1ee3c l\u01b0u t\u1ea1i: " + string);
        try {
            if (k.do(fileConnection)) {
                fileConnection.close();
            }
            if (k.do(dataOutputStream)) {
                ((OutputStream)dataOutputStream).close();
            }
            return;
        }
        catch (IOException iOException) {
            "".length();
            return;
        }
        catch (IOException iOException) {
            try {
                "".length();
                bx.if("L\u1ed7i xu\u1ea5t file! \u0110\u01b0\u1eddng d\u1eabn l\u01b0u file kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c thi\u1ebft b\u1ecb c\u1ee7a b\u1ea1n kh\u00f4ng h\u1ed7 tr\u1ee3.");
            }
            catch (Throwable throwable) {
                try {
                    if (k.do(fileConnection)) {
                        fileConnection.close();
                    }
                    if (k.do(dataOutputStream)) {
                        ((OutputStream)dataOutputStream).close();
                    }
                    "".length();
                }
                catch (IOException iOException2) {
                    "".length();
                }
                if ((0x19 ^ 0x7C ^ (0x48 ^ 0x29)) < " ".length()) {
                    return;
                }
                throw throwable;
            }
            try {
                if (k.do(fileConnection)) {
                    fileConnection.close();
                }
                if (k.do(dataOutputStream)) {
                    ((OutputStream)dataOutputStream).close();
                }
                return;
            }
            catch (IOException iOException3) {
                "".length();
                return;
            }
        }
    }

    public static String do() {
        String string;
        String string2 = "file:///c/";
        Enumeration enumeration = FileSystemRegistry.listRoots();
        while (k.for(enumeration.hasMoreElements() ? 1 : 0)) {
            string = (String)enumeration.nextElement();
            if (k.int(string.charAt(string.length() - do[1]), do[10])) {
                string2 = "file:///" + string;
                "".length();
                if ((52 + 35 - 50 + 94 ^ 34 + 9 - -33 + 59) >= "   ".length()) break;
                return null;
            }
            "".length();
            if (null == null) continue;
            return null;
        }
        try {
            string = (FileConnection)Connector.open((String)(string2 + "AngelChip/"));
            if (k.if(string.exists() ? 1 : 0)) {
                string.mkdir();
            }
            string.close();
            "".length();
        }
        catch (IOException iOException) {
            "".length();
            return string2 + "acc.txt";
        }
        if (-(0x8C ^ 0x88) > 0) {
            return null;
        }
        return string2 + "AngelChip/acc.txt";
    }

    public static k do() {
        if (k.if(do)) {
            do = new k();
        }
        return do;
    }

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    public k(String string, String string2) {
        this.do = (byte)do[0];
        this.if = string;
        this.do = string2;
    }

    static {
        k.int();
        do = new hd();
        k.for();
    }

    private static String for() {
        String string = "";
        if (k.if(k.do.do.isEmpty() ? 1 : 0)) {
            Enumeration enumeration = do.do();
            int n = do[0];
            while (k.for(enumeration.hasMoreElements() ? 1 : 0)) {
                Object object = (String)enumeration.nextElement();
                object = (k)do.do(object);
                if (k.do(n)) {
                    string = string + "\r\n";
                }
                string = string + ((k)object).if + ":" + ((k)object).do;
                ++n;
                "".length();
                if (((0xA4 ^ 0x98 ^ (0x5A ^ 0x22)) & (76 + 21 - -86 + 17 ^ 110 + 107 - 199 + 122 ^ -" ".length())) == 0) continue;
                return null;
            }
        }
        return string;
    }

    public static void do(String string, String string2) {
        String string3 = string.toLowerCase();
        if (k.for(do.do(string3) ? 1 : 0)) {
            do.do(string3);
        }
        do.do(string3, new k(string, string2));
        k.if();
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean if(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(Object object) {
        return object == null;
    }

    public k() {
    }

    private static void int() {
        do = new int[11];
        k.do[0] = (188 + 172 - 311 + 169 ^ 137 + 19 - 137 + 136) & (0x52 ^ 0x64 ^ (0x5B ^ 0x2C) ^ -" ".length());
        k.do[1] = " ".length();
        k.do[2] = 0x14 ^ 0x19;
        k.do[3] = 0x52 ^ 0x28 ^ (0xCA ^ 0x9D);
        k.do[4] = -" ".length();
        k.do[5] = 0xD0 ^ 0xAC;
        k.do[6] = "  ".length();
        k.do[7] = 0xCE ^ 0x9C ^ (0x17 ^ 0x43);
        k.do[8] = 136 + 182 - 138 + 16 ^ 185 + 157 - 196 + 46;
        k.do[9] = 57 + 169 - 79 + 44 ^ 94 + 93 - 142 + 138;
        k.do[10] = 9 ^ 0x26;
    }

    public final void do() {
        switch (this.do) {
            case -1: {
                fo_0.do();
                "".length();
                fo_0.if();
                return;
            }
            case 0: {
                if (k.do((Object)this.if) && k.if(this.if.equals("") ? 1 : 0)) {
                    fo_0.do().if.do(this.if);
                }
                if (k.do((Object)this.do) && k.if(this.do.equals("") ? 1 : 0)) {
                    fo_0.do().int.do(this.do);
                }
                fo_0.do().if(do[1], do[0]);
                return;
            }
            case 1: {
                aq_0.do("Nh\u1eadp d\u1eef li\u1ec7u", "M\u1edf file game n\u00e0y b\u1eb1ng WinRAR, k\u00e9o th\u1ea3 file acc.txt v\u00e0o. Sau \u0111\u00f3 quay l\u1ea1i \u0111\u00e2y b\u1ea5m n\u00fat b\u00ean d\u01b0\u1edbi!", new k(do[6]));
                return;
            }
            case 2: {
                Object object = this;
                bx.int();
                k.do.do.removeAllElements();
                k.for();
                object = ((k)object).if();
                if (k.do(object) && k.if(((String)object).equals("") ? 1 : 0)) {
                    k.if((String)object);
                    k.if();
                    bx.if("Nh\u1eadp d\u1eef li\u1ec7u th\u00e0nh c\u00f4ng! C\u1ea3nh b\u00e1o: h\u00e3y tho\u00e1t game v\u00e0 m\u1edf file game n\u00e0y b\u1eb1ng WinRAR x\u00f3a file acc.txt \u0111i \u0111\u1ec3 tr\u00e1nh l\u1ed9 TK");
                    return;
                }
                bx.if("Nh\u1eadp d\u1eef li\u1ec7u th\u1ea5t b\u1ea1i! File acc.txt tr\u1ed1ng r\u1ed7ng.");
                return;
            }
            case 3: {
                ci ci2 = new ci();
                Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)ci2);
                return;
            }
            case 4: {
                bf_0 bf_02 = new bf_0();
                Display.getDisplay((MIDlet)AngelChip.do).setCurrent((Displayable)bf_02);
                return;
            }
            case 5: {
                if (k.if(k.do.do.isEmpty() ? 1 : 0)) {
                    aq_0.if("C\u1ea3nh b\u00e1o! Thao t\u00e1c n\u00e0y s\u1ebd X\u00f3a H\u1ebft danh s\u00e1ch t\u00e0i kho\u1ea3n \u0111\u00e3 l\u01b0u v\u00e0 d\u1eef li\u1ec7u up thu\u00ea c\u1ee7a nh\u1eefng acc n\u00e0y bao g\u1ed3m ng\u00e0y up, xu up \u0111\u01b0\u1ee3c,... D\u1eef li\u1ec7u \u0111\u00e3 x\u00f3a s\u1ebd kh\u00f4ng th\u1ec3 kh\u00f4i ph\u1ee5c. B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a kh\u00f4ng?", new fn_0("\u0110\u1ed3ng \u00fd", new k(do[7])), new fn_0("Kh\u00f4ng", new k(do[4])));
                    return;
                }
                bx.if("Hi\u1ec7n ch\u01b0a c\u00f3 t\u00e0i kho\u1ea3n n\u00e0o \u0111\u01b0\u1ee3c l\u01b0u");
                return;
            }
            case 6: {
                bx.int();
                k.do.do.removeAllElements();
                k.for();
                Vector vector = cs.do();
                if (k.if(vector.isEmpty() ? 1 : 0)) {
                    int n = do[0];
                    while (k.for(n, vector.size())) {
                        String string = (String)vector.elementAt(n);
                        String string2 = string.substring(do[0], string.length() - do[8]);
                        if (k.if(k.do.do.isEmpty() ? 1 : 0) && k.for(do.do(string2.toLowerCase()) ? 1 : 0)) {
                            cs.do("_" + string);
                        }
                        ++n;
                        "".length();
                        if (-(0x64 ^ 0 ^ (0x30 ^ 0x51)) < 0) continue;
                        return;
                    }
                }
                if (k.if(k.do.do.isEmpty() ? 1 : 0)) {
                    k.do.do.removeAllElements();
                }
                cs.do("_avlogin");
                bx.if("\u0110\u00e3 x\u00f3a h\u1ebft danh s\u00e1ch t\u00e0i kho\u1ea3n!");
                return;
            }
            case 7: {
                aq_0.if("C\u1ea3nh b\u00e1o! Thao t\u00e1c n\u00e0y s\u1ebd x\u00f3a d\u1eef li\u1ec7u up thu\u00ea c\u1ee7a nh\u1eefng acc Kh\u00f4ng N\u1eb1m Trong danh s\u00e1ch t\u00e0i kho\u1ea3n \u0111\u00e3 l\u01b0u bao g\u1ed3m ng\u00e0y up, xu up \u0111\u01b0\u1ee3c,... D\u1eef li\u1ec7u \u0111\u00e3 x\u00f3a s\u1ebd kh\u00f4ng th\u1ec3 kh\u00f4i ph\u1ee5c. B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a kh\u00f4ng?", new fn_0("\u0110\u1ed3ng \u00fd", new k(do[9])), new fn_0("Kh\u00f4ng", new k(do[4])));
                return;
            }
            case 8: {
                bx.int();
                k.do.do.removeAllElements();
                k.for();
                Vector vector = cs.do();
                int n = do[0];
                if (k.if(vector.isEmpty() ? 1 : 0)) {
                    int n2 = do[0];
                    while (k.for(n2, vector.size())) {
                        String string = (String)vector.elementAt(n2);
                        String string3 = string.substring(do[0], string.length() - do[8]);
                        if (!k.if(k.do.do.isEmpty() ? 1 : 0) || k.if(do.do(string3.toLowerCase()) ? 1 : 0)) {
                            cs.do("_" + string);
                            if (k.for(string.endsWith("Data") ? 1 : 0)) {
                                ++n;
                            }
                        }
                        ++n2;
                        "".length();
                        if (-(96 + 73 - 38 + 24 ^ 106 + 9 - -43 + 1) < 0) continue;
                        return;
                    }
                }
                bx.if("\u0110\u00e3 x\u00f3a d\u1eef li\u1ec7u up thu\u00ea c\u1ee7a " + n + " acc kh\u00f4ng n\u1eb1m trong danh s\u00e1ch t\u00e0i kho\u1ea3n \u0111\u00e3 l\u01b0u!");
            }
        }
    }

    private static boolean for(int n, int n2) {
        return n < n2;
    }

    public static void if() {
        cs.for("_avlogin", k.for());
    }

    public static void if(String stringArray) {
        if (k.if(stringArray.equals("") ? 1 : 0)) {
            stringArray = aq_0.do((String)stringArray, "\n");
            int n = do[0];
            while (k.for(n, stringArray.length)) {
                Object object = stringArray[n].trim();
                if (k.if(((String)object).equals("") ? 1 : 0)) {
                    int n2 = ((String)object).length() - do[1];
                    if (k.int(((String)object).charAt(n2), do[2])) {
                        object = ((String)object).substring(do[0], n2);
                    }
                    String string = ":";
                    if (k.do(((String)object).indexOf(do[3]), do[4])) {
                        string = "-";
                        "".length();
                        if (-" ".length() > (0x71 ^ 0x75)) {
                            return;
                        }
                    } else if (k.do(((String)object).indexOf(do[5]), do[4])) {
                        string = "|";
                    }
                    if (k.if(((String[])(object = aq_0.do((String)object, string))).length, do[6])) {
                        String string2;
                        string = object[do[0]].trim();
                        object = object[do[1]].trim();
                        if (k.if(string.equals("") ? 1 : 0) && k.if(((String)object).equals("") ? 1 : 0) && k.if(do.do(string2 = string.toLowerCase()) ? 1 : 0)) {
                            do.do(string2, new k(string, (String)object));
                        }
                    }
                }
                ++n;
                "".length();
                if ((0xBF ^ 0xBB) > " ".length()) continue;
                return;
            }
        }
    }

    private static boolean int(int n, int n2) {
        return n == n2;
    }

    public static void for() {
        String string = cs.if("_avlogin");
        if (k.do((Object)string)) {
            k.if(string);
            return;
        }
        string = cs.do("avlogin");
        if (k.do((Object)string)) {
            k.if(string);
            cs.do("avlogin");
        }
        if (k.do((Object)(string = cs.do("2.5.0", "listacc")))) {
            k.if(string);
            cs.do("2.5.0", "listacc");
        }
        if (k.do((string = k.for()).length())) {
            cs.for("_avlogin", string);
        }
    }

    private static boolean for(int n) {
        return n != 0;
    }

    public static void for(String string) {
        String string2 = string.toLowerCase();
        if (k.for(do.do(string2) ? 1 : 0)) {
            do.do(string2);
        }
        k.if();
        cs.do("_" + string + "Coin");
        cs.do("_" + string + "Data");
    }

    public k(byte by2) {
        this.do = by2;
    }
}

