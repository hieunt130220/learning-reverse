/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.rms.RecordStore
 *  javax.microedition.rms.RecordStoreException
 */
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.util.Calendar;
import java.util.TimeZone;
import java.util.Vector;
import javax.microedition.rms.RecordStore;
import javax.microedition.rms.RecordStoreException;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class cs {
    private static final int[] do;
    private static final String do;

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void do() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeInt(aq_0.do);
            dataOutputStream.writeLong(aq_0.int);
            dataOutputStream.writeInt((int)aq_0.do);
            dataOutputStream.writeInt(aq_0.if);
            dataOutputStream.writeLong(aq_0.for);
            dataOutputStream.flush();
            byteArrayOutputStream.flush();
            cs.do("_" + (String)AngelChip.do.do + "Data", byteArrayOutputStream.toByteArray());
        }
        catch (IOException iOException) {
            "".length();
            try {
                byteArrayOutputStream.close();
                dataOutputStream.close();
                return;
            }
            catch (IOException iOException2) {
                "".length();
                return;
            }
        }
        catch (Throwable throwable) {
            try {
                byteArrayOutputStream.close();
                dataOutputStream.close();
                "".length();
            }
            catch (IOException iOException) {
                "".length();
                throw throwable;
            }
            if ("   ".length() >= -" ".length()) throw throwable;
            return;
        }
        try {
            byteArrayOutputStream.close();
            dataOutputStream.close();
            return;
        }
        catch (IOException iOException) {
            "".length();
            return;
        }
    }

    public static byte[] do(String string) {
        try {
            string = RecordStore.openRecordStore((String)(do + string), (boolean)do[0]);
            byte[] byArray = string.getRecord(do[1]);
            string.closeRecordStore();
            return byArray;
        }
        catch (RecordStoreException recordStoreException) {
            "".length();
            return null;
        }
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public static void do(String string) {
        string = cs.for(do + string);
        if (cs.do((Object)string)) {
            try {
                RecordStore.deleteRecordStore((String)string);
                return;
            }
            catch (RecordStoreException recordStoreException) {
                "".length();
            }
        }
    }

    private static boolean do(int n) {
        return n == 0;
    }

    private static void byte() {
        do = new int[11];
        cs.do[0] = (0x29 ^ 0x41 ^ (0xC8 ^ 0x9F)) & (162 + 41 - 128 + 96 ^ 35 + 144 - 55 + 24 ^ -" ".length());
        cs.do[1] = " ".length();
        cs.do[2] = -" ".length();
        cs.do[3] = "  ".length();
        cs.do[4] = 0x6C ^ 0x68;
        cs.do[5] = 0xB0 ^ 0xB5;
        cs.do[6] = 0xAA ^ 0x94 ^ (0x3A ^ 0x63);
        cs.do[7] = 0xE8 ^ 0x84;
        cs.do[8] = 28 + 102 - 70 + 143 ^ 29 + 66 - -36 + 35;
        cs.do[9] = "   ".length();
        cs.do[10] = 0xE5 ^ 0x91;
    }

    static {
        cs.byte();
        int[] nArray = new int[do[5]];
        nArray[cs.do[0]] = do[6];
        nArray[cs.do[1]] = do[7];
        nArray[cs.do[3]] = do[8];
        nArray[cs.do[9]] = do[10];
        nArray[cs.do[4]] = do[0];
        do = aq_0.do(nArray);
    }

    public static void if() {
        aq_0.for = do[0];
        bs_0.new = do[0];
        bs_0.do = do[0];
        bs_0.try = do[0];
        aq_0.int = do[0];
        cs.try();
    }

    private static boolean if(int n) {
        return n > 0;
    }

    public static boolean do() {
        String string;
        int n = gx_0.do().class - do[1];
        if (cs.int(n)) {
            n = do[0];
        }
        if (!cs.do((string = AngelChip.if[gC.do().do[do[4]]][gx_0.do().do][n]).equals(AngelChip.if[do[0]][do[0]][do[0]]) ? 1 : 0) || cs.for(string.equals(AngelChip.if[do[0]][do[0]][do[1]]) ? 1 : 0)) {
            return do[1];
        }
        return do[0];
    }

    private static String for(String string) {
        string = string.toLowerCase();
        String[] stringArray = RecordStore.listRecordStores();
        if (cs.do(stringArray)) {
            int n = do[0];
            while (cs.do(n, stringArray.length)) {
                if (cs.for(string.equals(stringArray[n].toLowerCase()) ? 1 : 0)) {
                    return stringArray[n];
                }
                ++n;
                "".length();
                if (((149 + 70 - 212 + 169 ^ 40 + 66 - 1 + 43) & (0x1F ^ 0x39 ^ "  ".length() ^ -" ".length())) == 0) continue;
                return null;
            }
        }
        return null;
    }

    public static String do(String object, String string) {
        byte[] byArray = cs.do((String)object, string);
        object = byArray;
        if (cs.if(byArray)) {
            return null;
        }
        try {
            return new String((byte[])object, "UTF-8");
        }
        catch (UnsupportedEncodingException unsupportedEncodingException) {
            "".length();
            return new String((byte[])object);
        }
    }

    private static boolean for(int n) {
        return n != 0;
    }

    public static void do(String string, String string2) {
        if (cs.do((Object)(string = cs.for(string + string2)))) {
            try {
                RecordStore.deleteRecordStore((String)string);
                return;
            }
            catch (RecordStoreException recordStoreException) {
                "".length();
            }
        }
    }

    /*
     * Loose catch block
     */
    public static void for() {
        block11: {
            Object object = cs.do("_" + (String)AngelChip.do.do + "Coin");
            if (!cs.do(object)) break block11;
            object = new ByteArrayInputStream((byte[])object);
            DataInputStream dataInputStream = new DataInputStream((InputStream)object);
            aq_0.for = dataInputStream.readInt();
            bs_0.new = dataInputStream.readInt();
            bs_0.do = dataInputStream.readInt();
            bs_0.try = dataInputStream.readInt();
            aq_0.int = dataInputStream.readInt();
            try {
                dataInputStream.close();
                object.close();
                return;
            }
            catch (IOException iOException) {
                "".length();
                return;
            }
            catch (IOException iOException) {
                try {
                    "".length();
                    cs.do("_" + (String)AngelChip.do.do + "Coin");
                    cs.if();
                }
                catch (Throwable throwable) {
                    try {
                        dataInputStream.close();
                        object.close();
                        "".length();
                    }
                    catch (IOException iOException2) {
                        "".length();
                    }
                    if ((12 + 132 - 106 + 119 ^ 96 + 27 - 31 + 60) <= 0) {
                        return;
                    }
                    throw throwable;
                }
                try {
                    dataInputStream.close();
                    object.close();
                    return;
                }
                catch (IOException iOException3) {
                    "".length();
                    return;
                }
            }
        }
        cs.if();
    }

    public static void if(String string, String string2) {
        try {
            cs.do(string, string2.getBytes("UTF-8"));
            return;
        }
        catch (UnsupportedEncodingException unsupportedEncodingException) {
            "".length();
            cs.do(string, string2.getBytes());
            return;
        }
    }

    /*
     * Loose catch block
     */
    public static void int() {
        block15: {
            block16: {
                Object object = cs.do("_" + (String)AngelChip.do.do + "Data");
                if (!cs.do(object)) break block16;
                object = new ByteArrayInputStream((byte[])object);
                DataInputStream dataInputStream = new DataInputStream((InputStream)object);
                aq_0.do = dataInputStream.readInt();
                aq_0.int = dataInputStream.readLong();
                aq_0.do = dataInputStream.readInt();
                aq_0.if = dataInputStream.readInt();
                aq_0.for = dataInputStream.readLong();
                try {
                    dataInputStream.close();
                    object.close();
                    "".length();
                }
                catch (IOException iOException) {
                    "".length();
                    "".length();
                    if (-(0x4C ^ 0x48) > 0) {
                        return;
                    }
                    break block15;
                }
                if (((6 + 63 - -2 + 80 ^ 99 + 62 - 153 + 161) & ("  ".length() ^ (0xA7 ^ 0x9B) ^ -" ".length())) != 0) {
                    return;
                }
                break block15;
                catch (IOException iOException) {
                    try {
                        "".length();
                        cs.do("_" + (String)AngelChip.do.do + "Data");
                        cs.new();
                    }
                    catch (Throwable throwable) {
                        try {
                            dataInputStream.close();
                            object.close();
                            "".length();
                        }
                        catch (IOException iOException2) {
                            "".length();
                        }
                        if ((8 ^ 0x20 ^ (0x83 ^ 0xAF)) == -" ".length()) {
                            return;
                        }
                        throw throwable;
                    }
                    try {
                        dataInputStream.close();
                        object.close();
                        "".length();
                    }
                    catch (IOException iOException3) {
                        "".length();
                        "".length();
                        if ("  ".length() <= 0) {
                            return;
                        }
                        break block15;
                    }
                    if ((0x6A ^ 0x6E) <= -" ".length()) {
                        return;
                    }
                    break block15;
                }
            }
            cs.new();
        }
        aq_0.do().do();
    }

    public static void do(String string, int n) {
        byte[] byArray = new byte[do[1]];
        byArray[cs.do[0]] = (byte)n;
        cs.do(string, byArray);
    }

    public static void new() {
        Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
        aq_0.do = AngelChip.do.do[do[0]];
        aq_0.int = calendar.getTime().getTime();
        aq_0.do = 0L;
        aq_0.if = do[0];
        aq_0.for = System.currentTimeMillis();
        cs.do();
    }

    public static void do(DataInputStream dataInputStream) {
        byte by2 = dataInputStream.readByte();
        AngelChip.do = new String[do[3]][by2][];
        AngelChip.if = new String[do[3]][by2][];
        AngelChip.do = new int[do[3]][by2][];
        int n = do[0];
        while (cs.do(n, (int)by2)) {
            byte by3 = dataInputStream.readByte();
            AngelChip.do[cs.do[0]][n] = new String[by3 + do[1]];
            AngelChip.do[cs.do[0]][n][cs.do[0]] = dataInputStream.readUTF();
            AngelChip.if[cs.do[0]][n] = new String[by3];
            AngelChip.do[cs.do[0]][n] = new int[by3];
            int n2 = do[0];
            while (cs.do(n2, (int)by3)) {
                AngelChip.do[cs.do[0]][n][n2 + cs.do[1]] = dataInputStream.readUTF();
                AngelChip.if[cs.do[0]][n][n2] = dataInputStream.readUTF();
                AngelChip.do[cs.do[0]][n][n2] = dataInputStream.readInt();
                ++n2;
                "".length();
                if (null == null) continue;
                return;
            }
            ++n;
            "".length();
            if ("   ".length() >= 0) continue;
            return;
        }
        AngelChip.do[cs.do[1]] = AngelChip.do[do[0]];
        AngelChip.if[cs.do[1]] = AngelChip.if[do[0]];
        AngelChip.do[cs.do[1]] = AngelChip.do[do[0]];
        if (cs.for(bx.do instanceof gx_0)) {
            gx_0.do().if();
        }
    }

    private static byte[] do(byte[] byArray) {
        if (cs.do((Object)byArray)) {
            int n = do[0];
            while (cs.do(n, byArray.length)) {
                int n2 = n++;
                byArray[n2] = (byte)(byArray[n2] ^ do[2]);
                "".length();
                if (-"   ".length() < 0) continue;
                return null;
            }
        }
        return byArray;
    }

    public static String do(String object) {
        byte[] byArray = cs.do((String)object);
        object = byArray;
        if (cs.if(byArray)) {
            return null;
        }
        try {
            return new String((byte[])object, "UTF-8");
        }
        catch (UnsupportedEncodingException unsupportedEncodingException) {
            "".length();
            return new String((byte[])object);
        }
    }

    public static void do(String string, byte[] byArray) {
        try {
            string = RecordStore.openRecordStore((String)(do + string), (boolean)do[1]);
            if (cs.if(string.getNumRecords())) {
                string.setRecord(do[1], byArray, do[0], byArray.length);
                "".length();
                if ("   ".length() <= 0) {
                    return;
                }
            } else {
                string.addRecord(byArray, do[0], byArray.length);
                "".length();
            }
            string.closeRecordStore();
            return;
        }
        catch (RecordStoreException recordStoreException) {
            "".length();
            return;
        }
    }

    private static boolean if(Object object) {
        return object == null;
    }

    public static Vector do() {
        Vector<String> vector = new Vector<String>();
        String[] stringArray = RecordStore.listRecordStores();
        if (cs.do(stringArray)) {
            int n = do[0];
            while (cs.do(n, stringArray.length)) {
                if (cs.for(stringArray[n].startsWith(do + "_") ? 1 : 0) && (!cs.do(stringArray[n].endsWith("Coin") ? 1 : 0) || cs.for(stringArray[n].endsWith("Data") ? 1 : 0))) {
                    vector.addElement(stringArray[n].substring(do.length() + do[1]));
                }
                ++n;
                "".length();
                if (" ".length() >= 0) continue;
                return null;
            }
        }
        return vector;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void try() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeInt(aq_0.for);
            dataOutputStream.writeInt(bs_0.new);
            dataOutputStream.writeInt(bs_0.do);
            dataOutputStream.writeInt(bs_0.try);
            dataOutputStream.writeInt(aq_0.int);
            dataOutputStream.flush();
            byteArrayOutputStream.flush();
            cs.do("_" + (String)AngelChip.do.do + "Coin", byteArrayOutputStream.toByteArray());
        }
        catch (IOException iOException) {
            "".length();
            try {
                dataOutputStream.close();
                byteArrayOutputStream.close();
                return;
            }
            catch (IOException iOException2) {
                "".length();
                return;
            }
        }
        catch (Throwable throwable) {
            try {
                dataOutputStream.close();
                byteArrayOutputStream.close();
                "".length();
                throw throwable;
            }
            catch (IOException iOException) {
                "".length();
                throw throwable;
            }
        }
        try {
            dataOutputStream.close();
            byteArrayOutputStream.close();
            return;
        }
        catch (IOException iOException) {
            "".length();
            return;
        }
    }

    private static void do(String string, String string2, byte[] byArray) {
        byArray = cs.do(byArray);
        try {
            string = RecordStore.openRecordStore((String)(string + string2), (boolean)do[1]);
            if (cs.if(string.getNumRecords())) {
                string.setRecord(do[1], byArray, do[0], byArray.length);
                "".length();
                if (-" ".length() > ((0x36 ^ 0x51 ^ (0x10 ^ 0x49)) & (0x7C ^ 0xA ^ (0x88 ^ 0xC0) ^ -" ".length()))) {
                    return;
                }
            } else {
                string.addRecord(byArray, do[0], byArray.length);
                "".length();
            }
            string.closeRecordStore();
            return;
        }
        catch (RecordStoreException recordStoreException) {
            "".length();
            return;
        }
    }

    private static boolean int(int n) {
        return n < 0;
    }

    public static String if(String string) {
        return cs.do(do, string);
    }

    public static int do(String object) {
        byte[] byArray = cs.do((String)object);
        object = byArray;
        if (cs.if(byArray)) {
            return do[2];
        }
        return (int)object[do[0]];
    }

    public static void for(String string, String string2) {
        String string3 = string2;
        string2 = string;
        string = do;
        try {
            cs.do(string, string2, string3.getBytes("UTF-8"));
            return;
        }
        catch (UnsupportedEncodingException unsupportedEncodingException) {
            "".length();
            cs.do(string, string2, string3.getBytes());
            return;
        }
    }

    private static byte[] do(String string, String object) {
        try {
            string = RecordStore.openRecordStore((String)(string + (String)object), (boolean)do[0]);
            object = string.getRecord(do[1]);
            string.closeRecordStore();
            return cs.do((byte[])object);
        }
        catch (RecordStoreException recordStoreException) {
            "".length();
            return null;
        }
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }
}

