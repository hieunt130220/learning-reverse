/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.io.HttpConnection
 */
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.util.Hashtable;
import javax.microedition.io.HttpConnection;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from eQ
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class eq_0
extends cU {
    private final byte do;
    private static final int[] do;
    private static boolean do;

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    public final void do() {
        if (eq_0.do(do ? 1 : 0)) {
            return;
        }
        if (eq_0.do(this.do) && eq_0.if(this.do, do[1])) {
            return;
        }
        do = do[1];
        this.if += do[1];
        new Thread(this).start();
    }

    private static boolean do(int n) {
        return n != 0;
    }

    public eq_0(byte by2) {
        this.if = do[0];
        this.do = by2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean if(int n) {
        return n == 0;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void run() {
        int n;
        block45: {
            aq_0.if(50L);
            n = do[0];
            if (eq_0.do((Object)aq_0.do) && eq_0.for(aq_0.do.length())) {
                HttpConnection httpConnection = null;
                ByteArrayOutputStream byteArrayOutputStream = null;
                FilterInputStream filterInputStream = null;
                try {
                    httpConnection = cU.do(aq_0.do(br_0.do(br_0.do + do[2]) + this.do));
                    if (eq_0.do(cU.do(httpConnection) ? 1 : 0)) {
                        n = do[0];
                        int n2 = (int)httpConnection.getLength();
                        filterInputStream = httpConnection.openDataInputStream();
                        if (eq_0.for(n2)) {
                            byte[] byArray = new byte[n2];
                            ((DataInputStream)filterInputStream).readFully(byArray);
                            this.do(br_0.do(byArray));
                            "".length();
                            if ("  ".length() == 0) {
                                return;
                            }
                        } else {
                            int n3;
                            byteArrayOutputStream = new ByteArrayOutputStream();
                            byte[] byArray = new byte[do[3]];
                            while (eq_0.if(n3 = ((DataInputStream)filterInputStream).read(byArray), do[4])) {
                                byteArrayOutputStream.write(byArray, do[0], n3);
                                "".length();
                                if ((120 + 104 - 190 + 95 ^ 12 + 128 - 125 + 118) > " ".length()) continue;
                                return;
                            }
                            byteArrayOutputStream.flush();
                            this.do(br_0.do(byteArrayOutputStream.toByteArray()));
                        }
                        ah.int();
                        bx.case();
                        "".length();
                    } else {
                        n = do[1];
                    }
                }
                catch (Exception exception) {
                    block44: {
                        "".length();
                        n = do[1];
                        if (eq_0.do(httpConnection)) {
                            try {
                                httpConnection.close();
                                "".length();
                            }
                            catch (IOException iOException) {
                                "".length();
                            }
                        }
                        if (eq_0.do(filterInputStream)) {
                            try {
                                filterInputStream.close();
                                "".length();
                            }
                            catch (IOException iOException) {
                                "".length();
                                break block44;
                            }
                            if (((0xA9 ^ 0xB8 ^ (0xE ^ 0x7F)) & (0xA ^ 0xC ^ (0x72 ^ 0x14) ^ -" ".length())) != 0) {
                                return;
                            }
                        }
                    }
                    if (!eq_0.do(byteArrayOutputStream)) break block45;
                    try {
                        byteArrayOutputStream.close();
                        "".length();
                    }
                    catch (IOException iOException) {
                        "".length();
                        "".length();
                        if (-" ".length() != -" ".length()) {
                            return;
                        }
                        break block45;
                    }
                    if (((0xF1 ^ 0xB6) & ~(0xC8 ^ 0x8F)) < -" ".length()) {
                        return;
                    }
                    break block45;
                }
                catch (Throwable throwable) {
                    block47: {
                        block46: {
                            if (eq_0.do(httpConnection)) {
                                try {
                                    httpConnection.close();
                                    "".length();
                                }
                                catch (IOException iOException) {
                                    "".length();
                                    break block46;
                                }
                                if (-"  ".length() > 0) {
                                    return;
                                }
                            }
                        }
                        if (eq_0.do(filterInputStream)) {
                            try {
                                filterInputStream.close();
                                "".length();
                            }
                            catch (IOException iOException) {
                                "".length();
                                break block47;
                            }
                            if (((0x1C ^ 0x7F ^ (1 ^ 0x6F)) & (0xE6 ^ 0xAE ^ (0xE3 ^ 0xA6) ^ -" ".length())) > " ".length()) {
                                return;
                            }
                        }
                    }
                    if (!eq_0.do(byteArrayOutputStream)) throw throwable;
                    try {
                        byteArrayOutputStream.close();
                        "".length();
                    }
                    catch (IOException iOException) {
                        "".length();
                        throw throwable;
                    }
                    if (((0x94 ^ 0x98) & ~(0x49 ^ 0x45)) < " ".length()) throw throwable;
                    return;
                }
                if (eq_0.do((Object)httpConnection)) {
                    try {
                        httpConnection.close();
                        "".length();
                    }
                    catch (IOException iOException) {
                        "".length();
                    }
                }
                if (eq_0.do(filterInputStream)) {
                    try {
                        filterInputStream.close();
                        "".length();
                    }
                    catch (IOException iOException) {
                        "".length();
                    }
                }
                if (eq_0.do(byteArrayOutputStream)) {
                    try {
                        byteArrayOutputStream.close();
                        "".length();
                    }
                    catch (IOException iOException) {
                        "".length();
                        "".length();
                    }
                }
            }
        }
        do = do[0];
        if (!eq_0.do(n)) return;
        if (eq_0.do(this.if, do[5])) {
            aq_0.do();
            "".length();
            aq_0.int();
            fo_0.do().try = this.if;
            aq_0.if(1000L);
            bx.do(br_0.do(do[6]), ((cU)this).do);
            return;
        }
        this.do();
    }

    private static boolean for(int n) {
        return n > 0;
    }

    private void do(DataInputStream object) {
        switch (((DataInputStream)object).readByte()) {
            case 0: {
                object = ((DataInputStream)object).readUTF();
                aq_0.do();
                "".length();
                aq_0.int();
                fo_0.do().try = this.if;
                aq_0.if(1000L);
                aq_0.if((String)object, gs_0.do().do, ((cU)this).do);
                return;
            }
            case 1: {
                int n = ((DataInputStream)object).readInt();
                if (!eq_0.for(n)) break;
                int n2 = do[0];
                while (eq_0.int(n2, n)) {
                    String[] stringArray = aq_0.do(((DataInputStream)object).readUTF(), "|");
                    if (eq_0.do(stringArray)) {
                        if (eq_0.if(this.do)) {
                            if (eq_0.for(stringArray.length, do[7]) && eq_0.if(stringArray[do[0]].equals("") ? 1 : 0) && eq_0.if(stringArray[do[1]].equals("") ? 1 : 0)) {
                                String[] stringArray2 = new String[do[7]];
                                stringArray2[eq_0.do[0]] = stringArray[do[1]];
                                stringArray2[eq_0.do[1]] = null;
                                ah.do.addElement(new af_0(stringArray[do[0]], stringArray2));
                                "".length();
                                if ((0x1D ^ 0x13 ^ (0x49 ^ 0x43)) != (0x17 ^ 0x45 ^ (0x18 ^ 0x4E))) {
                                    return;
                                }
                            }
                        } else if (eq_0.for(this.do, do[1]) && eq_0.for(stringArray.length, do[5]) && eq_0.if(stringArray[do[0]].equals("") ? 1 : 0) && eq_0.if(stringArray[do[1]].equals("") ? 1 : 0) && eq_0.if(stringArray[do[7]].equals("") ? 1 : 0)) {
                            String[] stringArray3 = new String[do[7]];
                            stringArray3[eq_0.do[0]] = stringArray[do[1]];
                            stringArray3[eq_0.do[1]] = stringArray[do[7]];
                            ah.if.addElement(new af_0(stringArray[do[0]], stringArray3));
                        }
                    }
                    ++n2;
                    "".length();
                    if (-" ".length() < 0) continue;
                    return;
                }
                System.gc();
                return;
            }
            case -1: {
                String string = ((DataInputStream)object).readUTF();
                aq_0.do();
                "".length();
                aq_0.int();
                fo_0.do().try = this.if;
                aq_0.if(1000L);
                bx.do(string, ((cU)this).do);
                return;
            }
            case 3: {
                String string = ((DataInputStream)object).readUTF();
                String string2 = ((DataInputStream)object).readUTF();
                aq_0.do();
                "".length();
                aq_0.int();
                fo_0.do().do = ((DataInputStream)object).readUTF();
                ad_0.do = null;
                ad_0.do().do(new Hashtable(), string, string2, do[4]);
                aq_0.if(1000L);
                bx.case();
                bx.do = ad_0.do();
                ad_0.do().try = (int)this.if;
                ad_0.do().int = (int)((cU)this).do;
            }
        }
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    static {
        eq_0.if();
        do = do[0];
    }

    private static boolean for(int n, int n2) {
        return n == n2;
    }

    private static void if() {
        do = new int[8];
        eq_0.do[0] = (0x8A ^ 0xBF) & ~(0xB4 ^ 0x81);
        eq_0.do[1] = " ".length();
        eq_0.do[2] = 0xCA ^ 0xC5 ^ "   ".length();
        eq_0.do[3] = -(0xFFFFEFF5 & 0x7FBB) & (0xFFFFFFFD & 0x7FB2);
        eq_0.do[4] = -" ".length();
        eq_0.do[5] = "   ".length();
        eq_0.do[6] = 0x62 ^ 0xE ^ (0x46 ^ 0x2E);
        eq_0.do[7] = "  ".length();
    }

    private static boolean int(int n, int n2) {
        return n < n2;
    }
}

