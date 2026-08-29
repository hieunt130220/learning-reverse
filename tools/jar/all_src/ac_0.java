/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 *  javax.microedition.rms.RecordStore
 */
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Vector;
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;
import javax.microedition.rms.RecordStore;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from aC
 */
public final class ac_0 {
    private static Vector try;
    public static Vector do;
    private static int if;
    public static ao_0[] do;
    private static Hashtable int;
    public static int do;
    public static Vector if;
    private static int for;
    public static Hashtable do;
    public static Vector for;
    private static int int;
    public static Hashtable if;
    public static Hashtable for;
    private static int new;
    private static int[] do;
    public static Vector int;
    private static int try;
    private static String if;
    public static m_0[] do;
    public static String do;
    public static Vector new;
    private static Hashtable new;

    /*
     * Unable to fully structure code
     */
    private static m_0[] do(byte[] var0) {
        var0 = new ByteArrayInputStream((byte[])var0);
        v0 = new DataInputStream((InputStream)var0);
        var0 = v0;
        var1_1 = v0.readShort();
        var2_2 = new Vector<m_0>();
        var3_3 = ac_0.do[1];
        var4_4 = ac_0.do[1];
        "".length();
        if (((34 ^ 121) & ~(92 ^ 7)) == 0) ** GOTO lbl23
        return null;
lbl-1000:
        // 1 sources

        {
            var5_6 = new m_0();
            new m_0().if = var0.readShort();
            if (ac_0.new(var5_6.if, var3_3)) {
                var3_3 = var5_6.if;
            }
            var5_6.int = var0.readShort();
            var5_6.new = (short)var0.readUnsignedByte();
            var5_6.do = (short)var0.readUnsignedByte();
            var5_6.try = var0.readByte();
            var5_6.for = var0.readByte();
            var2_2.addElement(var5_6);
            ++var4_4;
lbl23:
            // 2 sources

            ** while (!ac_0.do((int)var4_4, (int)var1_1))
        }
lbl24:
        // 1 sources

        var4_5 = new m_0[var3_3 + ac_0.do[2]];
        var5_7 = ac_0.do[1];
        "".length();
        if (" ".length() > 0) ** GOTO lbl32
        return null;
lbl-1000:
        // 1 sources

        {
            var4_5[var0.if] = var0 = (m_0)var2_2.elementAt(var5_7);
            ++var5_7;
lbl32:
            // 2 sources

            ** while (!ac_0.do((int)var5_7, (int)var2_2.size()))
        }
lbl33:
        // 1 sources

        return var4_5;
    }

    private static boolean if(int n) {
        return n > 0;
    }

    public static void do(byte[] byArray) {
        do -= do[2];
        ac_0.try(byArray);
        hi.do("avatarItemInfo", byArray);
        ac_0.byte();
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    /*
     * Unable to fully structure code
     */
    private static void try(byte[] var0) {
        var0 = new ByteArrayInputStream((byte[])var0);
        v0 = new DataInputStream((InputStream)var0);
        var0 = v0;
        var1_1 = v0.readShort();
        ac_0.new = new Vector<E>();
        var2_2 = ac_0.do[1];
        "".length();
        if ((11 ^ 15) >= "  ".length()) ** GOTO lbl23
        return;
lbl-1000:
        // 1 sources

        {
            var3_3 = new ei_0();
            new ei_0().do = var0.readShort();
            var3_3.do = var0.readUTF();
            var0.readUTF();
            "".length();
            var3_3.do[ac_0.do[1]] = var0.readInt();
            var3_3.do = var0.readByte();
            var3_3.if = var0.readShort();
            ac_0.new.addElement(var3_3);
            ++var2_2;
lbl23:
            // 2 sources

            ** while (!ac_0.do((int)var2_2, (int)var1_1))
        }
lbl24:
        // 1 sources

    }

    public static String do(ao_0 ao_02) {
        if (ac_0.for(ao_02.int)) {
            return ac_0.do((short)ao_02.int).do;
        }
        return ao_02.do;
    }

    private static boolean for(int n) {
        return n >= 0;
    }

    /*
     * Unable to fully structure code
     */
    private static void try() {
        var0 = ac_0.do[1];
        "".length();
        if ("  ".length() != -" ".length()) ** GOTO lbl14
        return;
lbl-1000:
        // 1 sources

        {
            if (ac_0.for(ac_0.do[var0].int)) {
                var1_1 = ac_0.do[ac_0.do[var0].int];
                var2_2 = ac_0.do[var0];
                ac_0.do[var0].do = var1_1.do;
                var2_2.if = var1_1.if;
                var2_2.do = var1_1.do;
                var2_2.if = var1_1.if;
            }
            ++var0;
lbl14:
            // 2 sources

            ** while (!ac_0.do((int)var0, (int)ac_0.do.length))
        }
lbl15:
        // 1 sources

    }

    public static void do(Graphics graphics, int n, int n2, int n3, int n4, int n5, int n6, int n7, int n8) {
        if (!ac_0.int(n8) || ac_0.new(bx.int ? 1 : 0) && ac_0.new(bx.do ? 1 : 0)) {
            graphics.drawRegion(ac_0.do((int)n).do, n2 * dH.this, n3 * dH.this, n4 * dH.this, n5 * dH.this, n8, n6, n7, do[1]);
            return;
        }
        int n9 = n;
        graphics.drawRegion(((ht)ac_0.int.get((Object)new StringBuffer().append((int)n9).toString())).do, n2 * dH.this, n3 * dH.this, n4 * dH.this, n5 * dH.this, do[1], n6, n7, do[1]);
    }

    public static void if(byte[] byArray) {
        do -= do[2];
        int.removeAllElements();
        ac_0.byte(byArray);
        hi.do("avatarMapType", byArray);
        ac_0.byte();
    }

    public static e do(short s2) {
        e e2 = (e)if.get("" + s2);
        if (ac_0.do(e2)) {
            e2 = new e();
            if.put("" + s2, e2);
            "".length();
            fv_0.do().for(s2);
            "".length();
            if (null != null) {
                return null;
            }
        } else if (ac_0.for(e2.do)) {
            e2.do = (int)(System.currentTimeMillis() / 1000L);
        }
        return e2;
    }

    private static boolean do(Object object) {
        return object == null;
    }

    /*
     * Unable to fully structure code
     */
    public static void do(ht var0) {
        ac_0.do -= ac_0.do[2];
        var1_1 = ac_0.try.size();
        var2_2 = ac_0.do[1];
        "".length();
        if ("   ".length() >= "  ".length()) ** GOTO lbl18
        return;
lbl-1000:
        // 1 sources

        {
            var3_3 = (ht)ac_0.try.elementAt(var2_2);
            if (ac_0.int(var3_3.if, var0.if)) {
                var3_3.do = var0.do;
                var3_3.do = var0.do;
                var3_3.for = var0.for;
                "".length();
                if ("  ".length() != 0) break;
                return;
            }
            ++var2_2;
lbl18:
            // 2 sources

            ** while (!ac_0.do((int)var2_2, (int)var1_1))
        }
lbl19:
        // 2 sources

        ac_0.byte();
    }

    /*
     * Unable to fully structure code
     */
    private static boolean do() {
        block2: {
            var0 = hi.do("avatarPart");
            if (!ac_0.do((Object)ac_0.do)) break block2;
            var1_1 = ac_0.if.toCharArray();
            var2_2 = ac_0.do[1];
            var3_3 = ac_0.do[2];
            "".length();
            if ("   ".length() > ("   ".length() & ~"   ".length())) ** GOTO lbl13
            return (boolean)((63 ^ 103) & ~(12 ^ 84));
lbl-1000:
            // 1 sources

            {
                var4_5 = Integer.parseInt(String.valueOf(var1_1[var3_3]));
                var2_2 += var4_5;
                var3_3 += 2;
lbl13:
                // 2 sources

                ** while (!ac_0.do((int)var3_3, (int)(var1_1.length - ac_0.do[2])))
            }
lbl14:
            // 1 sources

            var3_4 = String.valueOf(var2_2);
            ac_0.do = String.valueOf(var3_4.length()) + ac_0.if.substring(ac_0.do[1], ac_0.do[5]) + var2_2 + ac_0.if.substring(ac_0.do[5], ac_0.if.length());
        }
        if (ac_0.do((Object)var0)) {
            return ac_0.do[1];
        }
        ac_0.do = ac_0.do(ac_0.do(var0, ac_0.do[1]));
        return ac_0.do[2];
    }

    private static boolean int(int n) {
        return n != 0;
    }

    public static e if(short s2) {
        e e2 = (e)do.get("" + s2);
        if (ac_0.do(e2)) {
            e2 = new e();
            do.put("" + s2, e2);
            "".length();
            er_0.do().do(s2);
            "".length();
            if (" ".length() <= 0) {
                return null;
            }
        } else if (ac_0.for(e2.do)) {
            e2.do = (int)(System.currentTimeMillis() / 1000L);
        }
        return e2;
    }

    /*
     * Unable to fully structure code
     */
    public static ho do(short var0) {
        var1_1 = ac_0.do[1];
        "".length();
        if ((179 ^ 180 ^ "   ".length()) > 0) ** GOTO lbl10
        return null;
lbl-1000:
        // 1 sources

        {
            var2_2 = (ho)ac_0.for.elementAt(var1_1);
            if (ac_0.int(var2_2.do, var0)) {
                return var2_2;
            }
            ++var1_1;
lbl10:
            // 2 sources

            ** while (!ac_0.do((int)var1_1, (int)ac_0.for.size()))
        }
lbl11:
        // 1 sources

        return null;
    }

    /*
     * Unable to fully structure code
     */
    private static ao_0[] do(Vector var0) {
        var1_1 = ac_0.do[1];
        var2_3 = ac_0.do[1];
        "".length();
        if (null == null) ** GOTO lbl11
        return null;
lbl-1000:
        // 1 sources

        {
            var3_5 = (ao_0)var0.elementAt(var2_3);
            if (ac_0.new(var3_5.for, var1_1)) {
                var1_1 = var3_5.for;
            }
            ++var2_3;
lbl11:
            // 2 sources

            ** while (!ac_0.do((int)var2_3, (int)var0.size()))
        }
lbl12:
        // 1 sources

        var2_4 = new ao_0[var1_1 + ac_0.do[2]];
        var3_6 = ac_0.do[1];
        "".length();
        if (-" ".length() <= (97 ^ 59 ^ (219 ^ 133))) ** GOTO lbl20
        return null;
lbl-1000:
        // 1 sources

        {
            var2_4[var1_2.for] = var1_2 = (ao_0)var0.elementAt(var3_6);
            ++var3_6;
lbl20:
            // 2 sources

            ** while (!ac_0.do((int)var3_6, (int)var0.size()))
        }
lbl21:
        // 1 sources

        return var2_4;
    }

    /*
     * Unable to fully structure code
     */
    public static void do(Vector var0, int var1_1, int var2_2, int var3_3, int var4_4, int var5_5) {
        hi.do("avatar", "2.5.8");
        try {
            block45: {
                block44: {
                    ac_0.do = ac_0.do[1];
                    var6_6 = hi.do("avatarVs");
                    if (ac_0.if(var6_6)) {
                        var6_6 = new ByteArrayInputStream((byte[])var6_6);
                        v0 = new DataInputStream((InputStream)var6_6);
                        var6_6 = v0;
                        ac_0.int = v0.readInt();
                        ac_0.if = var6_6.readInt();
                        ac_0.new = var6_6.readInt();
                        ac_0.for = var6_6.readInt();
                        ac_0.try = var6_6.readInt();
                    }
                    if (!ac_0.new((int)ac_0.if())) break block44;
                    ac_0.try = var0;
                    var6_7 = var0.size();
                    var7_9 = ac_0.do[1];
                    "".length();
                    if (-" ".length() < ((104 ^ 60) & ~(81 ^ 5))) ** GOTO lbl26
                    return;
lbl-1000:
                    // 1 sources

                    {
                        var8_11 = (ht)var0.elementAt(var7_9);
                        er_0.do().for(var8_11.if);
                        ac_0.do += ac_0.do[2];
                        ++var7_9;
lbl26:
                        // 2 sources

                        ** while (!ac_0.do((int)var7_9, (int)var6_7))
                    }
lbl27:
                    // 1 sources

                    "".length();
                    if (null != null) {
                        return;
                    }
                    break block45;
                }
                var6_7 = var0.size();
                var7_10 = ac_0.do[1];
                "".length();
                if ((185 ^ 189) > 0) ** GOTO lbl54
                return;
lbl-1000:
                // 1 sources

                {
                    var8_12 = (ht)var0.elementAt(var7_10);
                    var9_13 = ac_0.if((int)var8_12.if);
                    if (ac_0.do((Object)var9_13)) {
                        ac_0.try.addElement(var8_12);
                        er_0.do().for(var8_12.if);
                        ac_0.do += ac_0.do[2];
                        "".length();
                        if ("   ".length() <= -" ".length()) {
                            return;
                        }
                    } else if (ac_0.for(var8_12.do, var9_13.do)) {
                        er_0.do().for(var8_12.if);
                        ac_0.do += ac_0.do[2];
                    }
                    ++var7_10;
lbl54:
                    // 2 sources

                    ** while (!ac_0.do((int)var7_10, (int)var6_7))
                }
            }
            var6_8 = hi.do("avatarImgData");
            ac_0.do = hi.do("partImageNormal");
            if (ac_0.do((Object)var6_8)) {
                v1 = ac_0.do[1];
                "".length();
                if (((43 ^ 9) & ~(173 ^ 143)) == " ".length()) {
                    return;
                }
            } else {
                ac_0.do = ac_0.do(var6_8);
                v1 = ac_0.do[2];
            }
            if (ac_0.new(v1)) {
                ac_0.new = var1_1;
                er_0.do().for();
                ac_0.do += ac_0.do[2];
                "".length();
                if (((187 ^ 169) & ~(34 ^ 48)) != 0) {
                    return;
                }
            } else if (ac_0.for(ac_0.new, var1_1)) {
                ac_0.new = var1_1;
                er_0.do().for();
                ac_0.do += ac_0.do[2];
            }
            if (ac_0.new((int)ac_0.do())) {
                ac_0.int = var2_2;
                er_0.do().new();
                ac_0.do += ac_0.do[2];
                "".length();
                if ("   ".length() < "  ".length()) {
                    return;
                }
            } else if (ac_0.for(ac_0.int, var2_2)) {
                ac_0.int = var2_2;
                er_0.do().new();
                ac_0.do += ac_0.do[2];
                "".length();
                if ((52 ^ 48) <= " ".length()) {
                    return;
                }
            } else {
                ac_0.try();
            }
            if (ac_0.do((Object)(var6_8 = hi.do("avatarItemInfo")))) {
                v2 = ac_0.do[1];
                "".length();
                if ("  ".length() == 0) {
                    return;
                }
            } else {
                ac_0.try(var6_8);
                v2 = ac_0.do[2];
            }
            if (ac_0.new(v2)) {
                ac_0.for = var3_3;
                er_0.do().byte();
                ac_0.do += ac_0.do[2];
                "".length();
                if (null != null) {
                    return;
                }
            } else if (ac_0.for(ac_0.for, var3_3)) {
                ac_0.for = var3_3;
                er_0.do().byte();
                ac_0.do += ac_0.do[2];
            }
            if (ac_0.do((Object)(var6_8 = hi.do("avatarMapItemType")))) {
                v3 = ac_0.do[1];
                "".length();
                if (-(182 ^ 128 ^ (127 ^ 77)) > 0) {
                    return;
                }
            } else {
                ac_0.do = ac_0.do(var6_8);
                v3 = ac_0.do[2];
            }
            if (ac_0.new(v3)) {
                ac_0.if = var4_4;
                er_0.do().int();
                ac_0.do += ac_0.do[2];
                "".length();
                if (-"   ".length() > 0) {
                    return;
                }
            } else if (ac_0.for(ac_0.if, var4_4)) {
                ac_0.if = var4_4;
                er_0.do().int();
                ac_0.do += ac_0.do[2];
            }
            if (ac_0.do((Object)(var6_8 = hi.do("avatarMapType")))) {
                v4 = ac_0.do[1];
                "".length();
                if ("  ".length() != "  ".length()) {
                    return;
                }
            } else {
                ac_0.byte(var6_8);
                v4 = ac_0.do[2];
            }
            if (ac_0.new(v4)) {
                ac_0.try = var5_5;
                er_0.do().do();
                ac_0.do += ac_0.do[2];
                "".length();
                if (-(122 ^ 53 ^ (22 ^ 93)) >= 0) {
                    return;
                }
            } else if (ac_0.for(ac_0.try, var5_5)) {
                ac_0.try = var5_5;
                er_0.do().do();
                ac_0.do += ac_0.do[2];
            }
            ac_0.byte();
            return;
        }
        catch (Exception v5) {
            v5.printStackTrace();
            return;
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private static void byte() {
        ht ht2;
        if (ac_0.int(do)) {
            return;
        }
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeInt(int);
            dataOutputStream.writeInt(if);
            dataOutputStream.writeInt(new);
            dataOutputStream.writeInt(for);
            dataOutputStream.writeInt(try);
            hi.do("avatarVs", byteArrayOutputStream.toByteArray());
            dataOutputStream.close();
            "".length();
        }
        catch (Exception exception) {
            "".length();
        }
        ac_0.char();
        int n = try.size();
        int n2 = do[1];
        "".length();
        while (true) {
            if (ac_0.do(n2, n)) {
                if (!ac_0.new(bx.int ? 1 : 0) || ac_0.int(bx.do ? 1 : 0)) {
                    int = new Hashtable();
                }
                break;
            }
            ht2 = (ht)try.elementAt(n2);
            if (ac_0.for(ht2.for, do[0])) {
                byte[] byArray = ac_0.if((int)ht2.for).do;
                System.arraycopy(ht2.do, do[1], byArray, do[1], ht2.do.length);
                ht2.do = byArray;
            }
            ht2.do = hi.do(ht2.do);
            ++n2;
        }
        n2 = do[1];
        "".length();
        while (true) {
            if (ac_0.do(n2, try.size())) {
                n2 = do[1];
                "".length();
                if (-" ".length() <= " ".length()) break;
                return;
            }
            ht2 = (ht)try.elementAt(n2);
            ((ht)try.elementAt(n2)).do = null;
            new.put("" + ht2.if, ht2);
            "".length();
            ++n2;
        }
        while (true) {
            if (ac_0.do(n2, try.size())) {
                try.removeAllElements();
                try = null;
                AngelChip.do.for();
                gs_0.do().throw();
                return;
            }
            ht2 = (ht)try.elementAt(n2);
            if (ac_0.if(int)) {
                ac_0.if(ht2);
            }
            ++n2;
        }
    }

    /*
     * Enabled aggressive block sorting
     */
    public static cj do(Vector vector, int n) {
        int n2 = vector.size();
        int n3 = do[1];
        "".length();
        while (!ac_0.do(n3, n2)) {
            cj cj2 = (cj)vector.elementAt(n3);
            if (ac_0.int(cj2.do, n)) {
                return cj2;
            }
            ++n3;
        }
        return null;
    }

    public static int do(ao_0 ao_02) {
        byte by2;
        if (ac_0.for(ao_02.int)) {
            by2 = ((da)ac_0.do((short)ao_02.int)).for;
            "".length();
            if (-(0xC6 ^ 0xC2) >= 0) {
                return (0xB1 ^ 0xBD) & ~(0x62 ^ 0x6E);
            }
        } else {
            by2 = ((da)ao_02).for;
        }
        return by2;
    }

    /*
     * Unable to fully structure code
     */
    private static Vector do(byte[] var0) {
        var0 = new ByteArrayInputStream((byte[])var0);
        v0 = new DataInputStream((InputStream)var0);
        var0 = v0;
        var1_1 = v0.readShort();
        var2_2 = new Vector<gw_0>();
        var3_3 = ac_0.do[1];
        "".length();
        if ((163 ^ 167) >= 0) ** GOTO lbl44
        return null;
lbl-1000:
        // 1 sources

        {
            var4_4 = new gw_0();
            new gw_0().if = var0.readShort();
            var4_4.do = var0.readUTF();
            var0.readUTF();
            "".length();
            var4_4.do = var0.readShort();
            var4_4.for = var0.readShort();
            var4_4.int = var0.readByte();
            var4_4.try = var0.readByte();
            var4_4.do = var0.readShort();
            if (ac_0.int(var4_4.do, ac_0.do[6])) {
                var4_4.do = ac_0.do[0];
            }
            if (ac_0.for(var4_4.do)) {
                var4_4.do *= ac_0.do[7];
            }
            var4_4.new = var0.readShort();
            var4_4.do = var0.readByte();
            var4_4.do = new Vector<E>();
            var5_5 = var0.readByte();
            var6_6 = ac_0.do[1];
            "".length();
            if (-"   ".length() < 0) ** GOTO lbl41
            return null;
lbl-1000:
            // 1 sources

            {
                var7_7 = new fw();
                new fw().if = var0.readByte();
                var7_7.for = var0.readByte();
                var4_4.do.addElement(var7_7);
                var6_6 = (byte)(var6_6 + ac_0.do[2]);
lbl41:
                // 2 sources

                ** while (!ac_0.do((int)var6_6, (int)var5_5))
            }
lbl42:
            // 1 sources

            var2_2.addElement(var4_4);
            var3_3 = (byte)(var3_3 + ac_0.do[2]);
lbl44:
            // 2 sources

            ** while (!ac_0.do((int)var3_3, (int)var1_1))
        }
lbl45:
        // 1 sources

        return var2_2;
    }

    public static void for(byte[] byArray) {
        do -= do[2];
        do = ac_0.do(ac_0.do(byArray, do[1]));
        hi.do("avatarPart", byArray);
        ac_0.try();
        ac_0.byte();
    }

    /*
     * Enabled aggressive block sorting
     */
    private static void byte(byte[] object) {
        object = new ByteArrayInputStream((byte[])object);
        object = new DataInputStream((InputStream)object);
        int = new Vector();
        short s2 = ((DataInputStream)object).readShort();
        System.out.println("readMapItem: " + s2);
        int n = do[1];
        "".length();
        while (!ac_0.do(n, (int)s2)) {
            bE bE2 = new bE();
            new bE().if = ((DataInputStream)object).readShort();
            bE2.do = ((DataInputStream)object).readShort();
            bE2.char = ((DataInputStream)object).readByte();
            bE2.int = ((DataInputStream)object).readByte();
            bE2.for = ((DataInputStream)object).readByte();
            int.addElement(bE2);
            n = (byte)(n + do[2]);
        }
    }

    private static boolean if(Object object) {
        return object != null;
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void do() {
        try {
            String[] stringArray = RecordStore.listRecordStores();
            if (!ac_0.if(stringArray)) return;
            int n = do[1];
            "".length();
            while (true) {
                if (ac_0.do(n, stringArray.length)) {
                    return;
                }
                RecordStore.deleteRecordStore((String)stringArray[n]);
                ++n;
            }
        }
        catch (Exception exception) {
            "".length();
        }
    }

    public static void do(Graphics graphics, int n, int n2, int n3, int n4) {
        if (ac_0.for(ac_0.if((short)((short)n)).do, do[0])) {
            graphics.drawImage(ac_0.if((short)((short)n)).do, n2, n3, n4);
        }
    }

    public static DataInputStream do(String object) {
        byte[] byArray = hi.do((String)object);
        object = byArray;
        if (ac_0.do((Object)byArray)) {
            return null;
        }
        object = new ByteArrayInputStream((byte[])object);
        return new DataInputStream((InputStream)object);
    }

    static {
        ac_0.case();
        try = new Vector();
        new = new Hashtable();
        do = do[0];
        do = new Vector();
        int = new Vector();
        do = new Hashtable();
        if = new Hashtable();
        for = new Hashtable();
        for = new Vector();
    }

    public static void int(byte[] byArray) {
        do -= do[2];
        do = ac_0.do(byArray);
        hi.do("avatarImgData", byArray);
        ac_0.byte();
    }

    private static boolean if(int n, int n2) {
        return n < n2;
    }

    /*
     * Unable to fully structure code
     */
    private static void if(ht var0) {
        var1_1 = Image.createImage((int)var0.do.getWidth(), (int)var0.do.getHeight());
        var2_2 = var1_1.getGraphics();
        var2_2.setColor(ac_0.do[8]);
        var2_2.fillRect(ac_0.do[1], ac_0.do[1], var1_1.getWidth(), var1_1.getHeight());
        var3_3 = ac_0.do[1];
        "".length();
        if (null == null) ** GOTO lbl13
        return;
lbl-1000:
        // 1 sources

        {
            if (ac_0.int(var0.if, ac_0.do[var3_3].int)) {
                var2_2.drawRegion(var0.do, ac_0.do[var3_3].new * dH.this, ac_0.do[var3_3].do * dH.this, ac_0.do[var3_3].try * dH.this, ac_0.do[var3_3].for * dH.this, (int)dF.case, (int)ac_0.do[var3_3].new, (int)ac_0.do[var3_3].do, ac_0.do[1]);
            }
            ++var3_3;
lbl13:
            // 2 sources

            ** while (!ac_0.do((int)var3_3, (int)ac_0.do.length))
        }
lbl14:
        // 1 sources

        var3_3 = ac_0.do[1];
        "".length();
        if (((216 ^ 141) & ~(231 ^ 178)) == ((86 ^ 76) & ~(138 ^ 144))) ** GOTO lbl33
        return;
lbl-1000:
        // 1 sources

        {
            block5: {
                if (!ac_0.if(ac_0.do[var3_3]) || !ac_0.for(ac_0.do[var3_3].int) || !ac_0.if(ac_0.do[var3_3].for, ac_0.do[9])) break block5;
                var4_5 = (da)ac_0.do(ac_0.do[var3_3].int);
                var5_6 = ac_0.do[1];
                "".length();
                if (-" ".length() <= 0) ** GOTO lbl30
                return;
lbl-1000:
                // 1 sources

                {
                    var6_7 = ac_0.do[var4_5.do[var5_6]];
                    if (ac_0.int(((q_0)ac_0.do[var3_3]).do, var0.if)) {
                        var2_2.drawRegion(ac_0.do((int)var0.if).do, var6_7.new * dH.this, var6_7.do * dH.this, var6_7.try * dH.this, var6_7.for * dH.this, (int)dF.case, (int)var6_7.new, (int)var6_7.do, ac_0.do[1]);
                    }
                    ++var5_6;
lbl30:
                    // 2 sources

                    ** while (!ac_0.do((int)var5_6, (int)var4_5.do.length))
                }
            }
            ++var3_3;
lbl33:
            // 2 sources

            ** while (!ac_0.do((int)var3_3, (int)ac_0.do.length))
        }
lbl34:
        // 1 sources

        var1_1 = hi.do(var1_1, ac_0.do[10]);
        var3_4 = new ht();
        new ht().for = var0.for;
        var3_4.if = var0.if;
        var3_4.do = var1_1;
        var3_4.do = var0.do;
        ac_0.int.put("" + var3_4.if, var3_4);
        "".length();
    }

    public static boolean do(int n) {
        if (ac_0.for(n, do[13]) && ac_0.for(n, do[14]) && ac_0.for(n, do[15]) && ac_0.for(n, do[16]) && ac_0.for(n, do[17])) {
            return do[1];
        }
        return do[2];
    }

    public static void if() {
        hi.do(w.do, String.valueOf(AngelChip.if) + dT.if);
        hi.do(AngelChip.do, String.valueOf(hi.do) + gs_0.do);
        hi.do(hi.do, String.valueOf(AngelChip.do) + gQ.do);
    }

    public static void do(Vector vector) {
        if = vector;
    }

    /*
     * Unable to fully structure code
     */
    private static ht if(int var0) {
        var1_1 = ac_0.try.size();
        var2_2 = ac_0.do[1];
        "".length();
        if (-" ".length() < 0) ** GOTO lbl11
        return null;
lbl-1000:
        // 1 sources

        {
            var3_3 = (ht)ac_0.try.elementAt(var2_2);
            if (ac_0.int(var3_3.if, var0)) {
                return var3_3;
            }
            ++var2_2;
lbl11:
            // 2 sources

            ** while (!ac_0.do((int)var2_2, (int)var1_1))
        }
lbl12:
        // 1 sources

        return null;
    }

    public static void for() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeByte(AngelChip.do);
            dataOutputStream.writeUTF(AngelChip.for);
            hi.do("avatarSV", byteArrayOutputStream.toByteArray());
            dataOutputStream.close();
            return;
        }
        catch (Exception exception) {
            exception.printStackTrace();
            return;
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private static boolean if() {
        DataInputStream dataInputStream = ac_0.do("avatarImgBig");
        long l = System.currentTimeMillis() / 86400000L;
        String string = String.valueOf((int)(l - 15340L));
        String string2 = String.valueOf(string.length());
        if = String.valueOf(string2) + System.currentTimeMillis() + string;
        if (ac_0.do(dataInputStream)) {
            return do[1];
        }
        try {
            short s2 = dataInputStream.readShort();
            try = new Vector();
            int n = do[1];
            "".length();
            if (-"  ".length() >= 0) {
                return ((3 ^ 0xA) & ~(0x5B ^ 0x52)) != 0;
            }
            while (true) {
                if (ac_0.do(n, (int)s2)) {
                    dataInputStream.close();
                    "".length();
                    return do[2];
                }
                ht ht2 = new ht();
                new ht().if = dataInputStream.readShort();
                ht2.for = dataInputStream.readShort();
                int n2 = dataInputStream.readInt();
                ht2.do = new byte[n2];
                dataInputStream.read(ht2.do);
                "".length();
                ht2.do = dataInputStream.readShort();
                try.addElement(ht2);
                ++n;
            }
        }
        catch (Exception exception) {
            "".length();
            ac_0.do("avatarImgBig");
            return do[2];
        }
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static void case() {
        do = new int[18];
        ac_0.do[0] = -" ".length();
        ac_0.do[1] = (0x67 ^ 0x74) & ~(0x51 ^ 0x42);
        ac_0.do[2] = " ".length();
        ac_0.do[3] = -"  ".length();
        ac_0.do[4] = 0x32 ^ 0x3D;
        ac_0.do[5] = 5 ^ 0;
        ac_0.do[6] = -" ".length() & (0xFFFFFFFF & Short.MAX_VALUE);
        ac_0.do[7] = 0xFFFFC3ED & 0x3FFA;
        ac_0.do[8] = -(0xFFFFF78F & 0x3871) & (0xFFFFB5FF & 0xFF7AFF);
        ac_0.do[9] = -(0xFFFFF62F & 0x69D6) & (0xFFFFF7FD & 0x6FD7);
        ac_0.do[10] = -(0xFFFFFF67 & 0xFF99);
        ac_0.do[11] = 0xB1 ^ 0xB5;
        ac_0.do[12] = "  ".length();
        ac_0.do[13] = 0xB0 ^ 0xAE ^ (0x27 ^ 0x33);
        ac_0.do[14] = 156 + 62 - 191 + 158 ^ 77 + 162 - 172 + 106;
        ac_0.do[15] = 64 + 36 - -28 + 14 ^ 109 + 19 - 81 + 97;
        ac_0.do[16] = 0x62 ^ 0x4A;
        ac_0.do[17] = 0x7B ^ 0x49;
    }

    public static ao_0 do(short s2) {
        if (ac_0.do((int)s2, do[9])) {
            ao_0 ao_02 = (ao_0)for.get("" + s2);
            if (ac_0.do((Object)ao_02)) {
                ao_02 = new da();
                ((ao_0)new da()).for = (short)do[0];
                for.put("" + s2, ao_02);
                "".length();
                fv_0.do().do(s2);
            }
            return ao_02;
        }
        return do[s2];
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    /*
     * Enabled aggressive block sorting
     */
    public static gw_0 do(int n) {
        int n2 = do.size();
        int n3 = do[1];
        "".length();
        while (!ac_0.do(n3, n2)) {
            if (ac_0.int(((gw_0)ac_0.do.elementAt((int)n3)).if, n)) {
                return (gw_0)do.elementAt(n3);
            }
            ++n3;
        }
        return null;
    }

    public static ht do(int n) {
        return (ht)new.get("" + n);
    }

    public static void new(byte[] byArray) {
        do -= do[2];
        do.removeAllElements();
        do = ac_0.do(byArray);
        hi.do("avatarMapItemType", byArray);
        ac_0.byte();
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void int() {
        DataInputStream dataInputStream = ac_0.do("avatarSV");
        if (ac_0.do(dataInputStream)) {
            return;
        }
        try {
            if (ac_0.for(dataInputStream.readByte(), gC.do().do[do[11]])) {
                return;
            }
            byte by2 = dataInputStream.readByte();
            if (ac_0.new(by2)) {
                ac_0.do("avatarSV");
                return;
            }
            AngelChip.do = new String[do[12]][by2][];
            AngelChip.if = new String[do[12]][by2][];
            AngelChip.do = new int[do[12]][by2][];
            int n = do[1];
            "".length();
            if ("  ".length() >= (4 ^ 0)) {
                return;
            }
            block2: while (true) {
                if (ac_0.do(n, (int)by2)) {
                    dataInputStream.close();
                    return;
                }
                byte by3 = dataInputStream.readByte();
                AngelChip.do[gC.do().do[ac_0.do[11]]][n] = new String[by3 + do[2]];
                AngelChip.do[gC.do().do[ac_0.do[11]]][n][ac_0.do[1]] = dataInputStream.readUTF();
                AngelChip.if[gC.do().do[ac_0.do[11]]][n] = new String[by3];
                AngelChip.do[gC.do().do[ac_0.do[11]]][n] = new int[by3];
                int n2 = do[1];
                "".length();
                while (true) {
                    if (ac_0.do(n2, (int)by3)) {
                        ++n;
                        continue block2;
                    }
                    AngelChip.do[gC.do().do[ac_0.do[11]]][n][n2 + ac_0.do[2]] = dataInputStream.readUTF();
                    AngelChip.if[gC.do().do[ac_0.do[11]]][n][n2] = dataInputStream.readUTF();
                    AngelChip.do[gC.do().do[ac_0.do[11]]][n][n2] = dataInputStream.readInt();
                    ++n2;
                }
                break;
            }
        }
        catch (IOException iOException) {
            iOException.printStackTrace();
            ac_0.do("avatarSV");
            return;
        }
    }

    private static boolean int(int n, int n2) {
        return n == n2;
    }

    private static boolean new(int n) {
        return n == 0;
    }

    /*
     * Unable to fully structure code
     */
    public static da do(Vector var0, int var1_1) {
        block2: {
            if (!ac_0.if(var0)) break block2;
            var2_2 = ac_0.do[1];
            "".length();
            if ("  ".length() >= ((89 + 76 - 140 + 114 ^ 124 + 153 - 161 + 60) & (123 + 33 - 32 + 11 ^ 49 + 73 - 69 + 135 ^ -" ".length()))) ** GOTO lbl12
            return null;
lbl-1000:
            // 1 sources

            {
                var3_3 = (cj)var0.elementAt(var2_2);
                var4_4 = ac_0.do(var3_3.do);
                if (ac_0.if(var3_3) && ac_0.int(var4_4 instanceof da) && ac_0.int(((da)var4_4).do, var1_1)) {
                    return (da)var4_4;
                }
                ++var2_2;
lbl12:
                // 2 sources

                ** while (!ac_0.do((int)var2_2, (int)var0.size()))
            }
        }
        return null;
    }

    /*
     * Enabled aggressive block sorting
     */
    public static void new() {
        e e2;
        String string;
        Enumeration enumeration;
        if (ac_0.new(do.size(), do[17])) {
            enumeration = do.keys();
            "".length();
            while (!ac_0.new(enumeration.hasMoreElements() ? 1 : 0)) {
                string = (String)enumeration.nextElement();
                e2 = (e)do.get(string);
                if (!ac_0.for(e2.do, do[0]) || !ac_0.if(ac_0.do(System.currentTimeMillis() / 1000L - (long)e2.do, (long)bx.case))) continue;
                do.remove(string);
                "".length();
            }
        }
        if (ac_0.new(if.size(), do[17])) {
            enumeration = if.keys();
            "".length();
            while (!ac_0.new(enumeration.hasMoreElements() ? 1 : 0)) {
                string = (String)enumeration.nextElement();
                e2 = (e)if.get(string);
                if (!ac_0.for(e2.do, do[0]) || !ac_0.if(ac_0.do(System.currentTimeMillis() / 1000L - (long)e2.do, (long)bx.case))) continue;
                if.remove(string);
                "".length();
            }
        }
    }

    /*
     * Unable to fully structure code
     */
    public static cj do(int var0, Vector var1_1) {
        var2_2 = var1_1.size();
        var3_3 = ac_0.do[1];
        "".length();
        if (((84 + 116 - 113 + 50 ^ 102 + 38 - 113 + 172) & (107 + 107 - 56 + 46 ^ 86 + 69 - 151 + 126 ^ -" ".length())) <= " ".length()) ** GOTO lbl11
        return null;
lbl-1000:
        // 1 sources

        {
            var4_4 = (cj)var1_1.elementAt(var3_3);
            if (ac_0.int(ac_0.do((short)var4_4.do).do, var0)) {
                return var4_4;
            }
            ++var3_3;
lbl11:
            // 2 sources

            ** while (!ac_0.do((int)var3_3, (int)var2_2))
        }
lbl12:
        // 1 sources

        return null;
    }

    private static boolean new(int n, int n2) {
        return n > n2;
    }

    /*
     * Unable to fully structure code
     * Could not resolve type clashes
     */
    public static Vector do(byte[] var0, boolean var1_1) {
        var0 = new ByteArrayInputStream((byte[])var0);
        var0 = new DataInputStream((InputStream)var0);
        var2_3 = ac_0.do[2];
        if (ac_0.new((int)var1_1)) {
            var2_3 = var0.readShort();
        }
        var1_2 = new Vector<fd>();
        var3_4 = ac_0.do[1];
        "".length();
        if (" ".length() >= 0) ** GOTO lbl73
        return null;
lbl-1000:
        // 1 sources

        {
            block6: {
                block7: {
                    block5: {
                        var4_5 = var0.readShort();
                        var5_6 = var0.readInt();
                        var6_7 = var0.readShort();
                        var7_8 = var0.readShort();
                        if (!ac_0.int(var7_8, ac_0.do[3])) break block5;
                        var8_9 /* !! */  = new fd();
                        new fd().for = var4_5;
                        var8_9 /* !! */ .do[ac_0.do[1]] = var5_6;
                        var8_9 /* !! */ .do[ac_0.do[2]] = var6_7;
                        var8_9 /* !! */ .int = var7_8;
                        var8_9 /* !! */ .do = var0.readUTF();
                        var8_9 /* !! */ .if = var0.readByte();
                        var8_9 /* !! */ .if = var0.readShort();
                        var1_2.addElement(var8_9 /* !! */ );
                        "".length();
                        if (null != null) {
                            return null;
                        }
                        break block6;
                    }
                    if (!ac_0.int(var7_8, ac_0.do[0])) break block7;
                    var8_9 /* !! */  = new da();
                    new da().for = var4_5;
                    var8_9 /* !! */ .do[ac_0.do[1]] = var5_6;
                    var8_9 /* !! */ .do[ac_0.do[2]] = var6_7;
                    var8_9 /* !! */ .int = var7_8;
                    var8_9 /* !! */ .do = var0.readUTF();
                    var8_9 /* !! */ .if = var0.readByte();
                    var8_9 /* !! */ .do = var0.readByte();
                    var8_9 /* !! */ .int = var0.readByte();
                    var8_9 /* !! */ .for = var0.readByte();
                    var8_9 /* !! */ .if = var0.readShort();
                    var8_9 /* !! */ .do = new short[ac_0.do[4]];
                    var8_9 /* !! */ .if = new byte[ac_0.do[4]];
                    var8_9 /* !! */ .do = new byte[ac_0.do[4]];
                    var4_5 = ac_0.do[1];
                    "".length();
                    if ((171 ^ 133 ^ (99 ^ 73)) > " ".length()) ** GOTO lbl56
                    return null;
lbl-1000:
                    // 1 sources

                    {
                        var8_9 /* !! */ .do[var4_5] = var0.readShort();
                        var8_9 /* !! */ .if[var4_5] = var0.readByte();
                        var8_9 /* !! */ .do[var4_5] = var0.readByte();
                        ++var4_5;
lbl56:
                        // 2 sources

                        ** while (!ac_0.do((int)var4_5, (int)ac_0.do[4]))
                    }
lbl57:
                    // 1 sources

                    var1_2.addElement(var8_9 /* !! */ );
                    "".length();
                    if ("  ".length() <= " ".length()) {
                        return null;
                    }
                    break block6;
                }
                var8_9 /* !! */  = new q_0();
                new q_0().for = var4_5;
                var8_9 /* !! */ .do[ac_0.do[1]] = var5_6;
                var8_9 /* !! */ .do[ac_0.do[2]] = var6_7;
                var8_9 /* !! */ .int = var7_8;
                var8_9 /* !! */ .do = var0.readShort();
                var1_2.addElement(var8_9 /* !! */ );
            }
            ++var3_4;
lbl73:
            // 2 sources

            ** while (!ac_0.do((int)var3_4, (int)var2_3))
        }
lbl74:
        // 1 sources

        return var1_2;
    }

    public static void do(String string) {
        try {
            RecordStore.deleteRecordStore((String)("2.5.8" + string));
            return;
        }
        catch (Exception exception) {
            "".length();
            return;
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    private static void char() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeShort(try.size());
            int n = do[1];
            "".length();
            if (-" ".length() >= " ".length()) {
                return;
            }
            while (true) {
                if (ac_0.do(n, try.size())) {
                    hi.do("avatarImgBig", byteArrayOutputStream.toByteArray());
                    dataOutputStream.close();
                    hi.do("partImageNormal", do);
                    return;
                }
                ht ht2 = (ht)try.elementAt(n);
                dataOutputStream.writeShort(ht2.if);
                dataOutputStream.writeShort(ht2.for);
                dataOutputStream.writeInt(ht2.do.length);
                ((OutputStream)dataOutputStream).write(ht2.do);
                dataOutputStream.writeShort(ht2.do);
                ++n;
            }
        }
        catch (Exception exception) {
            "".length();
            return;
        }
    }
}

