/*
 * Decompiled with CFR 0.152.
 */
import java.io.IOException;
import java.util.Vector;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from eB
 */
public final class eb_0
extends bH {
    private static int[] do;
    private static eb_0 do;

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void do(int[] nArray, int n) {
        block7: {
            try {
                this.if(do[14]);
                ((bH)this).do.do.writeByte(n);
                n = do[7];
                "".length();
                while (true) {
                    if (eb_0.do(n, do[15])) {
                        "".length();
                        break;
                    }
                    if (eb_0.if(nArray[n], do[11])) {
                        ((bH)this).do.do.writeByte(nArray[n]);
                        ++n;
                        continue;
                    }
                    break block7;
                    break;
                }
            }
            catch (Exception exception) {
                "".length();
                break block7;
            }
            if ("  ".length() == ((0xEA ^ 0xAB ^ (0x66 ^ 0x30)) & (167 + 28 - 130 + 106 ^ 133 + 76 - 147 + 126 ^ -" ".length()))) {
                return;
            }
        }
        this.if();
    }

    public final void do() {
        this.do(do[0]);
        this.if();
    }

    public final void for() {
        this.do(do[5]);
        this.if();
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void do(gd_0[][] gd_0Array) {
        block10: {
            try {
                this.if(do[9]);
                int n = do[7];
                "".length();
                block2: while (true) {
                    if (eb_0.do(n, do[3])) {
                        "".length();
                        break;
                    }
                    int n2 = do[7];
                    "".length();
                    if ("  ".length() != "  ".length()) {
                        return;
                    }
                    while (true) {
                        if (eb_0.do(n2, do[3])) {
                            ++n;
                            continue block2;
                        }
                        if (eb_0.do(gd_0Array[n][n2].do ? 1 : 0)) {
                            gd_0Array[n][n2].do = do[7];
                            ((bH)this).do.do.writeByte((n << do[21]) + n2);
                        }
                        ++n2;
                    }
                    break;
                }
            }
            catch (Exception exception) {
                exception.printStackTrace();
                break block10;
            }
            if (-" ".length() > " ".length()) {
                return;
            }
        }
        this.if();
    }

    public final void int(int n) {
        try {
            this.if(do[18]);
            ((bH)this).do.do.writeInt(n);
            "".length();
        }
        catch (IOException iOException) {
            "".length();
        }
        if (" ".length() == "  ".length()) {
            return;
        }
        this.if();
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void do(int[] nArray) {
        try {
            this.if(do[13]);
            int n = do[7];
            "".length();
            if (((0x8F ^ 0xB5 ^ "   ".length()) & (0x22 ^ 0x4E ^ (0xD7 ^ 0x82) ^ -" ".length())) < 0) {
                return;
            }
            while (true) {
                if (eb_0.do(n, nArray.length)) {
                    "".length();
                    break;
                }
                if (eb_0.if(nArray[n], do[11])) {
                    ((bH)this).do.do.writeByte(nArray[n]);
                }
                ++n;
            }
        }
        catch (Exception exception) {
            "".length();
        }
        this.if();
    }

    public final void int() {
        try {
            this.if(do[8]);
            "".length();
        }
        catch (Exception exception) {
            "".length();
        }
        if (null != null) {
            return;
        }
        this.if();
    }

    public final void if(byte by2) {
        super.do(by2);
        ((bH)this).do.do.writeByte(y_0.do);
        ((bH)this).do.do.writeByte(y_0.if);
    }

    public final void do(int n, int n2) {
        try {
            this.if(do[6]);
            ((bH)this).do.do.writeByte(n);
            ((bH)this).do.do.writeByte(n2);
            "".length();
        }
        catch (IOException iOException) {
            iOException.printStackTrace();
        }
        if (-" ".length() > 0) {
            return;
        }
        this.if();
    }

    public static eb_0 do() {
        if (eb_0.do(do)) {
            do = new eb_0();
        }
        return do;
    }

    public final void do(byte by2, byte by3, String string) {
        this.do(do[3]);
        try {
            ((bH)this).do.do.writeByte(by2);
            ((bH)this).do.do.writeByte(by3);
            ((bH)this).do.do.writeUTF(string);
            "".length();
        }
        catch (IOException iOException) {
            "".length();
        }
        if (" ".length() > "  ".length()) {
            return;
        }
        this.if();
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    public final void new(int n) {
        try {
            this.if(do[2]);
            ((bH)this).do.do.writeByte(n);
            "".length();
        }
        catch (Exception exception) {
            "".length();
        }
        if (" ".length() != " ".length()) {
            return;
        }
        this.if();
    }

    public final void new() {
        try {
            this.if(do[8]);
            "".length();
        }
        catch (Exception exception) {
            "".length();
        }
        if ("  ".length() <= 0) {
            return;
        }
        this.if();
    }

    public final void do(boolean bl) {
        try {
            this.if(do[17]);
            ((bH)this).do.do.writeBoolean(bl);
            "".length();
        }
        catch (IOException iOException) {
            "".length();
        }
        if (-" ".length() >= "  ".length()) {
            return;
        }
        this.if();
    }

    public final void for(byte by2) {
        this.do(do[1]);
        this.do((int)by2);
        this.if();
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void do(de_0[] de_0Array) {
        block12: {
            try {
                this.if(do[10]);
                int n = do[11];
                int n2 = do[7];
                "".length();
                if (((0xAA ^ 0xAF ^ (0x2D ^ 0x13)) & ("   ".length() ^ (0x94 ^ 0xAC) ^ -" ".length())) < 0) {
                    return;
                }
                while (true) {
                    if (eb_0.do(n2, do[12])) {
                        "".length();
                        break;
                    }
                    if (eb_0.do(de_0Array[n2].do)) {
                        if (eb_0.if(de_0Array[n2].do, n) && eb_0.if(n, do[11])) {
                            ((bH)this).do.do.writeByte(do[11]);
                        }
                        n = de_0Array[n2].do;
                        ((bH)this).do.do.writeByte(de_0Array[n2].if);
                        "".length();
                        if (-"   ".length() > 0) {
                            return;
                        }
                    } else if (eb_0.if(n, do[11])) {
                        ((bH)this).do.do.writeByte(do[11]);
                        n = do[11];
                    }
                    ++n2;
                }
            }
            catch (Exception exception) {
                "".length();
                break block12;
            }
            if (((0xE2 ^ 0xB4 ^ (0x26 ^ 0x30)) & (55 + 39 - -82 + 72 ^ 176 + 118 - 233 + 123 ^ -" ".length())) == " ".length()) {
                return;
            }
        }
        this.if();
    }

    private static boolean do(Object object) {
        return object == null;
    }

    public final void do(byte by2, byte by3) {
        try {
            this.if(do[10]);
            ((bH)this).do.do.writeByte(by2);
            ((bH)this).do.do.writeByte(by3);
            "".length();
        }
        catch (Exception exception) {
            "".length();
        }
        if ("   ".length() >= (0x1D ^ 0x19)) {
            return;
        }
        this.if();
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void do(byte[] byArray) {
        try {
            this.if(do[6]);
            ((bH)this).do.do.writeByte(byArray.length);
            int n = do[7];
            "".length();
            while (true) {
                if (eb_0.do(n, byArray.length)) {
                    "".length();
                    break;
                }
                ((bH)this).do.do.write(byArray[n]);
                ++n;
            }
        }
        catch (Exception exception) {
            "".length();
        }
        this.if();
    }

    private static boolean do(int n) {
        return n != 0;
    }

    public final void if(String string) {
        try {
            this.if(do[19]);
            ((bH)this).do.do.writeUTF(string);
            "".length();
        }
        catch (IOException iOException) {
            "".length();
        }
        if ((0xA1 ^ 0xA5) < " ".length()) {
            return;
        }
        this.if();
    }

    public final void try(int n) {
        try {
            this.if(do[20]);
            ((bH)this).do.do.writeInt(n);
            "".length();
        }
        catch (IOException iOException) {
            "".length();
        }
        if (-" ".length() != -" ".length()) {
            return;
        }
        this.if();
    }

    public final void int(byte by2) {
        try {
            this.if(do[6]);
            ((bH)this).do.do.writeByte(by2);
            "".length();
        }
        catch (Exception exception) {
            "".length();
        }
        if (null != null) {
            return;
        }
        this.if();
    }

    private static boolean if(int n) {
        return n > 0;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void do(Vector vector) {
        block5: {
            try {
                this.if(do[6]);
                if (!eb_0.if(vector.size())) break block5;
                int n = do[7];
                "".length();
                if ("   ".length() != "   ".length()) {
                    return;
                }
                while (true) {
                    if (eb_0.do(n, vector.size())) {
                        "".length();
                        break;
                    }
                    bN bN2 = (bN)vector.elementAt(n);
                    ((bH)this).do.do.writeByte(bN2.for);
                    bN2.for = do[7];
                    ++n;
                }
            }
            catch (Exception exception) {
                "".length();
            }
        }
        this.if();
    }

    public final void for(String string) {
        try {
            this.if(do[16]);
            ((bH)this).do.do.writeUTF(string);
            "".length();
        }
        catch (IOException iOException) {
            "".length();
        }
        if (-" ".length() == " ".length()) {
            return;
        }
        this.if();
    }

    private static void case() {
        do = new int[23];
        eb_0.do[0] = 0x67 ^ 0x61;
        eb_0.do[1] = 97 + 18 - -8 + 47 ^ 104 + 47 - 102 + 124;
        eb_0.do[2] = 0x1F ^ 0x27;
        eb_0.do[3] = 0xCC ^ 0xB9 ^ (0x3B ^ 0x46);
        eb_0.do[4] = 0x97 ^ 0x8B;
        eb_0.do[5] = -(0xDD ^ 0x8F ^ (0x78 ^ 0x38));
        eb_0.do[6] = 0x4D ^ 0x6B ^ (0x18 ^ 0x2B);
        eb_0.do[7] = (0xF8 ^ 0xBD) & ~(0x73 ^ 0x36);
        eb_0.do[8] = 3 ^ 0x32;
        eb_0.do[9] = 0x1E ^ 0x59 ^ (0x6C ^ 0x6B);
        eb_0.do[10] = 0x16 ^ 0x57;
        eb_0.do[11] = -" ".length();
        eb_0.do[12] = 106 + 22 - 63 + 73 ^ 26 + 27 - -1 + 74;
        eb_0.do[13] = 0xE ^ 0x4D;
        eb_0.do[14] = 0xE4 ^ 0xA0;
        eb_0.do[15] = 0x95 ^ 0x90;
        eb_0.do[16] = 0xCC ^ 0x93 ^ (0x4B ^ 0x1D);
        eb_0.do[17] = 74 + 70 - 96 + 130 ^ 25 + 115 - -1 + 21;
        eb_0.do[18] = 0xB2 ^ 0xA1;
        eb_0.do[19] = "   ".length() ^ (0x27 ^ 0x36);
        eb_0.do[20] = 0xDA ^ 0x9C ^ (0xCE ^ 0x83);
        eb_0.do[21] = "   ".length();
        eb_0.do[22] = 0x3E ^ 0x26;
    }

    static {
        eb_0.case();
    }

    public final void try() {
        try {
            this.if(do[22]);
            "".length();
        }
        catch (IOException iOException) {
            iOException.printStackTrace();
        }
        if ("   ".length() < 0) {
            return;
        }
        this.if();
    }

    public final void byte() {
        this.do(do[4]);
        this.if();
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public final void do(int[] nArray, byte by2) {
        block6: {
            try {
                this.if(do[9]);
                int n = do[7];
                "".length();
                while (true) {
                    if (eb_0.do(n, nArray.length)) {
                        ((bH)this).do.do.writeByte(by2);
                        "".length();
                        break;
                    }
                    ((bH)this).do.do.writeByte(nArray[n]);
                    ++n;
                }
            }
            catch (Exception exception) {
                "".length();
                break block6;
            }
            if (" ".length() < -" ".length()) {
                return;
            }
        }
        this.if();
    }
}

