/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.media.Manager
 *  javax.microedition.media.MediaException
 *  javax.microedition.media.Player
 *  javax.microedition.media.control.VolumeControl
 */
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Vector;
import javax.microedition.media.Manager;
import javax.microedition.media.MediaException;
import javax.microedition.media.Player;
import javax.microedition.media.control.VolumeControl;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from dr
 */
public final class dr_0 {
    int do;
    private Vector do;
    private static int[] do;
    public static dr_0 do;
    private Player do = do[0];
    private int if;
    private Vector if;

    /*
     * Unable to fully structure code
     */
    public final int do(String var1_1) {
        if (dr_0.do(this.do)) {
            this.do = new Vector<E>();
        }
        var2_2 = dr_0.do[4];
        "".length();
        if (-"  ".length() < 0) ** GOTO lbl11
        return (7 ^ 110 ^ (6 ^ 49)) & (63 + 225 - 277 + 227 ^ 33 + 150 - 12 + 5 ^ -" ".length());
lbl-1000:
        // 1 sources

        {
            if (dr_0.for((int)((String)this.do.elementAt(var2_2)).equals(var1_1))) {
                return var2_2;
            }
            ++var2_2;
lbl11:
            // 2 sources

            ** while (!dr_0.do((int)var2_2, (int)this.do.size()))
        }
lbl12:
        // 1 sources

        return dr_0.do[0];
    }

    private static void if() {
        do = new int[7];
        dr_0.do[0] = -" ".length();
        dr_0.do[1] = " ".length();
        dr_0.do[2] = 0x25 ^ 0x2F;
        dr_0.do[3] = "  ".length();
        dr_0.do[4] = (0xC ^ 0x5E) & ~(0xF8 ^ 0xAA);
        dr_0.do[5] = 0xFFFFB19C & 0x4FF3;
        dr_0.do[6] = 0xA4 ^ 0xB0;
    }

    private static boolean do(int n) {
        return n == 0;
    }

    public final void do(String string, byte by2) {
        if (dr_0.do(this.do)) {
            return;
        }
        es es2 = new es(this, by2);
        if (dr_0.if(this.do, do[1])) {
            es2.do();
            return;
        }
        Vector<fn_0> vector = new Vector<fn_0>();
        if (dr_0.for(gs_0.byte ? 1 : 0)) {
            gC.do().for(gC.do().do / do[2]);
            es2.do();
            return;
        }
        vector.addElement(new fn_0(bT.break[do[1]], new eo(es2)));
        vector.addElement(new fn_0(bT.break[do[3]], new ft(es2)));
        vector.addElement(new fn_0(bT.cW, new dq_0(this)));
        vector.addElement(new fn_0(bT.break[do[4]], new ea(es2)));
        bx.do(string, vector);
    }

    public final void do() {
        if (dr_0.if(this.do)) {
            if (dr_0.if(this.do.getState(), do[5])) {
                try {
                    this.do.stop();
                    "".length();
                }
                catch (MediaException mediaException) {
                    mediaException.printStackTrace();
                }
                if (" ".length() > "  ".length()) {
                    return;
                }
            }
            this.do.close();
        }
    }

    public final void do(byte[] byArray, byte by2) {
        if (dr_0.do(this.if)) {
            this.if = new Vector();
            this.do = new Vector();
        }
        try {
            this.do.addElement("" + by2);
            this.if.addElement(byArray);
            do.do(byArray);
            return;
        }
        catch (Exception exception) {
            exception.printStackTrace();
            return;
        }
    }

    static {
        dr_0.if();
        do = new dr_0();
    }

    public final void do(byte[] object) {
        this.do();
        try {
            object = new ByteArrayInputStream((byte[])object);
            this.do = Manager.createPlayer((InputStream)object, (String)"audio/midi");
            this.do.setLoopCount(do[1]);
            ((ByteArrayInputStream)object).close();
            if (dr_0.if(this.if)) {
                this.do.start();
                ((VolumeControl)this.do.getControl("VolumeControl")).setLevel(this.if * do[6]);
                "".length();
                return;
            }
        }
        catch (Exception exception) {
            exception.printStackTrace();
        }
    }

    private static boolean if(int n) {
        return n > 0;
    }

    public final void do(int n) {
        block6: {
            if (dr_0.if(this.do) && dr_0.for(this.do.getState())) {
                try {
                    if (dr_0.if(n)) {
                        this.do.start();
                        ((VolumeControl)this.do.getControl("VolumeControl")).setLevel(n * do[6]);
                        "".length();
                        "".length();
                        if (((0x39 ^ 0x63) & ~(0xFE ^ 0xA4)) != 0) {
                            return;
                        }
                        break block6;
                    }
                    this.do.stop();
                    "".length();
                }
                catch (MediaException mediaException) {
                    mediaException.printStackTrace();
                }
                if ((0x7B ^ 0x41 ^ (0x84 ^ 0xBA)) <= "  ".length()) {
                    return;
                }
            }
        }
        this.if = n;
    }

    private static boolean for(int n) {
        return n != 0;
    }

    private static boolean do(Object object) {
        return object == null;
    }

    static Vector do(dr_0 dr_02) {
        return dr_02.if;
    }

    private static boolean do(int n, int n2) {
        return n >= n2;
    }

    private static boolean if(Object object) {
        return object != null;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }
}

