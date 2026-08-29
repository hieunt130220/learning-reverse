/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 */
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Hashtable;
import java.util.Vector;
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class bC {
    public static Image[] do;
    public static Vector do;
    public static m_0[] do;
    public static Vector if;
    private static byte do;
    private static int[] do;
    private static ei_0[] do;
    public static int do;
    private static short[] do;
    private static int if;
    public static Vector for;
    public static Hashtable do;
    private static int for;
    public static fd_0[] do;

    private static boolean do(Object object) {
        return object != null;
    }

    /*
     * Unable to fully structure code
     */
    public static void do() {
        block1: {
            if (!bC.if(bC.do.size(), bC.do[12])) break block1;
            var0 = bC.do.keys();
            "".length();
            if ("  ".length() >= 0) ** GOTO lbl14
            return;
lbl-1000:
            // 1 sources

            {
                var1_1 = (String)var0.nextElement();
                var2_2 = (e)bC.do.get(var1_1);
                if (!bC.for(var2_2.do, bC.do[0]) || !bC.if(bC.do(System.currentTimeMillis() / 1000L - (long)var2_2.do, (long)bx.case))) continue;
                bC.do.remove(var1_1);
                "".length();
lbl14:
                // 3 sources

                ** while (!bC.do((int)var0.hasMoreElements()))
            }
        }
    }

    /*
     * Unable to fully structure code
     */
    private static void for(byte[] var0) {
        var0 = new ByteArrayInputStream((byte[])var0);
        v0 = new DataInputStream((InputStream)var0);
        var0 = v0;
        var1_1 = v0.readShort();
        var2_2 = new fd_0[var1_1];
        var3_3 = bC.do[1];
        "".length();
        if (-(90 ^ 94) < 0) ** GOTO lbl33
        return;
lbl-1000:
        // 1 sources

        {
            var2_2[var3_3] = new fd_0();
            var2_2[var3_3].if = var0.readByte();
            var2_2[var3_3].do = var0.readUTF();
            var2_2[var3_3].if = var2_2[var3_3].do.toLowerCase();
            var2_2[var3_3].do = new byte[bC.do[3]];
            var2_2[var3_3].do[bC.do[1]] = var0.readByte();
            var2_2[var3_3].do[bC.do[2]] = var0.readByte();
            var2_2[var3_3].try = var0.readShort();
            var2_2[var3_3].for = var0.readShort();
            var2_2[var3_3].if[bC.do[1]] = var0.readShort();
            var2_2[var3_3].int = var0.readShort();
            var2_2[var3_3].do = var0.readShort();
            var2_2[var3_3].do = new short[bC.do[4]];
            var4_4 = bC.do[1];
            "".length();
            if (null == null) ** GOTO lbl31
            return;
lbl-1000:
            // 1 sources

            {
                var2_2[var3_3].do[var4_4] = var0.readShort();
                ++var4_4;
lbl31:
                // 2 sources

                ** while (!bC.int((int)var4_4, (int)var2_2[var3_3].do.length))
            }
lbl32:
            // 1 sources

            ++var3_3;
lbl33:
            // 2 sources

            ** while (!bC.int((int)var3_3, (int)var1_1))
        }
lbl34:
        // 1 sources

        v1 = var0.readShort();
        var3_3 = v1;
        bC.do = new ei_0[v1];
        var4_4 = bC.do[1];
        "".length();
        if (((209 + 39 - 157 + 144 ^ 102 + 149 - 174 + 108) & (239 ^ 173 ^ (179 ^ 163) ^ -" ".length())) == 0) ** GOTO lbl46
        return;
lbl-1000:
        // 1 sources

        {
            bC.do[var4_4] = new ei_0();
            bC.do[var4_4].do = var0.readByte();
            bC.do[var4_4].do[bC.do[1]] = var0.readShort();
            ++var4_4;
lbl46:
            // 2 sources

            ** while (!bC.int((int)var4_4, (int)var3_3))
        }
lbl47:
        // 1 sources

        var4_4 = bC.do[1];
        "".length();
        if (-" ".length() != ((124 ^ 36) & ~(58 ^ 98))) ** GOTO lbl54
        return;
lbl-1000:
        // 1 sources

        {
            var2_2[var4_4].if[bC.do[2]] = var0.readShort();
            ++var4_4;
lbl54:
            // 2 sources

            ** while (!bC.int((int)var4_4, (int)var1_1))
        }
lbl55:
        // 1 sources

        var4_4 = bC.do[1];
        "".length();
        if (-" ".length() == -" ".length()) ** GOTO lbl62
        return;
lbl-1000:
        // 1 sources

        {
            bC.do[var4_4].do[bC.do[2]] = var0.readShort();
            ++var4_4;
lbl62:
            // 2 sources

            ** while (!bC.int((int)var4_4, (int)var3_3))
        }
lbl63:
        // 1 sources

        var4_4 = var0.readShort();
        bC.do = new Vector<E>();
        var3_3 = bC.do[1];
        "".length();
        if (-"  ".length() < 0) ** GOTO lbl108
        return;
lbl-1000:
        // 1 sources

        {
            var5_5 = new go_0();
            new go_0().if = var0.readByte();
            var5_5.if = var0.readUTF();
            var5_5.do = var0.readUTF();
            var5_5.do[bC.do[1]] = var0.readInt();
            var5_5.do[bC.do[2]] = var0.readShort();
            var5_5.do = var0.readShort();
            var5_5.if = var0.readShort();
            var6_9 = bC.do[1];
            "".length();
            if (((37 + 52 - -66 + 17 ^ 138 + 47 - 121 + 90) & (83 ^ 90 ^ (174 ^ 145) ^ -" ".length())) == 0) ** GOTO lbl85
            return;
lbl-1000:
            // 1 sources

            {
                var5_5.do[var6_9] = var0.readShort();
                ++var6_9;
lbl85:
                // 2 sources

                ** while (!bC.int((int)var6_9, (int)bC.do[5]))
            }
lbl86:
            // 1 sources

            var5_5.do = var0.readByte();
            var6_9 = bC.do[1];
            "".length();
            if (-"  ".length() < 0) ** GOTO lbl101
            return;
lbl-1000:
            // 1 sources

            {
                var7_13 = bC.do[1];
                "".length();
                if (((116 ^ 33) & ~(48 ^ 101)) == 0) ** GOTO lbl99
                return;
lbl-1000:
                // 1 sources

                {
                    var5_5.do[var6_9][var7_13] = var0.readByte();
                    ++var7_13;
lbl99:
                    // 2 sources

                    ** while (!bC.int((int)var7_13, (int)bC.do[6]))
                }
lbl100:
                // 1 sources

                ++var6_9;
lbl101:
                // 2 sources

                ** while (!bC.int((int)var6_9, (int)bC.do[5]))
            }
lbl102:
            // 1 sources

            var5_5.for = var0.readByte();
            var5_5.int = var0.readShort();
            var5_5.for = var0.readShort();
            var5_5.do = var0.readShort();
            bC.do.addElement(var5_5);
            ++var3_3;
lbl108:
            // 2 sources

            ** while (!bC.int((int)var3_3, (int)var4_4))
        }
lbl109:
        // 1 sources

        bC.if = new Vector<E>();
        var3_3 = var0.readByte();
        var5_6 = bC.do[1];
        "".length();
        if ("   ".length() == "   ".length()) ** GOTO lbl127
        return;
lbl-1000:
        // 1 sources

        {
            var6_11 = new dI();
            new dI().do = bC.do[2];
            var6_11.if = var0.readShort();
            var6_11.do = var0.readShort();
            var6_11.if = var0.readByte();
            var6_11.do = var0.readByte();
            var6_11.do = var0.readUTF();
            var6_11.do = var0.readShort();
            var6_11.if = var0.readShort();
            bC.if.addElement(var6_11);
            ++var5_6;
lbl127:
            // 2 sources

            ** while (!bC.int((int)var5_6, (int)var3_3))
        }
lbl128:
        // 1 sources

        var5_6 = var0.readByte();
        var6_12 = bC.do[1];
        "".length();
        if ((97 + 40 - -4 + 22 ^ 13 + 102 - -51 + 1) > " ".length()) ** GOTO lbl142
        return;
lbl-1000:
        // 1 sources

        {
            var7_15 = new dI();
            new dI().do = bC.do[1];
            var7_15.if = var0.readShort();
            var7_15.do = var0.readShort();
            var7_15.do = var0.readUTF();
            var7_15.do = var0.readShort();
            var7_15.if = var0.readShort();
            ++var6_12;
lbl142:
            // 2 sources

            ** while (!bC.int((int)var6_12, (int)var5_6))
        }
lbl143:
        // 1 sources

        v2 = var0.readByte();
        var6_12 = v2;
        var7_16 = new fd_0[v2];
        var3_3 = bC.do[1];
        "".length();
        if ((169 ^ 155 ^ (14 ^ 56)) != 0) ** GOTO lbl172
        return;
lbl-1000:
        // 1 sources

        {
            var7_16[var3_3] = new fd_0();
            var7_16[var3_3].do = bC.do[2];
            var7_16[var3_3].if = var0.readShort();
            var7_16[var3_3].do = var0.readUTF();
            var7_16[var3_3].if = var7_16[var3_3].do.toLowerCase();
            var7_16[var3_3].try = var0.readShort();
            var7_16[var3_3].if[bC.do[1]] = var0.readShort();
            var7_16[var3_3].if[bC.do[2]] = var0.readShort();
            var7_16[var3_3].new = var0.readShort();
            var7_16[var3_3].do = var0.readShort();
            var7_16[var3_3].do = var0.readByte();
            var7_16[var3_3].do = new short[bC.do[4]];
            var4_4 = bC.do[1];
            "".length();
            if (((196 ^ 129 ^ (252 ^ 136)) & (119 + 75 - 62 + 22 ^ 167 + 67 - 133 + 70 ^ -" ".length())) >= 0) ** GOTO lbl170
            return;
lbl-1000:
            // 1 sources

            {
                var7_16[var3_3].do[var4_4] = var0.readShort();
                ++var4_4;
lbl170:
                // 2 sources

                ** while (!bC.int((int)var4_4, (int)var7_16[var3_3].do.length))
            }
lbl171:
            // 1 sources

            ++var3_3;
lbl172:
            // 2 sources

            ** while (!bC.int((int)var3_3, (int)var6_12))
        }
lbl173:
        // 1 sources

        var3_3 = var0.readShort();
        var4_4 = bC.do[1];
        "".length();
        if (-(214 ^ 185 ^ (78 ^ 37)) < 0) ** GOTO lbl198
        return;
lbl-1000:
        // 1 sources

        {
            var5_7 = new ez();
            new ez().if = var0.readShort();
            var5_7.do = var0.readUTF();
            var5_7.for = var0.readShort();
            var5_7.do = var0.readShort();
            var8_17 = var0.readShort();
            var5_7.if = new short[var8_17];
            var5_7.do = new short[var8_17];
            var9_19 = bC.do[1];
            "".length();
            if (-"   ".length() <= 0) ** GOTO lbl195
            return;
lbl-1000:
            // 1 sources

            {
                var5_7.if[var9_19] = var0.readShort();
                var5_7.do[var9_19] = var0.readShort();
                ++var9_19;
lbl195:
                // 2 sources

                ** while (!bC.int((int)var9_19, (int)var8_17))
            }
lbl196:
            // 1 sources

            bC.for.addElement(var5_7);
            ++var4_4;
lbl198:
            // 2 sources

            ** while (!bC.int((int)var4_4, (int)var3_3))
        }
lbl199:
        // 1 sources

        var4_4 = var0.readByte();
        var5_8 = bC.do[1];
        "".length();
        if (-"  ".length() < 0) ** GOTO lbl214
        return;
lbl-1000:
        // 1 sources

        {
            var8_18 = new dI();
            new dI().do = bC.do[1];
            var8_18.if = var0.readShort();
            var8_18.do = var0.readShort();
            var8_18.do = var0.readUTF();
            var8_18.do = var0.readInt();
            var8_18.if = var0.readInt();
            bC.if.addElement(var8_18);
            ++var5_8;
lbl214:
            // 2 sources

            ** while (!bC.int((int)var5_8, (int)var4_4))
        }
lbl215:
        // 1 sources

        bC.do = new fd_0[var1_1 + var6_12];
        var5_8 = bC.do[1];
        "".length();
        if ("  ".length() < "   ".length()) ** GOTO lbl223
        return;
lbl-1000:
        // 1 sources

        {
            bC.do[var5_8] = var2_2[var5_8];
            ++var5_8;
lbl223:
            // 2 sources

            ** while (!bC.int((int)var5_8, (int)var1_1))
        }
lbl224:
        // 1 sources

        var5_8 = var1_1;
        "".length();
        if (" ".length() >= 0) ** GOTO lbl231
        return;
lbl-1000:
        // 1 sources

        {
            bC.do[var5_8] = var7_16[var5_8 - var1_1];
            ++var5_8;
lbl231:
            // 2 sources

            ** while (!bC.int((int)var5_8, (int)(var6_12 + var1_1)))
        }
lbl232:
        // 1 sources

    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private static void if(byte by2, short[] sArray, int n, int n2) {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeByte(by2);
            dataOutputStream.writeInt(n);
            dataOutputStream.writeInt(n2);
            n = do[1];
            "".length();
            if (" ".length() > "   ".length()) {
                return;
            }
            while (true) {
                if (bC.int(n, by2)) {
                    byte[] byArray = byteArrayOutputStream.toByteArray();
                    hi.do("avatarDataFarm", byArray);
                    dataOutputStream.close();
                    return;
                }
                dataOutputStream.writeShort(sArray[n]);
                ++n;
            }
        }
        catch (Exception exception) {
            "".length();
            return;
        }
    }

    /*
     * Unable to fully structure code
     */
    public static go_0 do(int var0) {
        var1_1 = bC.do.size();
        var2_2 = bC.do[1];
        "".length();
        if ("   ".length() > " ".length()) ** GOTO lbl11
        return null;
lbl-1000:
        // 1 sources

        {
            var3_3 = (go_0)bC.do.elementAt(var2_2);
            if (bC.do(var3_3.if, var0)) {
                return var3_3;
            }
            ++var2_2;
lbl11:
            // 2 sources

            ** while (!bC.int((int)var2_2, (int)var1_1))
        }
lbl12:
        // 1 sources

        return null;
    }

    private static boolean do() {
        byte[] byArray = hi.do("avatarImgFarm");
        if (bC.if((Object)byArray)) {
            return do[1];
        }
        try {
            bC.int(byArray);
            "".length();
        }
        catch (Exception exception) {
            "".length();
            ac_0.do("avatarImgFarm");
        }
        if (" ".length() != " ".length()) {
            return ((0x52 ^ 0x49) & ~(0x31 ^ 0x2A)) != 0;
        }
        return do[2];
    }

    /*
     * Unable to fully structure code
     */
    public static fd_0 do(int var0) {
        var1_1 = bC.do[1];
        "".length();
        if (((182 ^ 188 ^ (200 ^ 151)) & (32 + 46 - -127 + 24 ^ 40 + 6 - -59 + 71 ^ -" ".length())) != (44 + 174 - 78 + 41 ^ 78 + 50 - -7 + 42)) ** GOTO lbl9
        return null;
lbl-1000:
        // 1 sources

        {
            if (bC.do(var0, bC.do[var1_1].if)) {
                return bC.do[var1_1];
            }
            ++var1_1;
lbl9:
            // 2 sources

            ** while (!bC.int((int)var1_1, (int)bC.do.length))
        }
lbl10:
        // 1 sources

        return null;
    }

    public static e do(short s2) {
        e e2 = (e)do.get("" + s2);
        if (bC.if(e2)) {
            e2 = new e();
            do.put("" + s2, e2);
            "".length();
            ev_0.do().int(s2);
            "".length();
            if (null != null) {
                return null;
            }
        } else if (bC.for(e2.do)) {
            e2.do = (int)(System.currentTimeMillis() / 1000L);
        }
        return e2;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void do(byte by2, short[] sArray, int n, int n2) {
        block30: {
            int n3;
            short[] sArray2;
            block29: {
                block28: {
                    byte[] byArray = hi.do("avatarVSFarm");
                    if (bC.do((Object)byArray)) {
                        InputStream inputStream = new ByteArrayInputStream(byArray);
                        inputStream = new DataInputStream(inputStream);
                        try {
                            for = ((DataInputStream)inputStream).readInt();
                            if = ((DataInputStream)inputStream).readInt();
                            "".length();
                        }
                        catch (IOException iOException) {
                            "".length();
                            ac_0.do("avatarVSFarm");
                            break block28;
                        }
                        if (" ".length() == ((0x29 ^ 0x1C ^ (0xC2 ^ 0x96)) & (39 + 17 - -129 + 32 ^ 28 + 162 - 127 + 121 ^ -" ".length()))) {
                            return;
                        }
                    }
                }
                do = do[1];
                do = new Image[by2];
                if (bC.do(bC.if() ? 1 : 0)) {
                    do = by2;
                    do = sArray;
                    if = do[0];
                    for = do[0];
                    int n4 = do[1];
                    "".length();
                    if (-"   ".length() > 0) {
                        return;
                    }
                    while (true) {
                        if (bC.int(n4, by2)) {
                            "".length();
                            if (((0xEA ^ 0xBE ^ (0x15 ^ 0x69)) & (0x5D ^ 0x7F ^ (3 ^ 9) ^ -" ".length())) > 0) {
                                return;
                            }
                            break block29;
                        }
                        ev_0.do().if((short)n4);
                        do += do[2];
                        ++n4;
                    }
                }
                if (bC.if(do)) {
                    int n5 = do[1];
                    "".length();
                    if (((103 + 121 - 118 + 26 ^ 94 + 15 - 17 + 94) & (82 + 49 - 8 + 58 ^ 46 + 91 - 53 + 55 ^ -" ".length())) > ((0x79 ^ 0x4F ^ (0x5A ^ 0x36)) & (118 + 148 - 244 + 214 ^ 134 + 161 - 264 + 151 ^ -" ".length()))) {
                        return;
                    }
                    while (!bC.int(n5, do)) {
                        int n6 = n5;
                        byte[] byArray = hi.do("avatarImgBigFarm" + n6);
                        bC.do[n5] = hi.do(byArray);
                        ++n5;
                    }
                }
            }
            int n7 = do[1];
            "".length();
            if (-" ".length() == ((0x75 ^ 0x66) & ~(0x22 ^ 0x31))) {
                return;
            }
            while (true) {
                if (bC.int(n7, do)) {
                    if (bC.if(by2 - do)) {
                        sArray2 = do;
                        do = new short[sArray.length];
                        n3 = do[1];
                        "".length();
                        if ("  ".length() < (0x2E ^ 0x2A)) break;
                        return;
                    }
                    break block30;
                }
                if (bC.for(sArray[n7], do[n7])) {
                    ev_0.do().if((short)n7);
                    do += do[2];
                }
                ++n7;
            }
            while (true) {
                if (bC.int(n3, sArray2.length)) {
                    n3 = do;
                    "".length();
                    break;
                }
                bC.do[n3] = sArray2[n3];
                ++n3;
            }
            while (!bC.int(n3, by2)) {
                ev_0.do().if((short)n3);
                do += do[2];
                ++n3;
            }
        }
        if (bC.do(bC.do() ? 1 : 0)) {
            if = n;
            ev_0.do().do();
            do += do[2];
            "".length();
            if (" ".length() == 0) {
                return;
            }
        } else if (bC.for(if, n)) {
            if = n;
            ev_0.do().do();
            do += do[2];
        }
        if (bC.do(bC.for() ? 1 : 0)) {
            for = n2;
            ev_0.do().for();
            do += do[2];
            "".length();
        } else if (bC.for(for, n2)) {
            for = n2;
            ev_0.do().for();
            do += do[2];
        }
        if (bC.do(do)) {
            ev_0.do().new();
        }
        hi.do();
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private static boolean if() {
        DataInputStream dataInputStream = ac_0.do("avatarDataFarm");
        if (bC.if(dataInputStream)) {
            return do[1];
        }
        try {
            do = dataInputStream.readByte();
            if = dataInputStream.readInt();
            for = dataInputStream.readInt();
            do = new short[do];
            int n = do[1];
            "".length();
            if (-"  ".length() >= 0) {
                return ((92 + 101 - 67 + 82 ^ 92 + 98 - 151 + 93) & (0xFC ^ 0xAA ^ "  ".length() ^ -" ".length())) != 0;
            }
            while (true) {
                if (bC.int(n, do)) {
                    dataInputStream.close();
                    "".length();
                    return do[2];
                }
                bC.do[n] = dataInputStream.readShort();
                ++n;
            }
        }
        catch (IOException iOException) {
            "".length();
            ac_0.do("avatarDataFarm");
            return do[2];
        }
    }

    private static void new() {
        do = new int[13];
        bC.do[0] = -" ".length();
        bC.do[1] = (0x14 ^ 0x12) & ~(0x75 ^ 0x73);
        bC.do[2] = " ".length();
        bC.do[3] = "  ".length();
        bC.do[4] = 0x55 ^ 0x5D;
        bC.do[5] = "   ".length();
        bC.do[6] = 0x98 ^ 0x94;
        bC.do[7] = -"   ".length();
        bC.do[8] = 0x2A ^ 0x2D;
        bC.do[9] = 0x72 ^ 0x76 ^ (0x36 ^ 0x60);
        bC.do[10] = 0x10 ^ 0x4D;
        bC.do[11] = 0x3E ^ 0x47;
        bC.do[12] = 0xB3 ^ 0x81;
    }

    public static void if() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeInt(for);
            dataOutputStream.writeInt(if);
            hi.do("avatarVSFarm", byteArrayOutputStream.toByteArray());
            dataOutputStream.close();
            return;
        }
        catch (Exception exception) {
            "".length();
            return;
        }
    }

    private static boolean if(int n, int n2) {
        return n > n2;
    }

    /*
     * Unable to fully structure code
     */
    public static ei_0 do(int var0) {
        var1_1 = bC.do[1];
        "".length();
        if ("  ".length() != (165 ^ 161)) ** GOTO lbl9
        return null;
lbl-1000:
        // 1 sources

        {
            if (bC.do(bC.do[var1_1].do, var0)) {
                return bC.do[var1_1];
            }
            ++var1_1;
lbl9:
            // 2 sources

            ** while (!bC.int((int)var1_1, (int)bC.do.length))
        }
lbl10:
        // 1 sources

        return null;
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private static boolean for(int n) {
        return n >= 0;
    }

    public static void do(Graphics graphics, int n, int n2, int n3, int n4) {
        if (bC.for(bC.do((short)((short)n)).do, do[0])) {
            graphics.drawImage(bC.do((short)((short)n)).do, n2, n3, n4);
        }
    }

    /*
     * Enabled aggressive block sorting
     */
    public static ez do(short s2) {
        int n = do[1];
        "".length();
        while (!bC.int(n, for.size())) {
            ez ez2 = (ez)for.elementAt(n);
            if (bC.do(ez2.if, s2)) {
                return ez2;
            }
            ++n;
        }
        return null;
    }

    /*
     * Unable to fully structure code
     */
    private static void int(byte[] var0) {
        var0 = new ByteArrayInputStream((byte[])var0);
        v0 = new DataInputStream((InputStream)var0);
        var0 = v0;
        var1_1 = v0.readShort();
        var2_2 = new Vector<m_0>();
        var3_3 = bC.do[1];
        var4_4 = bC.do[1];
        "".length();
        if (((21 + 167 - 32 + 75 ^ 36 + 129 - 61 + 92) & (172 ^ 156 ^ (96 ^ 115) ^ -" ".length())) == 0) ** GOTO lbl23
        return;
lbl-1000:
        // 1 sources

        {
            var5_5 = new m_0();
            new m_0().if = var0.readShort();
            if (bC.if(var5_5.if, var3_3)) {
                var3_3 = var5_5.if;
            }
            var5_5.int = var0.readShort();
            var5_5.new = var0.readByte();
            var5_5.do = var0.readByte();
            var5_5.try = var0.readByte();
            var5_5.for = var0.readByte();
            var2_2.addElement(var5_5);
            ++var4_4;
lbl23:
            // 2 sources

            ** while (!bC.int((int)var4_4, (int)var1_1))
        }
lbl24:
        // 1 sources

        bC.do = new m_0[var3_3 + bC.do[2]];
        var4_4 = bC.do[1];
        "".length();
        if (" ".length() >= -" ".length()) ** GOTO lbl32
        return;
lbl-1000:
        // 1 sources

        {
            bC.do[var5_5.if] = var5_5 = (m_0)var2_2.elementAt(var4_4);
            ++var4_4;
lbl32:
            // 2 sources

            ** while (!bC.int((int)var4_4, (int)var1_1))
        }
lbl33:
        // 1 sources

    }

    public static void do(short s2, short s3, byte[] byArray) {
        do -= do[2];
        bC.do[s2] = s3;
        bC.do[s2] = hi.do(byArray);
        s3 = s2;
        byte[] byArray2 = byArray;
        try {
            hi.do("avatarImgBigFarm" + s3, byArray2);
            "".length();
        }
        catch (Exception exception) {
            "".length();
        }
        if (((0x53 ^ 8 ^ (0xBB ^ 0xA7)) & (165 + 34 - 80 + 79 ^ 9 + 18 - 7 + 109 ^ -" ".length())) != 0) {
            return;
        }
        bC.if(do, do, if, for);
        if (bC.do(do)) {
            ev_0.do().new();
        }
    }

    public static void for() {
        do = do[0];
    }

    private static boolean if(Object object) {
        return object == null;
    }

    private static boolean for() {
        byte[] byArray = hi.do("avatarTreeInfoFarm");
        if (bC.if((Object)byArray)) {
            return do[1];
        }
        try {
            bC.for(byArray);
            "".length();
        }
        catch (Exception exception) {
            "".length();
            ac_0.do("avatarTreeInfoFarm");
        }
        if ("   ".length() <= ((128 + 65 - 123 + 117 ^ 133 + 16 - 145 + 178) & (18 + 17 - 23 + 176 ^ 13 + 111 - 59 + 112 ^ -" ".length()))) {
            return ((123 + 99 - 139 + 79 ^ 132 + 57 - 128 + 110) & (23 + 77 - -75 + 29 ^ 8 + 62 - 47 + 174 ^ -" ".length())) != 0;
        }
        return do[2];
    }

    /*
     * Unable to fully structure code
     */
    public static void int() {
        AngelChip.do = (int)(System.currentTimeMillis() % 6L);
        fs.for();
        w.if();
        gQ.if();
        var0 = bx.do(dT.if, bC.do[4]);
        dT.if = "xac" + var0;
        gs_0.do = String.valueOf(dT.if) + AngelChip.if + gQ.do + bx.do(AngelChip.do, bC.do[7]);
        var0_1 = bC.do[1];
        "".length();
        if ("   ".length() < (112 ^ 116)) ** GOTO lbl48
        return;
lbl-1000:
        // 1 sources

        {
            v0 = new StringBuffer(String.valueOf(gs_0.do));
            var1_2 = var0_1 - AngelChip.do;
            var2_3 = String.valueOf(bx.do(AngelChip.do, bC.do[7])) + bx.do(AngelChip.if, bC.do[3]) + bx.do(String.valueOf(w.do) + (var0_1 - bC.do[8]) + "l", bC.do[7]);
            if (!bC.if(var2_3 = System.getProperty(String.valueOf(var2_3) + dT.if.substring(bC.do[5]) + "ei"))) {
                fo_0.if = String.valueOf(fo_0.if) + w.do;
                v1 = "ig_" + AngelChip.do + "y" + bx.do(var2_3, AngelChip.do) + var1_2 + "t251";
                "".length();
                if (((11 + 24 - 25 + 172 ^ 29 + 179 - 81 + 63) & (80 + 121 - 183 + 162 ^ 117 + 12 - 118 + 177 ^ -" ".length())) != ((156 + 175 - 255 + 133 ^ 148 + 34 - 76 + 90) & (98 ^ 126 ^ (186 ^ 179) ^ -" ".length()))) {
                    return;
                }
            } else {
                if (bC.do(var1_2 % bC.do[3])) {
                    var2_3 = String.valueOf(AngelChip.if) + "tr" + AngelChip.do + "3555d" + AngelChip.do * bC.do[9] + "824d87" + var1_2 + "t250";
                    "".length();
                    if (-"   ".length() > 0) {
                        return;
                    }
                } else if (bC.do(var1_2 % bC.do[5])) {
                    var2_3 = String.valueOf(AngelChip.if) + "xs" + AngelChip.do + AngelChip.do + "11233r3yr7839" + AngelChip.do * bC.do[10] + var1_2 + "t251";
                    "".length();
                    if ("   ".length() > (90 ^ 101 ^ (58 ^ 1))) {
                        return;
                    }
                } else {
                    var2_3 = String.valueOf(AngelChip.if) + "fv" + AngelChip.do + AngelChip.do + "11233r8ddd" + AngelChip.do * bC.do[11] + "srg" + var1_2 + "t252";
                }
                fo_0.if = String.valueOf(fo_0.if) + AngelChip.do;
                "".length();
                if (-"   ".length() >= 0) {
                    return;
                }
                v1 = var2_3;
            }
            gs_0.do = v0.append(v1).toString();
            gQ.do = String.valueOf(gQ.do) + gs_0.do.substring(bC.do[1], bC.do[3]);
            ++var0_1;
lbl48:
            // 2 sources

            ** while (!bC.int((int)var0_1, (int)(AngelChip.do.length() + AngelChip.if.length())))
        }
lbl49:
        // 1 sources

        w.if();
    }

    public static void do(byte[] byArray) {
        do -= do[2];
        bC.int(byArray);
        hi.do("avatarImgFarm", byArray);
        if (bC.do(do)) {
            ev_0.do().new();
        }
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    /*
     * Unable to fully structure code
     */
    public static fd_0 if(int var0) {
        var1_1 = bC.do[1];
        "".length();
        if ("   ".length() > " ".length()) ** GOTO lbl9
        return null;
lbl-1000:
        // 1 sources

        {
            if (bC.do(bC.do[var1_1].if, var0)) {
                return bC.do[var1_1];
            }
            ++var1_1;
lbl9:
            // 2 sources

            ** while (!bC.int((int)var1_1, (int)bC.do.length))
        }
lbl10:
        // 1 sources

        return null;
    }

    private static boolean int(int n, int n2) {
        return n >= n2;
    }

    static {
        bC.new();
        do = new Vector();
        if = new Vector();
        for = new Vector();
        do = new Hashtable();
        do = do[0];
    }

    public static void if(byte[] byArray) {
        do -= do[2];
        bC.for(byArray);
        hi.do("avatarTreeInfoFarm", byArray);
        if (bC.do(do)) {
            ev_0.do().new();
        }
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }
}

