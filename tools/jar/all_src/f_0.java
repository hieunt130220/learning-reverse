/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Image
 */
import java.io.DataInputStream;
import java.io.IOException;
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from f
 */
public final class f_0 {
    private static final int[] do;
    private String[] do;
    private int do;
    private byte[] do;
    private int if;
    private int[] if;
    private int[] for;
    private byte[] if;
    static f_0 do;
    private String do;
    private DataInputStream do;
    private int for;

    public f_0(String string) {
        byte[] byArray = new byte[do[0]];
        byArray[f_0.do[1]] = do[2];
        byArray[f_0.do[3]] = do[4];
        byArray[f_0.do[5]] = do[6];
        byArray[f_0.do[7]] = do[8];
        byArray[f_0.do[9]] = do[10];
        byArray[f_0.do[11]] = do[12];
        byArray[f_0.do[13]] = do[14];
        byArray[f_0.do[15]] = do[16];
        byArray[f_0.do[17]] = do[12];
        byArray[f_0.do[18]] = do[19];
        byArray[f_0.do[20]] = do[21];
        byArray[f_0.do[22]] = do[12];
        byArray[f_0.do[23]] = do[24];
        this.if = byArray;
        this.for = this.if.length;
        int n = do[1];
        int n2 = do[1];
        this.do = string;
        this.do = do[1];
        this.do = new DataInputStream(this.getClass().getResourceAsStream(this.do));
        try {
            this.if = this.do.readUnsignedByte();
            this.do += do[3];
            this.do = new String[this.if];
            this.for = new int[this.if];
            this.if = new int[this.if];
            int n3 = do[1];
            while (f_0.do(n3, this.if)) {
                byte by2 = this.do.readByte();
                byte[] byArray2 = new byte[by2];
                this.do.read(byArray2);
                "".length();
                this.do(byArray2);
                this.do[n3] = new String(byArray2);
                this.for[n3] = n;
                this.if[n3] = this.do.readUnsignedShort();
                n += this.if[n3];
                n2 += this.if[n3];
                this.do += by2 + do[7];
                ++n3;
                "".length();
                if ((0xA0 ^ 0xA4) != 0) continue;
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
        if (" ".length() < 0) {
            throw null;
        }
        this.for();
    }

    public f_0() {
        byte[] byArray = new byte[do[0]];
        byArray[f_0.do[1]] = do[2];
        byArray[f_0.do[3]] = do[4];
        byArray[f_0.do[5]] = do[6];
        byArray[f_0.do[7]] = do[8];
        byArray[f_0.do[9]] = do[10];
        byArray[f_0.do[11]] = do[12];
        byArray[f_0.do[13]] = do[14];
        byArray[f_0.do[15]] = do[16];
        byArray[f_0.do[17]] = do[12];
        byArray[f_0.do[18]] = do[19];
        byArray[f_0.do[20]] = do[21];
        byArray[f_0.do[22]] = do[12];
        byArray[f_0.do[23]] = do[24];
        this.if = byArray;
        this.for = this.if.length;
    }

    private static void if() {
        do = new int[25];
        f_0.do[0] = 0x66 ^ 0x41 ^ (0x30 ^ 0x1A);
        f_0.do[1] = (0xB5 ^ 0x9C) & ~(5 ^ 0x2C);
        f_0.do[2] = 0x69 ^ 5 ^ (0x40 ^ 0x62);
        f_0.do[3] = " ".length();
        f_0.do[4] = 0x72 ^ 0x2E ^ (0x4A ^ 0x71);
        f_0.do[5] = "  ".length();
        f_0.do[6] = 0xD4 ^ 0xA1;
        f_0.do[7] = "   ".length();
        f_0.do[8] = 0xE ^ 0x77;
        f_0.do[9] = 2 ^ 6;
        f_0.do[10] = 0x41 ^ 0x24;
        f_0.do[11] = 0x2F ^ 0x2A;
        f_0.do[12] = 0x7F ^ 0x11;
        f_0.do[13] = 6 ^ 0;
        f_0.do[14] = 0x78 ^ 0x6A ^ (0xE5 ^ 0xA1);
        f_0.do[15] = 0x83 ^ 0xC4 ^ (0x71 ^ 0x31);
        f_0.do[16] = 0x70 ^ 0x11;
        f_0.do[17] = 0x91 ^ 0x99;
        f_0.do[18] = 0x2C ^ 0x27 ^ "  ".length();
        f_0.do[19] = 0xD1 ^ 0x87 ^ (0xAB ^ 0xB0);
        f_0.do[20] = 0x42 ^ 0x12 ^ (0x15 ^ 0x4F);
        f_0.do[21] = 0x8F ^ 0xC4 ^ (0x4A ^ 0x68);
        f_0.do[22] = 0x73 ^ 0x78;
        f_0.do[23] = 0x65 ^ 0x69;
        f_0.do[24] = 7 ^ 0x6F;
    }

    private void do(byte[] byArray) {
        int n = byArray.length;
        int n2 = do[1];
        while (f_0.do(n2, n)) {
            int n3 = n2;
            byArray[n3] = (byte)(byArray[n3] ^ this.if[n2 % this.for]);
            ++n2;
            "".length();
            if (null == null) continue;
            return;
        }
    }

    private static boolean do(int n) {
        return n == 0;
    }

    public static void do() {
        if (f_0.do(do)) {
            do.for();
            do = null;
        }
        System.gc();
    }

    private static boolean do(Object object) {
        return object != null;
    }

    static {
        f_0.if();
    }

    private static boolean do(int n, int n2) {
        return n < n2;
    }

    private void for() {
        if (f_0.do(this.do)) {
            try {
                this.do.close();
                return;
            }
            catch (IOException iOException) {
                "".length();
            }
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final byte[] do(String object) {
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
        while (f_0.do(n, this.if)) {
            if (f_0.do(this.do[n].compareTo((String)object))) {
                object = new byte[this.if[n]];
                System.arraycopy(this.do, this.for[n], object, do[1], this.if[n]);
                return object;
            }
            ++n;
            "".length();
        }
        "".length();
        return null;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private Image if(String string) {
        int n;
        try {
            n = do[1];
        }
        catch (Exception exception) {
            "".length();
            return null;
        }
        while (f_0.do(n, this.if)) {
            if (f_0.do(this.do[n].compareTo(string))) {
                return Image.createImage((byte[])this.do, (int)this.for[n], (int)this.if[n]);
            }
            ++n;
            "".length();
        }
        "".length();
        if (((18 + 130 - 147 + 193 ^ 96 + 23 - 32 + 57) & (0x94 ^ 0x89 ^ (0x1D ^ 0x52) ^ -" ".length())) == 0) return null;
        return null;
    }

    public static void do(String string) {
        do = new f_0(bT.if() + string);
    }

    public static Image do(String string) {
        if (f_0.do(do)) {
            return do.if(string + ".png");
        }
        return null;
    }
}

