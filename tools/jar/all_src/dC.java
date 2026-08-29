/*
 * Decompiled with CFR 0.152.
 */
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class dC
extends hc {
    private static int if;
    private static boolean do;
    private static int for;
    public static float do;
    public static float if;
    private static byte do;
    private static long do;
    public static int do;
    private static float for;
    private static final int[] do;

    private static boolean do(int n) {
        return n < 0;
    }

    private static void try() {
        for = if;
        if = do[0];
        do = (byte)do[0];
        for = do[0];
        do = do[1];
        do = do[0];
    }

    private static boolean if(int n) {
        return n != 0;
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    private static boolean for(int n) {
        return n > 0;
    }

    private static boolean int(int n) {
        return n == 0;
    }

    /*
     * Loose catch block
     */
    static {
        block11: {
            dC.byte();
            do = do[1];
            for = do[0];
            do = (byte)do[0];
            if = 10000.0f;
            do = 2.1f;
            do = do[0];
            do = 0L;
            Object object = cs.do("TXSettings");
            if (!dC.do(object)) break block11;
            object = new ByteArrayInputStream((byte[])object);
            DataInputStream dataInputStream = new DataInputStream((InputStream)object);
            if = dataInputStream.readInt();
            do = dataInputStream.readFloat();
            try {
                dataInputStream.close();
                ((ByteArrayInputStream)object).close();
            }
            catch (IOException iOException) {
                "".length();
            }
            break block11;
            catch (IOException iOException) {
                "".length();
                cs.do("TXSettings");
                try {
                    dataInputStream.close();
                    ((ByteArrayInputStream)object).close();
                }
                catch (IOException iOException2) {
                    "".length();
                }
                catch (Throwable throwable) {
                    try {
                        dataInputStream.close();
                        ((ByteArrayInputStream)object).close();
                        "".length();
                    }
                    catch (IOException iOException3) {
                        "".length();
                    }
                    if ("  ".length() <= 0) {
                        break block11;
                    }
                    throw throwable;
                }
            }
        }
    }

    public final void do(int n, String string) {
        eh eh2;
        if (!dC.do(bx_0.do) || dC.int(bx_0.do instanceof dC)) {
            return;
        }
        if (dC.int(do, do[1]) && dC.do(eh2 = fj.do(n)) && dC.if(eh2.do.equals("than.tai.xiu") ? 1 : 0)) {
            do = n;
        }
        switch (for) {
            case 0: {
                if (dC.if(string.startsWith("V\u00e1n \u0111ang di\u1ec5n ra") ? 1 : 0)) {
                    for = do[2];
                    do = do[0];
                    return;
                }
                if (!dC.int(do ? 1 : 0)) break;
                for = do[3];
                return;
            }
            case 1: {
                if (!dC.if(string.startsWith("K\u1ebft qu\u1ea3") ? 1 : 0)) break;
                int n2 = string.lastIndexOf((do = do[3])[4]);
                String string2 = string.substring(n2 + do[2]);
                if (dC.if(string2.equalsIgnoreCase("X\u1ec9u") ? 1 : 0)) {
                    if (dC.int(do, do[2])) {
                        if = do[0];
                        for = if;
                        "".length();
                        if (" ".length() >= "  ".length()) {
                            return;
                        }
                    } else if (dC.int(do, do[3])) {
                        if += do[3];
                    }
                    do = (byte)do[2];
                    "".length();
                    if ((73 + 35 - 95 + 128 ^ 28 + 2 - -19 + 88) <= "   ".length()) {
                        return;
                    }
                } else if (dC.if(string2.equalsIgnoreCase("T\u00e0i") ? 1 : 0)) {
                    if (dC.int(do, do[3])) {
                        if = do[0];
                        for = if;
                        "".length();
                        if (((0x8E ^ 0xC1) & ~(0x7F ^ 0x30)) != ((0x74 ^ 0x21) & ~(0x5B ^ 0xE))) {
                            return;
                        }
                    } else if (dC.int(do, do[2])) {
                        if += do[3];
                    }
                    do = (byte)do[3];
                    "".length();
                    if (null != null) {
                        return;
                    }
                } else {
                    do = (byte)do[0];
                }
                if (dC.for(if)) {
                    for *= do;
                }
                for = do[0];
            }
        }
    }

    private static boolean if(int n, int n2) {
        return n <= n2;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    public static void new() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        dataOutputStream.writeInt((int)if);
        dataOutputStream.writeFloat(do);
        dataOutputStream.flush();
        byteArrayOutputStream.flush();
        cs.do("TXSettings", byteArrayOutputStream.toByteArray());
        byteArrayOutputStream.close();
        dataOutputStream.close();
    }

    private static int do(float f, float f2) {
        return f == f2 ? 0 : (f > f2 ? 1 : -1);
    }

    public dC() {
        dC.try();
    }

    private static void byte() {
        do = new int[13];
        dC.do[0] = (21 + 18 - -99 + 96 ^ 42 + 21 - 32 + 154) & (0x1F ^ 0x41 ^ (0xAA ^ 0xA7) ^ -" ".length());
        dC.do[1] = -" ".length();
        dC.do[2] = "  ".length();
        dC.do[3] = " ".length();
        dC.do[4] = 0xAC ^ 0x87 ^ (0xA8 ^ 0xB9);
        dC.do[5] = 0x55 ^ 0x73 ^ (0xB4 ^ 0x97);
        dC.do[6] = 0xCE ^ 0xC7;
        dC.do[7] = 0x3D ^ 0x35;
        dC.do[8] = 0xFFFF9994 & 0x676F;
        dC.do[9] = 0xFD ^ 0xC6 ^ (0x16 ^ 0x55);
        dC.do[10] = -(0xFFFFFE8D & 0x397F) & (0xFFFFFBFD & 0xFF5E);
        dC.do[11] = -(0xFFFFC95F & 0x7EEB) & (0xFFFFDD5E & 0x7735FEEB);
        dC.do[12] = 0xB6 ^ 0xA2;
    }

    public final synchronized void if() {
        if (dC.for(dC.do(System.currentTimeMillis() - this.try, 180000L))) {
            aq_0.else();
            aq_0.do(16000L);
            return;
        }
        if (dC.if(bx.do instanceof fo_0)) {
            return;
        }
        if (dC.if(bx.do instanceof er) && dC.for(fj.new, do[5])) {
            er.do().for();
            return;
        }
        if (dC.if(bx.do instanceof gQ)) {
            long l = System.currentTimeMillis() - this.new;
            if (dC.do(dC.do(l, 3000L))) {
                aq_0.if(3000L - l);
            }
            gQ.do().do = do[5];
            fv_0.do().int(do[6]);
            if (dC.if(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(3000L);
            }
            return;
        }
        if (dC.int(aq_0.do(fj.new) ? 1 : 0)) {
            fv_0.do().int(do[7]);
            if (dC.if(aq_0.else(15000L) ? 1 : 0)) {
                aq_0.if(2000L);
            }
            return;
        }
        if (dC.for(fj.new, do[5])) {
            int n;
            fj.int = do[8];
            fj.byte = do[9];
            if (dC.for(bs_0.do[do[5]])) {
                n = aq_0.do(do[0], bs_0.do[do[5]]);
                "".length();
                if (null != null) {
                    return;
                }
            } else {
                n = do[1];
            }
            int n2 = n;
            fp.do().do(do[5], n2);
            if (dC.if(aq_0.else(15000L) ? 1 : 0)) {
                do = System.currentTimeMillis();
                aq_0.if(3000L);
            }
            return;
        }
        if (dC.if(AngelChip.do.do[do[0]], do[10])) {
            bx_0.try();
            bx.if("H\u1ebft xu r\u00f9i b\u1ea1n ey! Gi\u1eef l\u1ea1i ch\u00fat v\u1ed1n ch\u0103m farm :(");
            return;
        }
        if (dC.int(for, do[2])) {
            if (dC.do(do, do[11]) && dC.for(do)) {
                if (dC.for(dC.do(for, (float)(AngelChip.do.do[do[0]] - do[10])))) {
                    for = AngelChip.do.do[do[0]] - do[10];
                }
                if (dC.for(dC.do(for, 3.0E7f))) {
                    for = 3.0E7f;
                }
                this.try = System.currentTimeMillis();
                fv_0.do().do(do[12], do, String.valueOf((int)Math.ceil(for)));
                "".length();
                if ((0x4B ^ 0x6E ^ (0x37 ^ 0x16)) == 0) {
                    return;
                }
            } else {
                dC.try();
            }
            for = do[3];
        }
        if (dC.for(dC.do(System.currentTimeMillis() - do, 30000L))) {
            do = System.currentTimeMillis();
            gs_0.do(do[8], do[9], do[2], do[0]);
        }
    }

    private static boolean int(int n, int n2) {
        return n == n2;
    }

    public final String toString() {
        return "Auto t\u00e0i x\u1ec9u";
    }
}

