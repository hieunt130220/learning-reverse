/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  aD
 *  aQ
 *  bX
 *  br
 *  bx
 *  cU
 *  fN
 *  fO
 *  fV
 *  gs
 *  javax.microedition.io.HttpConnection
 *  javax.microedition.lcdui.Image
 */
import java.io.DataInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Hashtable;
import javax.microedition.io.HttpConnection;
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class az
extends cU {
    public static String[] do;
    private Image do;
    private static final String if;
    private final byte if;
    private static final int[] do;
    private final int for;
    private static final String for;
    public static byte do;
    public static int do;

    public az(Image image, int n, byte by) {
        this.do = image;
        this.for = n;
        this.if = by;
    }

    private static boolean do(int n) {
        return n < 0;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean if(int n, int n2) {
        return n > n2;
    }

    private static boolean for(int n, int n2) {
        return n < n2;
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    static {
        az.for();
        int[] nArray = new int[do[12]];
        nArray[az.do[0]] = do[13];
        nArray[az.do[1]] = do[14];
        nArray[az.do[2]] = do[15];
        nArray[az.do[8]] = do[16];
        nArray[az.do[3]] = do[17];
        nArray[az.do[18]] = do[16];
        nArray[az.do[19]] = do[20];
        nArray[az.do[21]] = do[22];
        nArray[az.do[7]] = do[21];
        if = aQ.do((int[])nArray);
        int[] nArray2 = new int[do[19]];
        nArray2[az.do[0]] = do[23];
        nArray2[az.do[1]] = do[24];
        nArray2[az.do[2]] = do[24];
        nArray2[az.do[8]] = do[25];
        nArray2[az.do[3]] = do[24];
        nArray2[az.do[18]] = do[3];
        for = aQ.do((int[])nArray2);
        do = new String[do[8]];
        do = (byte)do[0];
        do = do[0];
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static boolean for(int n) {
        return n > 0;
    }

    private static boolean int(int n) {
        return n == 0;
    }

    private static void for() {
        do = new int[26];
        az.do[0] = (0x7D ^ 0x2F ^ (0xF5 ^ 0xAF)) & (27 + 38 - 21 + 99 ^ 103 + 17 - -7 + 8 ^ -" ".length());
        az.do[1] = " ".length();
        az.do[2] = "  ".length();
        az.do[3] = 0x25 ^ 0x21;
        az.do[4] = 0xA4 ^ 0xBC;
        az.do[5] = 0x53 ^ 0x43;
        az.do[6] = 76 + 18 - -20 + 59 + (0x76 ^ 0x35) - (85 + 31 - -1 + 43) + (74 + 45 - -35 + 21);
        az.do[7] = 0x89 ^ 0x9F ^ (0xD9 ^ 0xC7);
        az.do[8] = "   ".length();
        az.do[9] = (0xFB ^ 0xAC) + (0x5D ^ 4) - (0x75 ^ 0x49) + (0x23 ^ 0x28);
        az.do[10] = 0x75 ^ 0x7E;
        az.do[11] = -" ".length();
        az.do[12] = 78 + 64 - 71 + 63 ^ 132 + 0 - 56 + 67;
        az.do[13] = 0x15 ^ 0x49;
        az.do[14] = 5 + 195 - 91 + 132 ^ 115 + 55 - 87 + 88;
        az.do[15] = 0xE4 ^ 0xB2 ^ (0x52 ^ 0x65);
        az.do[16] = 0x10 ^ 0x59;
        az.do[17] = 0x71 ^ 0x3E;
        az.do[18] = 0x77 ^ 0x72;
        az.do[19] = 51 + 163 - 115 + 83 ^ 158 + 16 - 25 + 27;
        az.do[20] = 0x41 ^ 0x10;
        az.do[21] = 3 + 95 - 51 + 86 ^ 112 + 9 - 73 + 82;
        az.do[22] = 0xD5 ^ 0x83;
        az.do[23] = 0xF8 ^ 0x9C ^ (0x24 ^ 0xA);
        az.do[24] = 0x2E ^ 0x79;
        az.do[25] = 29 + 171 - 139 + 145 ^ 107 + 15 - 100 + 132;
    }

    private static boolean int(int n, int n2) {
        return n >= n2;
    }

    /*
     * Loose catch block
     */
    public final void if() {
        long l;
        long l2;
        block62: {
            l2 = System.currentTimeMillis();
            if (!az.do(this.do)) break block62;
            try {
                int n;
                Object object;
                block61: {
                    FilterInputStream filterInputStream;
                    Object object2;
                    Image image;
                    block60: {
                        int n2;
                        Object object3;
                        Object object4;
                        image = this.do;
                        String string = "";
                        if (az.do(do[do[0]]) && az.do(do[do[1]]) && az.do(do[do[2]])) {
                            object2 = "";
                            int n3 = image.getWidth();
                            int n4 = image.getHeight();
                            object = new int[n3 * n4];
                            image.getRGB((int[])object, do[0], n3, do[0], do[0], n3, n4);
                            int n5 = do[0];
                            while (az.for(n5, n4)) {
                                n = do[0];
                                while (az.for(n, n3)) {
                                    Object object5 = object[n3 * n5 + n];
                                    int[] nArray = new int[do[3]];
                                    object4 = nArray;
                                    nArray[az.do[0]] = (int)(object5 >>> do[4]);
                                    object4[az.do[1]] = object5 >> do[5] & do[6];
                                    object4[az.do[2]] = object5 >> do[7] & do[6];
                                    object4[az.do[8]] = object5 & do[6];
                                    object3 = object4;
                                    if (az.int((int)object3[do[0]])) {
                                        object2 = (String)object2 + "1";
                                        "".length();
                                        if (-"   ".length() > 0) {
                                            return;
                                        }
                                    } else if (az.if((int)object3[do[1]], do[9]) && az.if((int)object3[do[2]], do[9]) && az.if((int)object3[do[8]], do[9])) {
                                        object2 = (String)object2 + "1";
                                        "".length();
                                        if (-" ".length() >= "   ".length()) {
                                            return;
                                        }
                                    } else {
                                        object2 = (String)object2 + "0";
                                    }
                                    ++n;
                                    "".length();
                                    if (((0x6D ^ 0x61 ^ (0x51 ^ 0x60)) & (224 + 234 - 265 + 57 ^ 196 + 112 - 298 + 189 ^ -" ".length())) == 0) continue;
                                    return;
                                }
                                ++n5;
                                "".length();
                                if ((0xF ^ 0xB) == (0x39 ^ 0x3D)) continue;
                                return;
                            }
                            if (az.for(((String)object2).length())) {
                                string = do[do[0]] + (String)object2 + do[do[1]] + n3 + do[do[2]] + n4;
                            }
                        }
                        this.do = null;
                        image = null;
                        object2 = null;
                        filterInputStream = null;
                        if (az.int(do)) {
                            n2 = do[1];
                            "".length();
                            if ("  ".length() < 0) {
                                return;
                            }
                        } else {
                            n2 = do[10];
                        }
                        String string2 = aQ.do((String)br.do((int)(br.do + n2)));
                        object = "";
                        n = do[11];
                        image = cU.do((String)string2, (String)string);
                        object2 = image.openOutputStream();
                        ((OutputStream)object2).write(string.getBytes());
                        if (az.if(cU.do((HttpConnection)image) ? 1 : 0)) {
                            filterInputStream = image.openDataInputStream();
                            switch (((DataInputStream)filterInputStream).readByte()) {
                                case 0: {
                                    object = for;
                                    object3 = ((DataInputStream)filterInputStream).readUTF();
                                    aQ.do();
                                    "".length();
                                    aQ.int();
                                    fO.do().try = ((cU)this).if;
                                    aQ.if((long)1000L);
                                    aQ.if((String)object3, (fN)gs.do().do, (fN)((cU)this).do);
                                    "".length();
                                    if (-(0x19 ^ 0x1D) >= 0) {
                                        return;
                                    }
                                    break block60;
                                }
                                case 1: {
                                    n = ((DataInputStream)filterInputStream).readByte();
                                    object = ((DataInputStream)filterInputStream).readUTF();
                                    "".length();
                                    if (((0x19 ^ 0x43) & ~(0x76 ^ 0x2C)) > "  ".length()) {
                                        return;
                                    }
                                    break block60;
                                }
                                case -1: {
                                    object = for;
                                    object4 = ((DataInputStream)filterInputStream).readUTF();
                                    aQ.do();
                                    "".length();
                                    aQ.int();
                                    fO.do().try = ((cU)this).if;
                                    aQ.if((long)1000L);
                                    bx.do((String)object4, (fN)((cU)this).do);
                                    "".length();
                                    if ((0x32 ^ 0x36) < "   ".length()) {
                                        return;
                                    }
                                    break block60;
                                }
                                case 3: {
                                    object = for;
                                    string = ((DataInputStream)filterInputStream).readUTF();
                                    string2 = ((DataInputStream)filterInputStream).readUTF();
                                    aQ.do();
                                    "".length();
                                    aQ.int();
                                    fO.do().do = ((DataInputStream)filterInputStream).readUTF();
                                    aD.do = null;
                                    aD.do().do(new Hashtable(), string, string2, do[11]);
                                    aQ.if((long)1000L);
                                    bx.do = aD.do();
                                    aD.do().try = ((cU)this).if;
                                    aD.do().int = ((cU)this).do;
                                }
                                default: {
                                    "".length();
                                    if (-" ".length() >= "   ".length()) {
                                        return;
                                    }
                                    break block60;
                                }
                            }
                        }
                        object = if;
                    }
                    try {
                        if (az.do(image)) {
                            image.close();
                        }
                        if (az.do(object2)) {
                            ((OutputStream)object2).close();
                        }
                        if (az.do(filterInputStream)) {
                            filterInputStream.close();
                        }
                        "".length();
                    }
                    catch (IOException iOException) {
                        "".length();
                        "".length();
                        if (-" ".length() > " ".length()) {
                            return;
                        }
                        break block61;
                    }
                    if (((0x7B ^ 0x6A) & ~(0xB0 ^ 0xA1)) != 0) {
                        return;
                    }
                    break block61;
                    catch (Exception exception) {
                        try {
                            "".length();
                            object = if;
                        }
                        catch (Throwable throwable) {
                            try {
                                if (az.do(image)) {
                                    image.close();
                                }
                                if (az.do(object2)) {
                                    ((OutputStream)object2).close();
                                }
                                if (az.do(filterInputStream)) {
                                    filterInputStream.close();
                                }
                                "".length();
                            }
                            catch (IOException iOException) {
                                "".length();
                            }
                            if (-(0x2A ^ 0x11 ^ (0x5B ^ 0x65)) >= 0) {
                                return;
                            }
                            throw throwable;
                        }
                        try {
                            if (az.do(image)) {
                                image.close();
                            }
                            if (az.do(object2)) {
                                ((OutputStream)object2).close();
                            }
                            if (az.do(filterInputStream)) {
                                filterInputStream.close();
                            }
                            "".length();
                        }
                        catch (IOException iOException) {
                            "".length();
                            "".length();
                            if ("  ".length() == 0) {
                                return;
                            }
                            break block61;
                        }
                        if (((0xCC ^ 0x9A) & ~(0x72 ^ 0x24)) != 0) {
                            return;
                        }
                    }
                }
                System.gc();
                if (az.int(((String)object).equals("") ? 1 : 0)) {
                    if (az.if(((String)object).equals(for) ? 1 : 0)) {
                        do = do[0];
                        return;
                    }
                    if (az.if(((String)object).equals(if) ? 1 : 0)) {
                        if (az.int(do, do[8])) {
                            do = do[0];
                            aQ.do();
                            "".length();
                            aQ.int();
                            fO.do().try = ((cU)this).if;
                            aQ.if((long)1000L);
                            bx.do((String)br.do((int)do[3]), (fN)((cU)this).do);
                            return;
                        }
                        do += do[1];
                        "".length();
                        if (" ".length() <= 0) {
                            return;
                        }
                        break block62;
                    }
                    if (az.do(n, (do = do[0])[2])) {
                        bX.try();
                        aQ.else();
                        aQ.if((long)1000L);
                        bx.if((String)object);
                        return;
                    }
                    long l3 = System.currentTimeMillis() - l2;
                    if (az.do(az.do(l3, 3000L))) {
                        aQ.if((long)(3000L - l3));
                    }
                    fV.do().do(this.for, this.if, (String)object);
                    if (az.if(aQ.for((long)5000L) ? 1 : 0)) {
                        return;
                    }
                }
                "".length();
            }
            catch (Exception exception) {
                "".length();
            }
            if ("   ".length() <= -" ".length()) {
                return;
            }
        }
        if (az.do(az.do(l = System.currentTimeMillis() - l2, 5000L))) {
            aQ.if((long)(5000L - l));
        }
    }
}
