/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  aQ
 *  aX
 *  bT
 *  cU
 *  eS
 *  ep
 *  javax.microedition.lcdui.Image
 */
import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.util.Hashtable;
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class br {
    private final int if = if.length;
    private int for;
    public static int do;
    private String do;
    private byte[] do;
    private static final byte[] if;
    public static Image do;
    public static final Hashtable do;
    private static final int[] do;
    private DataInputStream do;
    private static br do;
    private static int[] if;
    private String[] do;
    private int int;
    private int[] for;
    private int[] int;
    private static int[] new;

    private static boolean do(int n) {
        return n != 0;
    }

    public br() {
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private void do(byte[] byArray) {
        int n = byArray.length;
        int n2 = do[1];
        while (br.do(n2, n)) {
            int n3 = n2;
            byArray[n3] = (byte)(byArray[n3] ^ if[n2 % this.if]);
            ++n2;
            "".length();
            if (" ".length() != 0) continue;
            return;
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private String do(String string) {
        int n;
        block4: {
            try {
                n = do[1];
                break block4;
            }
            catch (Exception exception) {
                "".length();
            }
            return null;
        }
        while (br.do(n, this.for)) {
            if (br.for(this.do[n].compareTo(string))) {
                return new String(this.do, this.for[n], this.int[n]);
            }
            ++n;
            "".length();
            if (((0x43 ^ 0x35 ^ (0x94 ^ 0xA3)) & (0xF6 ^ 0xBC ^ (0x62 ^ 0x69) ^ -" ".length())) == 0) continue;
            return null;
        }
        "".length();
        return null;
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    private static String if(String string) {
        if (br.do(do) && br.do((Object)(string = do.do(string + aQ.do((int[])if))))) {
            try {
                return new String(eS.do((String)string), "UTF-8");
            }
            catch (UnsupportedEncodingException unsupportedEncodingException) {
                "".length();
                return new String(eS.do((String)string));
            }
        }
        return null;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public static void do(DataInputStream dataInputStream) {
        int n = dataInputStream.readInt();
        int n2 = do[1];
        while (br.do(n2, n)) {
            String string = do + n2 + String.valueOf((char)new[do[9]]);
            do.put(string, dataInputStream.readUTF());
            "".length();
            ++n2;
            "".length();
            if (null == null) continue;
            return;
        }
    }

    private static Image do(String string) {
        if (br.do(do)) {
            return do.if(string + aQ.do((int[])if));
        }
        return null;
    }

    private static boolean for(int n) {
        return n == 0;
    }

    private void if() {
        if (br.do((Object)this.do)) {
            try {
                this.do.close();
                return;
            }
            catch (IOException iOException) {
                "".length();
            }
        }
    }

    public static DataInputStream do(byte[] byArray) {
        if (br.do((Object)byArray) && br.if(byArray.length)) {
            byte[] byArray2 = new byte[byArray.length];
            int n = if.length;
            int n2 = do[1];
            while (br.do(n2, byArray.length)) {
                byArray2[n2] = (byte)(byArray[n2] ^ if[n2 % n]);
                ++n2;
                "".length();
                if ("   ".length() > 0) continue;
                return null;
            }
            ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(byArray2);
            return new DataInputStream(byteArrayInputStream);
        }
        return null;
    }

    static {
        br.for();
        byte[] byArray = new byte[do[15]];
        byArray[br.do[1]] = do[16];
        byArray[br.do[3]] = do[17];
        byArray[br.do[5]] = do[12];
        byArray[br.do[7]] = do[18];
        byArray[br.do[9]] = do[19];
        byArray[br.do[11]] = do[6];
        byArray[br.do[13]] = do[20];
        byArray[br.do[14]] = do[12];
        byArray[br.do[0]] = do[12];
        byArray[br.do[21]] = do[22];
        byArray[br.do[23]] = do[12];
        byArray[br.do[24]] = do[18];
        byArray[br.do[25]] = do[19];
        byArray[br.do[26]] = do[27];
        if = byArray;
        int[] nArray = new int[do[11]];
        nArray[br.do[1]] = do[28];
        nArray[br.do[3]] = do[27];
        nArray[br.do[5]] = do[29];
        nArray[br.do[7]] = do[30];
        nArray[br.do[9]] = do[7];
        if = nArray;
        do = new Hashtable();
        int[] nArray2 = new int[do[13]];
        nArray2[br.do[1]] = do[31];
        nArray2[br.do[3]] = do[27];
        nArray2[br.do[5]] = do[12];
        nArray2[br.do[7]] = do[32];
        nArray2[br.do[9]] = do[33];
        nArray2[br.do[11]] = do[34];
        new = nArray2;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private Image if(String string) {
        int n;
        block4: {
            try {
                n = do[1];
                break block4;
            }
            catch (Exception exception) {
                "".length();
            }
            return null;
        }
        while (br.do(n, this.for)) {
            if (br.for(this.do[n].compareTo(string))) {
                return Image.createImage((byte[])this.do, (int)this.for[n], (int)this.int[n]);
            }
            ++n;
            "".length();
            if ("  ".length() > 0) continue;
            return null;
        }
        "".length();
        return null;
    }

    public static String do(int n) {
        String string = String.valueOf(n) + String.valueOf((char)new[do[9]]);
        if (br.do(do.containsKey(string) ? 1 : 0)) {
            return (String)do.get(string);
        }
        return null;
    }

    public static void do() {
        int[] nArray = new int[do[0]];
        nArray[br.do[1]] = do[2];
        nArray[br.do[3]] = do[4];
        nArray[br.do[5]] = do[6];
        nArray[br.do[7]] = do[8];
        nArray[br.do[9]] = do[10];
        nArray[br.do[11]] = do[12];
        nArray[br.do[13]] = do[6];
        nArray[br.do[14]] = do[13];
        String[] stringArray = aQ.do((int[])nArray);
        do = new br(bT.if() + (String)stringArray);
        do = br.do(String.valueOf((char)new[do[1]]));
        ep.case = br.do(String.valueOf((char)new[do[3]]));
        stringArray = aQ.do((String)br.if(String.valueOf((char)new[do[5]])), (String)String.valueOf((char)new[do[7]]));
        int n = do[1];
        while (br.do(n, stringArray.length)) {
            int n2 = stringArray[n].indexOf(new[do[9]]);
            String string = stringArray[n].substring(do[1], n2 + do[3]);
            String string2 = stringArray[n].substring(n2 + do[3]);
            do.put(string, string2);
            "".length();
            ++n;
            "".length();
            if (-(0xC7 ^ 0x97 ^ (0x23 ^ 0x77)) < 0) continue;
            return;
        }
        do = do.size();
        aX.do = do;
        cU.do = br.do(do[1]);
        if (br.do(do)) {
            do.if();
            do = null;
        }
        System.gc();
    }

    private br(String string) {
        int n = do[1];
        int n2 = do[1];
        this.do = string;
        this.int = do[1];
        this.do = new DataInputStream(this.getClass().getResourceAsStream(this.do));
        try {
            this.for = this.do.readUnsignedByte();
            this.int += do[3];
            this.do = new String[this.for];
            this.for = new int[this.for];
            this.int = new int[this.for];
            int n3 = do[1];
            while (br.do(n3, this.for)) {
                byte by = this.do.readByte();
                byte[] byArray = new byte[by];
                this.do.read(byArray);
                "".length();
                this.do(byArray);
                this.do[n3] = new String(byArray);
                this.for[n3] = n;
                this.int[n3] = this.do.readUnsignedShort();
                n += this.int[n3];
                n2 += this.int[n3];
                this.int += by + do[7];
                ++n3;
                "".length();
                if (null == null) continue;
                throw null;
            }
            this.do = new byte[n2];
            this.do.readFully(this.do);
            this.do(this.do);
            "".length();
        }
        catch (IOException iOException) {
            "".length();
        }
        if (" ".length() == "   ".length()) {
            throw null;
        }
        this.if();
    }

    private static void for() {
        do = new int[35];
        br.do[0] = 0x9E ^ 0x96;
        br.do[1] = (24 + 10 - -41 + 59 ^ 162 + 100 - 113 + 39) & ("   ".length() ^ (0x2E ^ 0x17) ^ -" ".length());
        br.do[2] = 0xC3 ^ 0xB5 ^ (0x15 ^ 0x55);
        br.do[3] = " ".length();
        br.do[4] = 0x14 ^ 0x67;
        br.do[5] = "  ".length();
        br.do[6] = 0x70 ^ 0x1E;
        br.do[7] = "   ".length();
        br.do[8] = 0x4C ^ 0x6F ^ (0x6A ^ 0x7C);
        br.do[9] = 0x59 ^ 0x22 ^ 97 + 74 - 49 + 5;
        br.do[10] = 181 + 169 - 291 + 189 ^ 112 + 110 - 216 + 137;
        br.do[11] = 0x5D ^ 3 ^ (0xEE ^ 0xB5);
        br.do[12] = 208 + 113 - 158 + 65 ^ 23 + 77 - 25 + 70;
        br.do[13] = 0x53 ^ 0x67 ^ (0x1A ^ 0x28);
        br.do[14] = "  ".length() ^ (0xA5 ^ 0xA0);
        br.do[15] = 0xA5 ^ 0xAB;
        br.do[16] = 0xE ^ 0x40;
        br.do[17] = 0x7A ^ 0x18 ^ (0x2A ^ 0x2F);
        br.do[18] = 0xE0 ^ 0x99;
        br.do[19] = 0x52 ^ 0x16 ^ (0x79 ^ 0x58);
        br.do[20] = 0x6F ^ 0x27;
        br.do[21] = 0x26 ^ 0x50 ^ 53 + 74 - 97 + 97;
        br.do[22] = 4 ^ 0x55;
        br.do[23] = 0xE4 ^ 0x87 ^ (0x4E ^ 0x27);
        br.do[24] = 0x9C ^ 0x97;
        br.do[25] = 0x5E ^ 0x52;
        br.do[26] = 0x84 ^ 0x89;
        br.do[27] = 0xFD ^ 0xA4 ^ (0x72 ^ 0x5F);
        br.do[28] = 0x91 ^ 0xA3;
        br.do[29] = 0x39 ^ 0x4B;
        br.do[30] = 0x64 ^ 0x2B ^ (1 ^ 0x25);
        br.do[31] = 0x13 ^ 0x70;
        br.do[32] = 0xBA ^ 0xC6;
        br.do[33] = 0x4E ^ 0x73;
        br.do[34] = 113 + 88 - 182 + 157 ^ 11 + 56 - 11 + 83;
    }
}
