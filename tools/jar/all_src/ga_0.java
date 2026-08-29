/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Display
 *  javax.microedition.midlet.MIDlet
 */
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Vector;
import javax.microedition.lcdui.Display;
import javax.microedition.midlet.MIDlet;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from ga
 */
public final class ga_0
implements dh_0,
Runnable {
    private long do;
    public static int do;
    public static String do;
    private cq[] do = 0L;
    private static final Object do;
    private static final int[] do;
    public static boolean do;
    private int if = do[0];
    private static ga_0 do;
    private static boolean if;

    public final void do() {
        int n;
        if (ga_0.do(do ? 1 : 0)) {
            do = do[0];
            ga_0.if();
            if (ga_0.do(ag_0.do().do() ? 1 : 0) && ga_0.if(fj.new, do[1])) {
                aq_0.do(do[2], "T\u1eaft auto click");
            }
            bx.do("T\u1eaft auto click");
            return;
        }
        dh_0 dh_02 = R.do();
        Object object = Display.getDisplay((MIDlet)AngelChip.do).getCurrent();
        if (!ga_0.do(object, dh_02.do) || !ga_0.do(object, dh_02.if) || ga_0.do(object instanceof bo_0)) {
            n = do[3];
            "".length();
            if (((104 + 14 - -86 + 1 ^ 35 + 121 - 21 + 62) & (154 + 61 - 32 + 0 ^ 109 + 31 - 129 + 180 ^ -" ".length())) != 0) {
                return;
            }
        } else {
            n = do[0];
        }
        if (ga_0.do(n)) {
            return;
        }
        if (ga_0.do(do.equals("") ? 1 : 0)) {
            bx.if("AutoClick ch\u01b0a \u0111\u01b0\u1ee3c c\u00e0i \u0111\u1eb7t!");
            return;
        }
        dh_02 = this;
        object = new Vector();
        String[] stringArray = aq_0.do(do, ",");
        int n2 = do[0];
        while (ga_0.int(n2, stringArray.length)) {
            block22: {
                String[] stringArray2 = stringArray[n2].trim();
                if (!ga_0.for(stringArray2.equals("") ? 1 : 0)) break block22;
                stringArray2 = aq_0.do((String)stringArray2, ":");
                int n3 = do[0];
                int n4 = do[1];
                int n5 = do[0];
                if (ga_0.for(stringArray2.length, do[4])) {
                    block21: {
                        try {
                            n3 = Integer.parseInt(stringArray2[do[0]].trim());
                            n4 = Integer.parseInt(stringArray2[do[3]].trim());
                            if (!ga_0.do(stringArray2.length, do[4])) break block21;
                            n5 = Integer.parseInt(stringArray2[do[4]].trim());
                        }
                        catch (NumberFormatException numberFormatException) {
                            "".length();
                            n4 = do[1];
                        }
                    }
                    "".length();
                    if (-(0x75 ^ 3 ^ (0xEA ^ 0x99)) >= 0) {
                        return;
                    }
                }
                if (ga_0.int(n4)) {
                    int n6;
                    int n7 = n4 * do[5];
                    if (ga_0.int(n5, do[6])) {
                        n6 = do[0];
                        "".length();
                        if (-(110 + 62 - 149 + 143 ^ 65 + 130 - 83 + 50) >= 0) {
                            return;
                        }
                    } else {
                        n6 = n5;
                    }
                    ((Vector)object).addElement(new cq(n3, n7, n6));
                }
            }
            ++n2;
            "".length();
            if ((118 + 57 - 170 + 123 ^ 88 + 109 - 81 + 17) != 0) continue;
            return;
        }
        if (ga_0.for(((Vector)object).isEmpty() ? 1 : 0)) {
            ((ga_0)dh_02).do = new cq[((Vector)object).size()];
            ((Vector)object).copyInto(((ga_0)dh_02).do);
            "".length();
            if (-"  ".length() >= 0) {
                return;
            }
        } else {
            ((ga_0)dh_02).do = null;
        }
        if (ga_0.do(this.do)) {
            bx.if("L\u1ed7i c\u00e0i \u0111\u1eb7t AutoClick. Vui l\u00f2ng ki\u1ec3m tra l\u1ea1i!");
            return;
        }
        this.if = do[0];
        this.do = System.currentTimeMillis();
        ga_0.if();
        do = do[3];
        new Thread(this).start();
        if (ga_0.do(ag_0.do().do() ? 1 : 0) && ga_0.if(fj.new, do[1])) {
            aq_0.do(do[2], "B\u1eadt auto click");
        }
        bx.do("B\u1eadt auto click");
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean do(int n, int n2) {
        return n > n2;
    }

    private static boolean do(Object object) {
        return object == null;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void if() {
        if (ga_0.do(if ? 1 : 0)) {
            Object object = do;
            synchronized (object) {
                do.notifyAll();
            }
            "".length();
            if = do[0];
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void for() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeInt(do);
            dataOutputStream.writeUTF(do);
            dataOutputStream.flush();
            byteArrayOutputStream.flush();
            cs.do("AutoClickSettings", byteArrayOutputStream.toByteArray());
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
                throw throwable;
            }
            catch (IOException iOException) {
                "".length();
                throw throwable;
            }
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

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    public static ga_0 do() {
        if (ga_0.do(do)) {
            do = new ga_0();
        }
        return do;
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean do(Object object, Object object2) {
        return object != object2;
    }

    private static boolean if(Object object) {
        return object != null;
    }

    private static boolean if(int n) {
        return n > 0;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    static {
        ga_0.int();
        do = do[0];
        do = "";
        do = do[0];
        do = new Object();
        if = do[0];
        Object object = cs.do("AutoClickSettings");
        if (!ga_0.if(object)) {
            return;
        }
        object = new ByteArrayInputStream((byte[])object);
        DataInputStream dataInputStream = new DataInputStream((InputStream)object);
        try {
            do = dataInputStream.readInt();
            do = dataInputStream.readUTF();
        }
        catch (IOException iOException) {
            "".length();
            try {
                dataInputStream.close();
                ((ByteArrayInputStream)object).close();
                return;
            }
            catch (IOException iOException2) {
                "".length();
                return;
            }
        }
        catch (Throwable throwable) {
            try {
                dataInputStream.close();
                ((ByteArrayInputStream)object).close();
                "".length();
            }
            catch (IOException iOException) {
                "".length();
                throw throwable;
            }
            if ("   ".length() != 0) throw throwable;
            return;
        }
        try {
            dataInputStream.close();
            ((ByteArrayInputStream)object).close();
            return;
        }
        catch (IOException iOException) {
            "".length();
            return;
        }
    }

    private static boolean for(int n) {
        return n == 0;
    }

    private static boolean int(int n) {
        return n >= 0;
    }

    private static boolean for(int n, int n2) {
        return n >= n2;
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void run() {
        do {
            if (!ga_0.do(do ? 1 : 0)) {
                return;
            }
            if (ga_0.for(this.if, this.do.length)) {
                this.if = do[0];
            }
            if (ga_0.int(ga_0.do(System.currentTimeMillis() - this.do, (long)this.do[this.if].if))) {
                AngelChip.do.if(this.do[this.if].do);
                if (ga_0.if(this.do[this.if].for)) {
                    long l = this.do[this.if].for;
                    if = do[3];
                    Object object = do;
                    synchronized (object) {
                        try {
                            do.wait(l);
                            "".length();
                        }
                        catch (InterruptedException interruptedException) {
                            "".length();
                        }
                    }
                    "".length();
                }
                AngelChip.do.do(this.do[this.if].do);
                this.do = System.currentTimeMillis();
                this.if += do[3];
            }
            aq_0.if(100L);
            "".length();
        } while (((0x9F ^ 0x86 ^ (0xF3 ^ 0x8A)) & (0x39 ^ 0x40 ^ (0x27 ^ 0x3E) ^ -" ".length())) < (0x7A ^ 0x1A ^ (0xD9 ^ 0xBD)));
    }

    private static boolean int(int n, int n2) {
        return n < n2;
    }

    private static void int() {
        do = new int[7];
        ga_0.do[0] = (93 + 154 - 211 + 126 ^ 41 + 35 - 23 + 104) & (" ".length() ^ (0xB5 ^ 0x8B) ^ -" ".length());
        ga_0.do[1] = -" ".length();
        ga_0.do[2] = 48 + 133 - 113 + 82;
        ga_0.do[3] = " ".length();
        ga_0.do[4] = "  ".length();
        ga_0.do[5] = -(0xFFFFF457 & 0x7BBF) & (0xFFFFF3FF & 0x7FFE);
        ga_0.do[6] = 0x6B ^ 0x63 ^ (0x83 ^ 0xB9);
    }
}

