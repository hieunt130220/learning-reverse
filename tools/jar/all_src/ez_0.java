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
 * Renamed from eZ
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class ez_0
extends hc {
    private int if;
    private int for;
    public long do = 0L;
    private static ez_0 do;
    private int int;
    private static final int[] do;
    private int new;
    public long if;
    private long for = do[0];
    private long byte = aq_0.do(do[1], do[2]) * do[3] + do[4];
    public static boolean do;
    public static byte do;
    public static int do;
    private int try;

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    public static void new() {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        DataOutputStream dataOutputStream = new DataOutputStream(byteArrayOutputStream);
        try {
            dataOutputStream.writeByte(do);
            dataOutputStream.writeInt(do);
            dataOutputStream.writeBoolean(do);
            dataOutputStream.flush();
            byteArrayOutputStream.flush();
            cs.do("FreeTimeSettings", byteArrayOutputStream.toByteArray());
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
            }
            catch (IOException iOException) {
                "".length();
                throw throwable;
            }
            if (((0x2F ^ 0x26) & ~(0x25 ^ 0x2C)) != " ".length()) throw throwable;
            return;
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

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public static ez_0 do() {
        if (ez_0.if(do)) {
            do = new ez_0();
        }
        return do;
    }

    private static boolean if(int n) {
        return n < 0;
    }

    public final void if() {
        if (ez_0.new(ez_0.do(System.currentTimeMillis() - this.try, 180000L))) {
            aq_0.else();
            aq_0.do(16000L);
            return;
        }
        if (ez_0.do(bx.do instanceof fo_0)) {
            return;
        }
        if (ez_0.for(ez_0.do(System.currentTimeMillis(), this.do))) {
            this.do = System.currentTimeMillis() + this.if;
            if (ez_0.if(fj.new, do[6])) {
                gs_0.do().return();
                aq_0.if(2000L);
            }
            if (ez_0.int(do ? 1 : 0) && ez_0.int(bt_0.do)) {
                bx_0.do(new hp());
                return;
            }
            bx_0.do(new bt_0());
            return;
        }
        if (ez_0.int(do)) {
            if (ez_0.int(bx.do instanceof gQ)) {
                aq_0.if(1500L);
                bx_0.do.if();
                gs_0.do().return();
                aq_0.if(1000L);
                gs_0.do();
                "".length();
                gs_0.native();
                aq_0.if(1000L);
                bx.do.keyPressed(do[7]);
                aq_0.if(250L);
                bx.do.keyReleased(do[7]);
                aq_0.do(2000L);
                "".length();
                "".length();
                if (-" ".length() == "  ".length()) {
                    return;
                }
            } else {
                aq_0.if(1500L);
                bx_0.do.int();
            }
            if (ez_0.int(bx.do instanceof fo_0)) {
                gs_0.import();
            }
            aq_0.do(this.do - System.currentTimeMillis());
            return;
        }
        if (ez_0.if(fj.new, this.int) && (!ez_0.do(gs_0.int, this.new) || ez_0.if(this.int, do[6]))) {
            long l = System.currentTimeMillis();
            if (ez_0.new(ez_0.do(l - this.for, this.byte))) {
                this.for = l;
                this.try = (int)l;
                this.byte = aq_0.do(do[1], do[2]) * do[3] + do[4];
                AngelChip.do.do(this.if, this.try);
                fp.do().do(this.if, this.try, do[8], do[0]);
                aq_0.if(1000L);
                gs_0.for(do[9]);
            }
            return;
        }
        if (ez_0.do(fj.new, this.int)) {
            long l;
            if ((!ez_0.int(bx.do instanceof gQ) || ez_0.if(fj.new, do[10])) && ez_0.if(ez_0.do(l = System.currentTimeMillis() - ((hc)this).new, 2000L))) {
                aq_0.if(2000L - l);
            }
            if (ez_0.do(aq_0.byte(this.int) ? 1 : 0)) {
                if (ez_0.if(gs_0.int, this.new)) {
                    aq_0.if(1000L);
                    AngelChip.do.do(this.if, this.try);
                    fp.do().do(this.if, this.try, do[8], do[0]);
                    aq_0.if(1000L);
                    gs_0.for(do[9]);
                    this.for = System.currentTimeMillis();
                    return;
                }
                aq_0.if(3500L);
            }
            return;
        }
        if (ez_0.do(this.int, do[6]) && ez_0.do(gs_0.int, this.new)) {
            fj.int = this.if;
            fj.byte = this.try;
            this.for = System.currentTimeMillis();
            fp.do().do(this.int, this.new);
            aq_0.else(5000L);
            "".length();
            return;
        }
        hc.float();
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    public final void try() {
        if (ez_0.do(do) && ez_0.int(aq_0.int(fj.new) ? 1 : 0)) {
            bx.if("Kh\u00f4ng th\u1ec3 treo nick \u1edf map n\u00e0y!");
            return;
        }
        super.short();
        this.int = fj.new;
        this.new = gs_0.int;
        this.if = (int)AngelChip.do.int;
        this.try = AngelChip.do.for ? 1 : 0;
        this.for = System.currentTimeMillis();
        this.if = do * do[5];
        if (ez_0.do(this.for, AngelChip.do.char)) {
            this.for = AngelChip.do.char;
            this.do = 0L;
        }
        bx_0.do(this);
    }

    private static void byte() {
        do = new int[12];
        ez_0.do[0] = (185 + 89 - 252 + 167 ^ 3 + 81 - -89 + 11) & (0x20 ^ 0x73 ^ (0x6D ^ 0x3B) ^ -" ".length());
        ez_0.do[1] = " ".length();
        ez_0.do[2] = 0x63 ^ 0x4E;
        ez_0.do[3] = -(0xFFFFFC57 & 0x3FBA) & (0xFFFFBFFD & 0x7FFB);
        ez_0.do[4] = 0xFFFFBA99 & 0x7FFE;
        ez_0.do[5] = 0xFFFFFAE0 & 0xEF7F;
        ez_0.do[6] = 0x31 ^ 0x28;
        ez_0.do[7] = -(0x8D ^ 0x88);
        ez_0.do[8] = "  ".length();
        ez_0.do[9] = 0xFA ^ 0x92 ^ (0x79 ^ 0x1B);
        ez_0.do[10] = -" ".length();
        ez_0.do[11] = 0x91 ^ 0x99 ^ (0x15 ^ 0x21);
    }

    private static boolean for(int n) {
        return n >= 0;
    }

    private static boolean int(int n) {
        return n == 0;
    }

    private static boolean new(int n) {
        return n > 0;
    }

    private static boolean do(int n, int n2) {
        return n != n2;
    }

    private static boolean if(int n, int n2) {
        return n == n2;
    }

    public final String toString() {
        return "Treo nick";
    }

    /*
     * Loose catch block
     */
    static {
        block11: {
            ez_0.byte();
            do = do[11];
            do = do[1];
            do = (byte)do[0];
            Object object = cs.do("FreeTimeSettings");
            if (!ez_0.do(object)) break block11;
            object = new ByteArrayInputStream((byte[])object);
            DataInputStream dataInputStream = new DataInputStream((InputStream)object);
            do = dataInputStream.readByte();
            do = dataInputStream.readInt();
            do = dataInputStream.readBoolean();
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
                cs.do("FreeTimeSettings");
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
                    if ("  ".length() >= "   ".length()) {
                        break block11;
                    }
                    throw throwable;
                }
            }
        }
    }

    private static boolean if(Object object) {
        return object == null;
    }
}

