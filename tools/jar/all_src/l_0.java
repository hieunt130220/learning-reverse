/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.io.HttpConnection
 */
import java.io.DataInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.util.Hashtable;
import javax.microedition.io.HttpConnection;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from l
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class l_0
extends cU {
    private byte[] do;
    public static boolean do;
    private static final int[] do;

    private int[][] do(String object) {
        byte[] byArray = es_0.do((String)object);
        object = this;
        int n = ((l_0)object).do.length;
        int n2 = do[0];
        while (l_0.if(n2, byArray.length)) {
            int n3 = n2;
            byArray[n3] = (byte)(byArray[n3] ^ ((l_0)object).do[n2 % n]);
            ++n2;
            "".length();
            if ("   ".length() == "   ".length()) continue;
            return null;
        }
        return bs_0.do(byArray);
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void run() {
        int n;
        block40: {
            n = do[0];
            if (l_0.do((Object)aq_0.do) && l_0.if(aq_0.do.length())) {
                FilterInputStream filterInputStream;
                HttpConnection httpConnection;
                block39: {
                    this.do = cU.do.getBytes();
                    httpConnection = null;
                    filterInputStream = null;
                    try {
                        httpConnection = l_0.do(aq_0.do(br_0.do(br_0.do)));
                        if (l_0.do(l_0.do(httpConnection) ? 1 : 0)) {
                            n = do[0];
                            filterInputStream = httpConnection.openDataInputStream();
                            Object object = filterInputStream;
                            l_0 l_02 = this;
                            switch (((DataInputStream)object).readByte()) {
                                case 0: {
                                    object = ((DataInputStream)object).readUTF();
                                    aq_0.do();
                                    "".length();
                                    aq_0.int();
                                    fo_0.do().try = l_02.if;
                                    aq_0.if(1000L);
                                    aq_0.if((String)object, gs_0.do().do, ((cU)l_02).do);
                                    "".length();
                                    if ("   ".length() >= (137 + 123 - 239 + 140 ^ 89 + 163 - 110 + 23)) {
                                        return;
                                    }
                                    break block39;
                                }
                                case 1: {
                                    int n2 = ((DataInputStream)object).readInt();
                                    bs_0.do[l_0.do[0]] = new int[n2][][];
                                    n2 = do[0];
                                    while (l_0.if(n2, bs_0.do[do[0]].length)) {
                                        bs_0.do[l_0.do[0]][n2] = l_02.do(((DataInputStream)object).readUTF());
                                        ++n2;
                                        "".length();
                                        if (((1 ^ 0x1D) & ~(0x25 ^ 0x39)) >= -" ".length()) continue;
                                        return;
                                    }
                                    n2 = ((DataInputStream)object).readInt();
                                    bs_0.do[l_0.do[1]] = new int[n2][][];
                                    n2 = do[0];
                                    while (l_0.if(n2, bs_0.do[do[1]].length)) {
                                        bs_0.do[l_0.do[1]][n2] = l_02.do(((DataInputStream)object).readUTF());
                                        ++n2;
                                        "".length();
                                        if (" ".length() != 0) continue;
                                        return;
                                    }
                                    n2 = ((DataInputStream)object).readInt();
                                    bs_0.do[l_0.do[3]] = new int[n2][][];
                                    n2 = do[0];
                                    while (l_0.if(n2, bs_0.do[do[3]].length)) {
                                        bs_0.do[l_0.do[3]][n2] = l_02.do(((DataInputStream)object).readUTF());
                                        ++n2;
                                        "".length();
                                        if (-"   ".length() <= 0) continue;
                                        return;
                                    }
                                    n2 = ((DataInputStream)object).readInt();
                                    bs_0.do[l_0.do[4]] = new int[n2][][];
                                    n2 = do[0];
                                    while (l_0.if(n2, bs_0.do[do[4]].length)) {
                                        bs_0.do[l_0.do[4]][n2] = l_02.do(((DataInputStream)object).readUTF());
                                        ++n2;
                                        "".length();
                                    }
                                    bs_0.do();
                                    "".length();
                                    if (l_0.do(bs_0.do() ? 1 : 0)) {
                                        aq_0.do();
                                        "".length();
                                        aq_0.int();
                                        fo_0.do().try = l_02.if;
                                        aq_0.if(1000L);
                                        bx.do(br_0.do(do[2]), ((cU)l_02).do);
                                        "".length();
                                        break block39;
                                    } else {
                                        bx.case();
                                        "".length();
                                        if (" ".length() == 0) {
                                            return;
                                        }
                                    }
                                    break block39;
                                }
                                case -1: {
                                    String string = ((DataInputStream)object).readUTF();
                                    aq_0.do();
                                    "".length();
                                    aq_0.int();
                                    fo_0.do().try = l_02.if;
                                    aq_0.if(1000L);
                                    bx.do(string, ((cU)l_02).do);
                                    "".length();
                                    break block39;
                                }
                                case 3: {
                                    String string = ((DataInputStream)object).readUTF();
                                    String string2 = ((DataInputStream)object).readUTF();
                                    aq_0.do();
                                    "".length();
                                    aq_0.int();
                                    fo_0.do().do = ((DataInputStream)object).readUTF();
                                    ad_0.do = null;
                                    ad_0.do().do(new Hashtable(), string, string2, do[5]);
                                    aq_0.if(1000L);
                                    bx.case();
                                    bx.do = ad_0.do();
                                    ad_0.do().try = (int)l_02.if;
                                    ad_0.do().int = (int)((cU)l_02).do;
                                }
                                default: {
                                    "".length();
                                    if ((((0xF3 ^ 0xB2) & ~(0xD5 ^ 0x94) ^ (0x63 ^ 0x43)) & (0x43 ^ 0x7F ^ (0x87 ^ 0x9B) ^ -" ".length())) != ((0x88 ^ 0xC3 ^ (0x3F ^ 0x55)) & (0xA4 ^ 0xA2 ^ (0x3B ^ 0x1C) ^ -" ".length()))) {
                                        return;
                                    }
                                    break block39;
                                }
                            }
                        }
                        n = do[1];
                    }
                    catch (Exception exception) {
                        "".length();
                        n = do[1];
                        try {
                            if (l_0.do((Object)httpConnection)) {
                                httpConnection.close();
                            }
                            if (l_0.do(filterInputStream)) {
                                filterInputStream.close();
                            }
                            "".length();
                        }
                        catch (IOException iOException) {
                            "".length();
                            "".length();
                            if (-" ".length() < -" ".length()) {
                                return;
                            }
                            break block40;
                        }
                        if (-" ".length() > 0) {
                            return;
                        }
                        break block40;
                    }
                    catch (Throwable throwable) {
                        try {
                            if (l_0.do(httpConnection)) {
                                httpConnection.close();
                            }
                            if (l_0.do(filterInputStream)) {
                                filterInputStream.close();
                            }
                            "".length();
                        }
                        catch (IOException iOException) {
                            "".length();
                            throw throwable;
                        }
                        if (((74 + 38 - 17 + 75 ^ 10 + 72 - -92 + 2) & (26 + 125 - 81 + 113 ^ 86 + 2 - 74 + 159 ^ -" ".length()) & ((77 + 12 - 8 + 165 ^ 68 + 50 - 72 + 104) & (187 + 34 - -20 + 10 ^ 139 + 126 - 224 + 114 ^ -" ".length()) ^ -" ".length())) >= 0) throw throwable;
                        return;
                    }
                }
                try {
                    if (l_0.do((Object)httpConnection)) {
                        httpConnection.close();
                    }
                    if (l_0.do(filterInputStream)) {
                        filterInputStream.close();
                    }
                    "".length();
                }
                catch (IOException iOException) {
                    "".length();
                    "".length();
                    if (-" ".length() == " ".length()) {
                        return;
                    }
                    break block40;
                }
                if (" ".length() != " ".length()) {
                    return;
                }
            }
        }
        do = do[0];
        System.gc();
        if (!l_0.do(n)) return;
        if (l_0.do(this.if, do[4])) {
            aq_0.do();
            "".length();
            aq_0.int();
            fo_0.do().try = this.if;
            aq_0.if(1000L);
            bx.do(br_0.do(do[2]), ((cU)this).do);
            return;
        }
        bs_0.do = new int[do[2]][][][];
        this.do();
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    static {
        l_0.if();
        do = do[0];
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private static void if() {
        do = new int[6];
        l_0.do[0] = (0xF1 ^ 0xB8 ^ (0x12 ^ 0x7F)) & (0x70 ^ 0x65 ^ (0x6D ^ 0x5C) ^ -" ".length());
        l_0.do[1] = " ".length();
        l_0.do[2] = 0x9A ^ 0x9E;
        l_0.do[3] = "  ".length();
        l_0.do[4] = "   ".length();
        l_0.do[5] = -" ".length();
    }

    public l_0() {
        this.if = do[0];
    }

    public final void do() {
        if (l_0.do(do ? 1 : 0)) {
            return;
        }
        bs_0.do();
        "".length();
        if (l_0.do(bs_0.do() ? 1 : 0)) {
            this.if += do[1];
            do = do[1];
            bs_0.do = new int[do[2]][][][];
            new Thread(this).start();
        }
    }
}

