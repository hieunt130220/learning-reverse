/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  aD
 *  aQ
 *  aX
 *  ah
 *  an
 *  az
 *  bS
 *  bT
 *  bX
 *  bc
 *  br
 *  bx
 *  cs
 *  dH
 *  fN
 *  fO
 *  fQ
 *  gm
 *  gs
 *  javax.microedition.io.Connector
 *  javax.microedition.io.HttpConnection
 *  main.AngelChip
 */
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.util.Hashtable;
import javax.microedition.io.Connector;
import javax.microedition.io.HttpConnection;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public class cU
extends dH
implements Runnable {
    private static String if;
    private boolean do;
    public static boolean if;
    private static String for;
    public static long do;
    protected int if;
    private static final int[] do;
    public fN do = new fN(bT.bg, do[0], (dH)this);
    public static String do;
    public fN if;
    private long if = new fN(bT.I, do[1], (dH)this);

    private static String do() {
        String string;
        byte[] byArray = new byte[do[3]];
        byArray[cU.do[2]] = do[4];
        byArray[cU.do[0]] = do[5];
        byArray[cU.do[1]] = do[6];
        byArray[cU.do[7]] = do[8];
        byArray[cU.do[9]] = do[10];
        byArray[cU.do[11]] = do[12];
        byArray[cU.do[13]] = do[14];
        byArray[cU.do[15]] = do[5];
        byArray[cU.do[16]] = do[17];
        byArray[cU.do[18]] = do[5];
        byArray[cU.do[19]] = do[10];
        byArray[cU.do[20]] = do[21];
        byArray[cU.do[22]] = do[23];
        byArray[cU.do[24]] = do[25];
        byArray[cU.do[26]] = do[27];
        byArray[cU.do[28]] = do[29];
        byArray[cU.do[30]] = do[17];
        byArray[cU.do[31]] = do[32];
        byArray[cU.do[33]] = do[10];
        byArray[cU.do[34]] = do[8];
        byArray[cU.do[35]] = do[4];
        String string2 = System.getProperty(new String(byArray));
        StringBuffer stringBuffer = new StringBuffer().append(for).append(string2).append(do[36]);
        if (cU.do((Object)do)) {
            string = if + do;
            "".length();
            if ("  ".length() < "  ".length()) {
                return null;
            }
        } else {
            string = "";
        }
        return stringBuffer.append(string).toString();
    }

    private static boolean do(int n) {
        return n > 0;
    }

    protected static HttpConnection do(String string) {
        string = (HttpConnection)Connector.open((String)string, (int)do[0], (boolean)do[2]);
        string.setRequestProperty("Content-Type", "text/plain");
        string.setRequestProperty("User-Agent", cU.do());
        string.setRequestProperty("Connection", "close");
        return string;
    }

    public cU() {
    }

    public final void do(int n) {
        switch (n) {
            case 1: {
                AngelChip.do();
                return;
            }
            case 2: {
                if (cU.do((Object)fO.do().do)) {
                    new bc(fO.do().do).do();
                    return;
                }
                new bc(br.do((int)do[7])).do();
            }
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public void run() {
        int n;
        block56: {
            ByteArrayOutputStream byteArrayOutputStream;
            block60: {
                FilterInputStream filterInputStream;
                block59: {
                    HttpConnection httpConnection;
                    block53: {
                        try {
                            Thread.sleep(this.if);
                            "".length();
                        }
                        catch (InterruptedException interruptedException) {
                            "".length();
                        }
                        httpConnection = null;
                        byteArrayOutputStream = null;
                        filterInputStream = null;
                        n = do[2];
                        try {
                            httpConnection = cU.do(br.do((int)do[1]));
                            if (cU.if(cU.do(httpConnection) ? 1 : 0)) {
                                n = do[2];
                                do = System.currentTimeMillis();
                                int n2 = (int)httpConnection.getLength();
                                filterInputStream = httpConnection.openDataInputStream();
                                if (cU.do(n2)) {
                                    byte[] byArray = new byte[n2];
                                    ((DataInputStream)filterInputStream).readFully(byArray);
                                    this.do(br.do((byte[])byArray));
                                    "".length();
                                    if ("   ".length() <= ((0xDC ^ 0xBA ^ (0xE5 ^ 0x97)) & (0x7F ^ 0x35 ^ (0xDA ^ 0x84) ^ -" ".length()))) {
                                        return;
                                    }
                                    break block53;
                                } else {
                                    int n3;
                                    byteArrayOutputStream = new ByteArrayOutputStream();
                                    byte[] byArray = new byte[do[39]];
                                    while (cU.if(n3 = ((DataInputStream)filterInputStream).read(byArray), do[38])) {
                                        byteArrayOutputStream.write(byArray, do[2], n3);
                                        "".length();
                                        if ("   ".length() != 0) continue;
                                        return;
                                    }
                                    byteArrayOutputStream.flush();
                                    this.do(br.do((byte[])byteArrayOutputStream.toByteArray()));
                                    "".length();
                                    if (((0x15 ^ 0x51 ^ (0x8F ^ 0x8A)) & (0xC ^ 0x7F ^ (0x25 ^ 0x17) ^ -" ".length())) != ((88 + 124 - 142 + 96 ^ 38 + 36 - 52 + 159) & (0x17 ^ 0x1A ^ (0x8C ^ 0x92) ^ -" ".length()))) {
                                        return;
                                    }
                                }
                                break block53;
                            }
                            n = do[0];
                        }
                        catch (Exception exception) {
                            block55: {
                                block54: {
                                    "".length();
                                    n = do[0];
                                    if (cU.do((Object)httpConnection)) {
                                        try {
                                            httpConnection.close();
                                            "".length();
                                        }
                                        catch (IOException iOException) {
                                            "".length();
                                            break block54;
                                        }
                                        if (((22 + 117 - 14 + 65 ^ 43 + 119 - 146 + 149) & (0xA2 ^ 0xC3 ^ (0x32 ^ 0x48) ^ -" ".length())) != 0) {
                                            return;
                                        }
                                    }
                                }
                                if (cU.do(filterInputStream)) {
                                    try {
                                        filterInputStream.close();
                                        "".length();
                                    }
                                    catch (IOException iOException) {
                                        "".length();
                                        break block55;
                                    }
                                    if ("   ".length() <= 0) {
                                        return;
                                    }
                                }
                            }
                            if (!cU.do(byteArrayOutputStream)) break block56;
                            try {
                                byteArrayOutputStream.close();
                                "".length();
                            }
                            catch (IOException iOException) {
                                "".length();
                                "".length();
                                if (" ".length() < 0) {
                                    return;
                                }
                                break block56;
                            }
                            if ("  ".length() < 0) {
                                return;
                            }
                            break block56;
                        }
                        catch (Throwable throwable) {
                            block58: {
                                block57: {
                                    if (cU.do(httpConnection)) {
                                        try {
                                            httpConnection.close();
                                            "".length();
                                        }
                                        catch (IOException iOException) {
                                            "".length();
                                            break block57;
                                        }
                                        if (" ".length() > (0x80 ^ 0x84)) {
                                            return;
                                        }
                                    }
                                }
                                if (cU.do(filterInputStream)) {
                                    try {
                                        filterInputStream.close();
                                        "".length();
                                    }
                                    catch (IOException iOException) {
                                        "".length();
                                        break block58;
                                    }
                                    if (" ".length() < 0) {
                                        return;
                                    }
                                }
                            }
                            if (!cU.do(byteArrayOutputStream)) throw throwable;
                            try {
                                byteArrayOutputStream.close();
                                "".length();
                            }
                            catch (IOException iOException) {
                                "".length();
                                throw throwable;
                            }
                            if ("  ".length() > ((0x45 ^ 0x40) & ~(0xB ^ 0xE))) throw throwable;
                            return;
                        }
                    }
                    if (cU.do((Object)httpConnection)) {
                        try {
                            httpConnection.close();
                            "".length();
                        }
                        catch (IOException iOException) {
                            "".length();
                            break block59;
                        }
                        if (" ".length() == 0) {
                            return;
                        }
                    }
                }
                if (cU.do(filterInputStream)) {
                    try {
                        filterInputStream.close();
                        "".length();
                    }
                    catch (IOException iOException) {
                        "".length();
                        break block60;
                    }
                    if ("   ".length() > (0x6D ^ 0x69)) {
                        return;
                    }
                }
            }
            if (cU.do(byteArrayOutputStream)) {
                try {
                    byteArrayOutputStream.close();
                    "".length();
                }
                catch (IOException iOException) {
                    "".length();
                    "".length();
                    if (-" ".length() >= ((0x64 ^ 0x20) & ~(0x25 ^ 0x61))) {
                        return;
                    }
                    break block56;
                }
                if ("  ".length() == 0) {
                    return;
                }
            }
        }
        if = do[2];
        if (!cU.if(n)) return;
        if (cU.do(this.if, do[7])) {
            aQ.do();
            "".length();
            aQ.int();
            fO.do().try = this.if;
            if (cU.if(bx.do instanceof aX)) {
                if (cU.if(aQ.do((long)10000L) ? 1 : 0)) {
                    aQ.if((long)250L);
                    "".length();
                    if ("   ".length() < "  ".length()) {
                        return;
                    }
                }
            } else {
                aQ.if((long)2000L);
            }
            bx.do((String)br.do((int)do[9]), (fN)this.do);
            return;
        }
        this.do();
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public cU(long l, boolean bl) {
        this.if = l;
        this.do = bl;
        this.if = do[2];
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    private static boolean for(int n, int n2) {
        return n < n2;
    }

    protected static boolean do(HttpConnection httpConnection) {
        if (cU.int(httpConnection.getResponseCode(), do[37])) {
            return do[0];
        }
        return do[2];
    }

    public void do() {
        if (cU.if(if ? 1 : 0)) {
            return;
        }
        if (cU.int(cU.do(System.currentTimeMillis() - do, 300000L))) {
            bx.case();
            return;
        }
        if = do[0];
        this.if += do[0];
        new Thread(this).start();
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static boolean int(int n, int n2) {
        return n == n2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    protected static HttpConnection do(String string, String string2) {
        string = (HttpConnection)Connector.open((String)string, (int)do[7], (boolean)do[2]);
        string.setRequestMethod("POST");
        string.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        string.setRequestProperty("User-Agent", cU.do());
        string.setRequestProperty("Content-Length", String.valueOf(string2.length()));
        string.setRequestProperty("Connection", "close");
        return string;
    }

    private static boolean for(int n) {
        return n == 0;
    }

    private static void if() {
        do = new int[63];
        cU.do[0] = " ".length();
        cU.do[1] = "  ".length();
        cU.do[2] = (0x93 ^ 0x97) & ~(0xBF ^ 0xBB);
        cU.do[3] = 104 + 136 - 237 + 136 ^ 111 + 119 - 105 + 33;
        cU.do[4] = 0xAD ^ 0xC0;
        cU.do[5] = 0x2F ^ 0x76 ^ (0x98 ^ 0xA8);
        cU.do[6] = 0x6E ^ 0xD;
        cU.do[7] = "   ".length();
        cU.do[8] = 189 + 3 - 189 + 238 ^ 115 + 78 - 169 + 107;
        cU.do[9] = "  ".length() ^ (0xA7 ^ 0xA1);
        cU.do[10] = 168 + 200 - 194 + 61 ^ 23 + 44 - -28 + 37;
        cU.do[11] = 0x28 ^ 0xC ^ (0x4B ^ 0x6A);
        cU.do[12] = 5 ^ 0x60;
        cU.do[13] = 0x1C ^ 0x1A;
        cU.do[14] = 0x66 ^ 2;
        cU.do[15] = 0xE4 ^ 0x8B ^ (0x5D ^ 0x35);
        cU.do[16] = 0x58 ^ 0x50;
        cU.do[17] = 24 + 201 - 54 + 72 ^ 30 + 113 - 61 + 53;
        cU.do[18] = 0x31 ^ 0xB ^ (0x85 ^ 0xB6);
        cU.do[19] = 0xA5 ^ 0x92 ^ (0xAF ^ 0x92);
        cU.do[20] = 0x7E ^ 0x53 ^ (0x4E ^ 0x68);
        cU.do[21] = 5 ^ 0x69 ^ "  ".length();
        cU.do[22] = 0x77 ^ 0x7B;
        cU.do[23] = 0x91 ^ 0x82 ^ (0xBE ^ 0x83);
        cU.do[24] = 0x84 ^ 0x89;
        cU.do[25] = 0xB9 ^ 0x90 ^ (0x56 ^ 0xF);
        cU.do[26] = 0x48 ^ 0x46;
        cU.do[27] = 171 + 101 - 212 + 195 ^ 115 + 46 - 113 + 99;
        cU.do[28] = 0xEA ^ 0xC7 ^ (0x36 ^ 0x14);
        cU.do[29] = 0x11 ^ 0x70;
        cU.do[30] = 0x7F ^ 0x3C ^ (0x7A ^ 0x29);
        cU.do[31] = 0xBA ^ 0xAB;
        cU.do[32] = 0xEE ^ 0x88;
        cU.do[33] = 0xB1 ^ 0xA3;
        cU.do[34] = 187 + 90 - 268 + 180 ^ 114 + 108 - 85 + 37;
        cU.do[35] = 69 + 70 - 0 + 27 ^ 66 + 2 - -41 + 69;
        cU.do[36] = 0x6E ^ 0x47;
        cU.do[37] = 24 + 48 - 70 + 173 + (130 + 133 - 94 + 17) - (67 + 206 - 77 + 12) + (0x81 ^ 0xAE);
        cU.do[38] = -" ".length();
        cU.do[39] = -(0xFFFFEDDE & 0x5AE7) & (0xFFFFDDCF & 0x6EF5);
        cU.do[40] = 0x44 ^ 0x10;
        cU.do[41] = 0 + 1 - -30 + 98;
        cU.do[42] = 0xDF ^ 0xBE ^ (0xA ^ 0x11);
        cU.do[43] = 0x3C ^ 0x44;
        cU.do[44] = 46 + 10 - 23 + 94;
        cU.do[45] = 0x26 ^ 0x65 ^ (0x2C ^ 0x39);
        cU.do[46] = 0x31 ^ 0x4A;
        cU.do[47] = 0x34 ^ 0x48;
        cU.do[48] = 124 + 4 - 65 + 68;
        cU.do[49] = 0xB5 ^ 0x9C ^ (0x72 ^ 0x19);
        cU.do[50] = 0xB ^ 0x4F;
        cU.do[51] = 74 + 193 - 181 + 111 ^ 123 + 1 - 18 + 31;
        cU.do[52] = 0x95 ^ 0xA0 ^ (0x76 ^ 2);
        cU.do[53] = 0xD6 ^ 0x95;
        cU.do[54] = 0x60 ^ 0x53;
        cU.do[55] = 0x4E ^ 0x68 ^ (0x46 ^ 0x5B);
        cU.do[56] = 0xEC ^ 0xC6;
        cU.do[57] = 0x75 ^ 0x6A ^ (0x13 ^ 0x41);
        cU.do[58] = 0x7B ^ 6;
        cU.do[59] = 0x6C ^ 0x12;
        cU.do[60] = 0x70 ^ 9;
        cU.do[61] = 0x71 ^ 6;
        cU.do[62] = 0x10 ^ 0x29;
    }

    private static boolean int(int n) {
        return n < 0;
    }

    private void do(DataInputStream dataInputStream) {
        switch (dataInputStream.readByte()) {
            case 0: {
                String string = dataInputStream.readUTF();
                aQ.do();
                "".length();
                aQ.int();
                fO.do().try = this.if;
                if (cU.if(bx.do instanceof aX)) {
                    if = do[2];
                    if (cU.if(aQ.do((long)10000L) ? 1 : 0)) {
                        aQ.if((long)250L);
                        "".length();
                        if (null != null) {
                            return;
                        }
                    }
                } else {
                    aQ.if((long)2000L);
                }
                aQ.if((String)string, (fN)gs.do().do, (fN)this.do);
                return;
            }
            case 1: {
                String string = dataInputStream.readUTF();
                String string2 = dataInputStream.readUTF();
                String string3 = dataInputStream.readUTF();
                cs.do((DataInputStream)dataInputStream);
                br.do((DataInputStream)dataInputStream);
                aQ.do = dataInputStream.readUTF();
                bS.do[cU.do[11]] = dataInputStream.readByte();
                bS.do[cU.do[26]] = dataInputStream.readByte();
                bS.do[cU.do[28]] = dataInputStream.readByte();
                bS.do[cU.do[30]] = dataInputStream.readByte();
                int n = do[2];
                while (cU.for(n, az.do.length)) {
                    az.do[n] = dataInputStream.readUTF();
                    ++n;
                    "".length();
                    if (null == null) continue;
                    return;
                }
                az.do = dataInputStream.readByte();
                aQ.do = dataInputStream.readByte();
                fO.do = dataInputStream.readByte();
                ah.do = dataInputStream.readInt();
                fQ.do[cU.do[2]] = new int[dataInputStream.readByte()];
                n = do[2];
                while (cU.for(n, fQ.do[do[2]].length)) {
                    fQ.do[cU.do[2]][n] = dataInputStream.readByte();
                    ++n;
                    "".length();
                    if (((115 + 116 - 169 + 145 ^ 57 + 165 - 207 + 157) & (0x14 ^ 0x31 ^ (0x50 ^ 0x16) ^ -" ".length())) < " ".length()) continue;
                    return;
                }
                fQ.do[cU.do[0]] = new int[dataInputStream.readByte()];
                n = do[2];
                while (cU.for(n, fQ.do[do[0]].length)) {
                    fQ.do[cU.do[0]][n] = dataInputStream.readByte();
                    ++n;
                    "".length();
                    if (-"  ".length() <= 0) continue;
                    return;
                }
                fQ.do[cU.do[1]] = new int[dataInputStream.readByte()];
                n = do[2];
                while (cU.for(n, fQ.do[do[1]].length)) {
                    fQ.do[cU.do[1]][n] = dataInputStream.readByte();
                    ++n;
                    "".length();
                    if ("   ".length() != ((0x90 ^ 0xB9 ^ "  ".length()) & (0x16 ^ 0x25 ^ (0x77 ^ 0x6F) ^ -" ".length()))) continue;
                    return;
                }
                fQ.do[cU.do[7]] = new int[dataInputStream.readByte()];
                n = do[2];
                while (cU.for(n, fQ.do[do[7]].length)) {
                    fQ.do[cU.do[7]][n] = dataInputStream.readByte();
                    ++n;
                    "".length();
                    if ((99 + 18 - 102 + 150 ^ 33 + 62 - 30 + 96) != " ".length()) continue;
                    return;
                }
                if (cU.for(an.do.isEmpty() ? 1 : 0)) {
                    an.do.removeAllElements();
                }
                n = dataInputStream.readByte();
                int n2 = do[2];
                while (cU.for(n2, n)) {
                    an.do.addElement(new gm(dataInputStream.readInt(), dataInputStream.readUTF()));
                    ++n2;
                    "".length();
                    if ("  ".length() >= " ".length()) continue;
                    return;
                }
                do = string + aQ.do;
                if (cU.if(bx.do instanceof fO)) {
                    fO.do().try = fO.do().do;
                    fO.do().new = fO.do().if;
                }
                if (cU.if(this.do ? 1 : 0) && cU.do(string2.length())) {
                    if (cU.if(bx.do instanceof aX)) {
                        if = do[2];
                        if (cU.if(aQ.do((long)10000L) ? 1 : 0)) {
                            aQ.if((long)250L);
                        }
                    }
                    bx.do.do(string2, new fN(string3, do[38]), null);
                    "".length();
                    if ((0xA7 ^ 0xA3) < 0) {
                        return;
                    }
                } else {
                    bx.case();
                }
                if (!cU.do(bX.do) || !cU.if(bX.do instanceof bS)) break;
                bS.do();
                "".length();
                bS.try();
                return;
            }
            case 2: {
                String string = dataInputStream.readUTF();
                String string4 = dataInputStream.readUTF();
                String string5 = dataInputStream.readUTF();
                String string6 = dataInputStream.readUTF();
                fO.do().do = dataInputStream.readUTF();
                cs.do((DataInputStream)dataInputStream);
                br.do((DataInputStream)dataInputStream);
                aQ.do = dataInputStream.readUTF();
                bS.do[cU.do[11]] = dataInputStream.readByte();
                bS.do[cU.do[26]] = dataInputStream.readByte();
                bS.do[cU.do[28]] = dataInputStream.readByte();
                bS.do[cU.do[30]] = dataInputStream.readByte();
                int n = do[2];
                while (cU.for(n, az.do.length)) {
                    az.do[n] = dataInputStream.readUTF();
                    ++n;
                    "".length();
                    if (((0x32 ^ 0x63) & ~(0x1D ^ 0x4C)) == 0) continue;
                    return;
                }
                az.do = dataInputStream.readByte();
                aQ.do = dataInputStream.readByte();
                fO.do = dataInputStream.readByte();
                ah.do = dataInputStream.readInt();
                fQ.do[cU.do[2]] = new int[dataInputStream.readByte()];
                n = do[2];
                while (cU.for(n, fQ.do[do[2]].length)) {
                    fQ.do[cU.do[2]][n] = dataInputStream.readByte();
                    ++n;
                    "".length();
                    if (null == null) continue;
                    return;
                }
                fQ.do[cU.do[0]] = new int[dataInputStream.readByte()];
                n = do[2];
                while (cU.for(n, fQ.do[do[0]].length)) {
                    fQ.do[cU.do[0]][n] = dataInputStream.readByte();
                    ++n;
                    "".length();
                    if (" ".length() == " ".length()) continue;
                    return;
                }
                fQ.do[cU.do[1]] = new int[dataInputStream.readByte()];
                n = do[2];
                while (cU.for(n, fQ.do[do[1]].length)) {
                    fQ.do[cU.do[1]][n] = dataInputStream.readByte();
                    ++n;
                    "".length();
                    if (null == null) continue;
                    return;
                }
                fQ.do[cU.do[7]] = new int[dataInputStream.readByte()];
                n = do[2];
                while (cU.for(n, fQ.do[do[7]].length)) {
                    fQ.do[cU.do[7]][n] = dataInputStream.readByte();
                    ++n;
                    "".length();
                    if (-(0x78 ^ 0x54 ^ (0x39 ^ 0x11)) <= 0) continue;
                    return;
                }
                if (cU.for(an.do.isEmpty() ? 1 : 0)) {
                    an.do.removeAllElements();
                }
                n = dataInputStream.readByte();
                int n3 = do[2];
                while (cU.for(n3, n)) {
                    an.do.addElement(new gm(dataInputStream.readInt(), dataInputStream.readUTF()));
                    ++n3;
                    "".length();
                    if (-" ".length() <= (3 ^ 7)) continue;
                    return;
                }
                do = string + aQ.do;
                if (cU.if(bx.do instanceof fO)) {
                    fO.do().try = fO.do().do;
                    fO.do().new = fO.do().if;
                }
                if (cU.if(this.do ? 1 : 0) && cU.do(string4.length())) {
                    if (cU.if(bx.do instanceof aX)) {
                        if = do[2];
                        if (cU.if(aQ.do((long)10000L) ? 1 : 0)) {
                            aQ.if((long)250L);
                        }
                    }
                    bx.do((String)string4, (fN)new fN(string5, do[1], (dH)this), (fN)new fN(string6, do[38]));
                    "".length();
                    if ((0x97 ^ 0x92) == 0) {
                        return;
                    }
                } else {
                    bx.case();
                }
                if (!cU.do(bX.do) || !cU.if(bX.do instanceof bS)) break;
                bS.do();
                "".length();
                bS.try();
                return;
            }
            case 3: {
                String string = dataInputStream.readUTF();
                String string7 = dataInputStream.readUTF();
                aQ.do();
                "".length();
                aQ.int();
                fO.do().do = dataInputStream.readUTF();
                aD.do = null;
                aD.do().do(new Hashtable(), string, string7, do[38]);
                if (cU.if(bx.do instanceof aX)) {
                    if = do[2];
                    if (cU.if(aQ.do((long)10000L) ? 1 : 0)) {
                        aQ.if((long)250L);
                        "".length();
                        if (((22 + 115 - 23 + 14 ^ 135 + 136 - 115 + 29) & (0x26 ^ 0x64 ^ (0x25 ^ 0x5E) ^ -" ".length())) > 0) {
                            return;
                        }
                    }
                } else {
                    aQ.if((long)2000L);
                }
                bx.case();
                bx.do = aD.do();
                aD.do().try = this.if;
                aD.do().int = this.do;
                return;
            }
            case -1: {
                String string = dataInputStream.readUTF();
                aQ.do();
                "".length();
                aQ.int();
                fO.do().try = this.if;
                if (cU.if(bx.do instanceof aX)) {
                    if = do[2];
                    if (cU.if(aQ.do((long)10000L) ? 1 : 0)) {
                        aQ.if((long)250L);
                        "".length();
                        if (-(0xAC ^ 0xA8) >= 0) {
                            return;
                        }
                    }
                } else {
                    aQ.if((long)2000L);
                }
                bx.do((String)string, (fN)this.do);
            }
        }
    }

    static {
        cU.if();
        if = do[2];
        int[] nArray = new int[do[35]];
        nArray[cU.do[2]] = do[40];
        nArray[cU.do[0]] = do[41];
        nArray[cU.do[1]] = do[42];
        nArray[cU.do[7]] = do[43];
        nArray[cU.do[9]] = do[44];
        nArray[cU.do[11]] = do[45];
        nArray[cU.do[13]] = do[46];
        nArray[cU.do[15]] = do[47];
        nArray[cU.do[16]] = do[48];
        nArray[cU.do[18]] = do[49];
        nArray[cU.do[19]] = do[50];
        nArray[cU.do[20]] = do[51];
        nArray[cU.do[22]] = do[52];
        nArray[cU.do[24]] = do[53];
        nArray[cU.do[26]] = do[52];
        nArray[cU.do[28]] = do[50];
        nArray[cU.do[30]] = do[50];
        nArray[cU.do[31]] = do[54];
        nArray[cU.do[33]] = do[55];
        nArray[cU.do[34]] = do[16];
        for = aQ.do((int[])nArray);
        int[] nArray2 = new int[do[20]];
        nArray2[cU.do[2]] = do[56];
        nArray2[cU.do[0]] = do[57];
        nArray2[cU.do[1]] = do[44];
        nArray2[cU.do[7]] = do[58];
        nArray2[cU.do[9]] = do[59];
        nArray2[cU.do[11]] = do[60];
        nArray2[cU.do[13]] = do[61];
        nArray2[cU.do[15]] = do[10];
        nArray2[cU.do[16]] = do[47];
        nArray2[cU.do[18]] = do[62];
        nArray2[cU.do[19]] = do[18];
        if = aQ.do((int[])nArray2);
        do = 0L;
    }
}
