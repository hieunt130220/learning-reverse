/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import java.util.Vector;
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public class dF
extends bp {
    public byte for;
    public int new;
    public byte int;
    public short int;
    public int try;
    private static int[] do;
    public Vector do;
    public int byte;
    public byte new;
    public String do;
    public boolean do;
    public int case;
    public int char;
    public cX do = "";
    public byte try = (byte)do[1];
    public byte byte;
    public static byte case;
    public boolean if;
    public int else;
    public int goto = do[2];

    public void do(Graphics graphics, int n, int n2, boolean bl) {
    }

    private static boolean for(int n, int n2) {
        return n != n2;
    }

    public final boolean do(int n, int n2) {
        if (dF.int(this.byte) && dF.for(this.byte, do[7])) {
            return do[2];
        }
        if (dF.int(fj.do(((bp)this).int + n, ((bp)this).for + n2), do[9])) {
            return do[2];
        }
        int n3 = ((bp)this).int;
        if (dF.if(((bp)this).if)) {
            int n4;
            if (dF.for(n)) {
                n4 = do[10];
                "".length();
                if (((0x3C ^ 0xC) & ~(0x25 ^ 0x15)) < -" ".length()) {
                    return ((4 ^ 0x67) & ~(0x2E ^ 0x4D)) != 0;
                }
            } else {
                n4 = do[1];
            }
            n3 += n4;
        }
        if (dF.int(n)) {
            int n5 = fj.do(n3 + n, ((bp)this).for - do[11]);
            int n6 = fj.do(n3, ((bp)this).for - do[11]);
            if (dF.int(n5, do[12]) && dF.int(n6, do[12])) {
                this.new = -this.case;
                this.else = n3;
                gs_0.do();
                "".length();
                gs_0.const();
                return do[7];
            }
            n = fj.do(n3 + n, ((bp)this).for + do[11]);
            n2 = fj.do(n3, ((bp)this).for + do[11]);
            if (dF.int(n, do[12]) && dF.int(n2, do[12])) {
                this.new = this.case;
                this.else = n3;
                gs_0.do();
                "".length();
                gs_0.const();
                return do[7];
            }
        } else if (dF.int(n2)) {
            int n7 = fj.do(n3 - do[11], ((bp)this).for + n2);
            int n8 = fj.do(n3 - do[11], ((bp)this).for);
            if (dF.int(n7, do[12]) && dF.int(n8, do[12])) {
                this.goto = -this.case;
                this.byte = ((bp)this).for;
                gs_0.do();
                "".length();
                gs_0.const();
                return do[7];
            }
            n = fj.do(n3 + do[11], ((bp)this).for + n2);
            n2 = fj.do(n3 + do[11], ((bp)this).for);
            if (dF.int(n, do[12]) && dF.int(n2, do[12])) {
                this.goto = this.case;
                this.byte = ((bp)this).for;
                gs_0.do();
                "".length();
                gs_0.const();
                return do[7];
            }
        }
        return do[2];
    }

    private static boolean do(int n) {
        return n > 0;
    }

    private static boolean if(int n) {
        return n == 0;
    }

    public final void do(int n, String string, byte by2) {
        this.do.addElement(new cX(n, string, by2));
        this.if();
    }

    private static boolean for(int n) {
        return n < 0;
    }

    private static boolean do(Object object) {
        return object == null;
    }

    public boolean if(int n, int n2) {
        if (!dF.for(this.byte, do[5]) || dF.int(this.byte, do[6])) {
            this.goto = do[2];
            this.new = do[2];
            return do[7];
        }
        if (dF.for(this.byte, do[8]) && dF.for(this.byte, do[0]) && dF.for(this.byte, do[3])) {
            this.byte = (byte)do[2];
        }
        if (dF.int(this.byte) && dF.for(this.byte, do[7])) {
            this.goto = do[2];
            this.new = do[2];
            return do[7];
        }
        this.byte = (byte)do[7];
        int n3 = ((bp)this).int;
        int n4 = ((bp)this).for;
        if (dF.int(((bp)this).if, do[0])) {
            n3 = this.else;
            n4 = this.byte;
        }
        if (dF.int(fj.if(n3 + n, n4 + n2) ? 1 : 0)) {
            if (dF.int(n)) {
                if (dF.do(n)) {
                    this.goto = this.case;
                    "".length();
                    if (null != null) {
                        return ((11 + 134 - -24 + 46 ^ 118 + 66 - 105 + 70) & (132 + 146 - 40 + 8 ^ 42 + 117 - 49 + 70 ^ -" ".length())) != 0;
                    }
                } else {
                    this.goto = -this.case;
                }
            }
            if (dF.int(n2)) {
                if (dF.do(n2)) {
                    this.new = this.case;
                    "".length();
                    if ("  ".length() == ((0x66 ^ 0x6D) & ~(4 ^ 0xF))) {
                        return ((0x27 ^ 0x64) & ~(0xC2 ^ 0x81)) != 0;
                    }
                } else {
                    this.new = -this.case;
                }
            }
            return do[2];
        }
        this.goto = do[2];
        this.new = do[2];
        return do[7];
    }

    public final void do(int n, int n2) {
        ((bp)this).int = this.else = n;
        ((bp)this).for = this.byte = n2;
    }

    public dF() {
        this.new = do[2];
        this.case = do[3];
        this.byte = (byte)do[2];
        this.int = case;
        this.do = do[2];
        this.if = do[2];
        this.int = (short)do[2];
        this.do = new Vector();
    }

    private static boolean if(Object object) {
        return object != null;
    }

    public void do(Graphics graphics) {
        if (dF.if(this.do) && dF.do(bx.do, fh_0.do())) {
            this.do.do(graphics);
        }
    }

    private static boolean int(int n, int n2) {
        return n == n2;
    }

    private void if() {
        if (dF.do(this.do) && dF.do(this.do.size())) {
            this.do = (cX)this.do.elementAt(do[2]);
            this.do.removeElementAt(do[2]);
        }
    }

    private static boolean int(int n) {
        return n != 0;
    }

    public void do() {
        if (dF.if(this.do)) {
            this.do.do(((bp)this).int, ((bp)this).for - ((bp)this).new - do[4]);
            if (dF.int(this.do.do() ? 1 : 0)) {
                this.do = null;
                this.if();
            }
        }
    }

    private static boolean do(Object object, Object object2) {
        return object != object2;
    }

    static {
        dF.for();
        case = (byte)do[0];
    }

    private static void for() {
        do = new int[13];
        dF.do[0] = "  ".length();
        dF.do[1] = 0x5B ^ 0x18 ^ (0x83 ^ 0xC7);
        dF.do[2] = (0x60 ^ 0x71) & ~(0x4C ^ 0x5D);
        dF.do[3] = 0x4B ^ 0x4F;
        dF.do[4] = 5 ^ 9;
        dF.do[5] = -" ".length();
        dF.do[6] = 0x22 ^ 0x6F ^ (0xEE ^ 0xAD);
        dF.do[7] = " ".length();
        dF.do[8] = 47 + 21 - 13 + 115 ^ 55 + 19 - -71 + 15;
        dF.do[9] = 0xE ^ 0x1C ^ (0x26 ^ 0x6E);
        dF.do[10] = -(0x80 ^ 0x87);
        dF.do[11] = 93 + 105 - 47 + 17 ^ 100 + 154 - 81 + 3;
        dF.do[12] = 0x21 ^ 0x3D ^ (0xEA ^ 0xA6);
    }
}

