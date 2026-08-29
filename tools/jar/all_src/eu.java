/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 */
import javax.microedition.lcdui.Graphics;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class eu
extends ff_0 {
    public int do;
    public byte do;
    public byte for;
    public boolean do;
    public int new;
    public int try;
    public short do;
    public boolean if;
    public short if;
    public boolean for;
    public byte int;
    public boolean int;
    public long do = do[1];
    public int byte;
    public byte new;
    private static final int[] do;
    public int case;

    private static boolean do(int n) {
        return n >= 0;
    }

    private static boolean do(int n, int n2) {
        return n > n2;
    }

    public final void do(Graphics graphics) {
        if (eu.int(((ff_0)this).int * bp.if, fq.do().if - do[2]) && eu.for(this.do * bp.if, fq.do().if + bx.char + do[2])) {
            if (eu.for(this.do ? 1 : 0)) {
                graphics.drawImage(dT.if, (((ff_0)this).int - do[3]) * bp.if, (((ff_0)this).for - do[4]) * bp.if, do[1]);
            }
            int n = dT.if.if;
            int n2 = dT.if.for;
            if (eu.new(this.do, n) && eu.new(this.case, n2)) {
                bx.if.do(graphics, "lv" + this.new, ((ff_0)this).int * bp.if, (((ff_0)this).for - do[5]) * bp.if, do[6]);
            }
            if (eu.if(this.byte, do[0])) {
                fd_0 fd_02 = bC.do(this.byte);
                fd_02.do(graphics, this.try, ((ff_0)this).int * bp.if, ((ff_0)this).for * bp.if, do[7]);
                int n3 = fd_02.try * do[8] + fd_02.for * do[8];
                if ((!eu.do(this.if, n3) || eu.new(fd_02.for, do[0])) && eu.if(this.int, do[9]) && eu.do(this.if)) {
                    if (eu.for(this.int ? 1 : 0)) {
                        graphics.drawImage(dT.do[do[10]], (((ff_0)this).int + do[11]) * bp.if, (((ff_0)this).for - do[12]) * bp.if, do[13]);
                    }
                    if (eu.for(this.if ? 1 : 0)) {
                        graphics.drawImage(dT.do[do[1]], (((ff_0)this).int - do[14]) * bp.if, ((ff_0)this).for * bp.if, do[13]);
                    }
                    if (eu.new(this.do, n) && !eu.if(this.case, n2) || eu.if(this.do, do[0]) && eu.new(this.do, dT.goto)) {
                        n = n * do[15] * bp.if;
                        n2 = n2 * do[15] * bp.if;
                        if (eu.if(this.do, do[0]) && eu.new(this.do, dT.goto)) {
                            n = this.do * do[15] * bp.if;
                            n2 = this.case * do[15] * bp.if;
                        }
                        fd_02.do(graphics, do[14], n - do[13], n2 - do[16] * bp.if, do[7]);
                        graphics.setColor(do[10]);
                        graphics.fillRect(n - do[17] * bp.if, n2 - do[18] * bp.if, do[19] * bp.if, do[11] * bp.if);
                        graphics.setColor(do[20]);
                        graphics.fillRect(n - do[13] * bp.if, n2 - do[21] * bp.if, this.do * do[22] / do[9] * bp.if, do[13] * bp.if);
                        graphics.setColor(do[23]);
                        graphics.drawRect(n - do[17] * bp.if, n2 - do[18] * bp.if, do[19] * bp.if, do[17] * bp.if);
                        long l = (long)(fd_02.try * do[8] * do[8]) - this.do;
                        long l2 = fd_02.try * do[8] - this.if;
                        String string = "";
                        if (eu.try(eu.do(l, 0L))) {
                            l = 0L;
                        }
                        long l3 = l / 60L / 60L;
                        long l4 = l / 60L % 60L;
                        long l5 = l % 60L;
                        string = string + l3 + ":" + l4 + ":" + l5;
                        if (!eu.if(eu.do(l2, 0L)) || eu.new(eu.do(l, 0L))) {
                            string = bT.cc;
                        }
                        bx.if.do(graphics, string, n + do[11] * bp.if, n2 - do[24] * bp.if, do[1]);
                        int n4 = this.if * do[9] / (fd_02.try * do[8]) * do[22] / do[9];
                        if (eu.int(n4)) {
                            n4 = do[10];
                        }
                        if (eu.int(n4, do[22])) {
                            n4 = do[25];
                        }
                        if (eu.try(fd_02.try * do[8] - this.if)) {
                            n4 = do[22];
                        }
                        graphics.setColor(do[10]);
                        graphics.fillRect(n - do[17] * bp.if, n2 - do[26] * bp.if, do[19] * bp.if, do[11] * bp.if);
                        graphics.setColor(do[27], do[27], do[1]);
                        graphics.fillRect(n - do[13] * bp.if, n2 - do[19] * bp.if, n4 * bp.if, do[13] * bp.if);
                        graphics.setColor(do[23]);
                        graphics.drawRect(n - do[17] * bp.if, n2 - do[26] * bp.if, do[19] * bp.if, do[17] * bp.if);
                        int n5 = do[1];
                        if (eu.for(this.int ? 1 : 0)) {
                            int n6;
                            n5 = do[10];
                            int n7 = do[10];
                            int n8 = do[11];
                            if (eu.for(this.if ? 1 : 0)) {
                                n6 = do[28];
                                "".length();
                                if ("  ".length() < 0) {
                                    return;
                                }
                            } else {
                                n6 = do[1];
                            }
                            dT.for.if(n7, n + (n8 + n6) * bp.if, n2 - do[29] * bp.if, do[1], graphics);
                        }
                        if (eu.for(this.if ? 1 : 0)) {
                            dT.for.if(do[1], n + (do[17] - n5 * do[28]) * bp.if, n2 - do[29] * bp.if, do[1], graphics);
                        }
                    }
                }
            }
        }
        bx.try.do(graphics, String.valueOf(this.new), ((ff_0)this).int * bp.if, (((ff_0)this).for - do[30]) * bp.if, do[6]);
    }

    private static boolean if(int n, int n2) {
        return n != n2;
    }

    private static boolean if(int n) {
        return n > 0;
    }

    private static boolean for(int n, int n2) {
        return n <= n2;
    }

    private static boolean for(int n) {
        return n != 0;
    }

    private static int do(long l, long l2) {
        return l == l2 ? 0 : (l < l2 ? -1 : 1);
    }

    private static boolean int(int n, int n2) {
        return n >= n2;
    }

    private static boolean int(int n) {
        return n == 0;
    }

    private static void if() {
        do = new int[31];
        eu.do[0] = -" ".length();
        eu.do[1] = (0x9B ^ 0xBF) & ~(7 ^ 0x23);
        eu.do[2] = 0x10 ^ 0x31 ^ (0x81 ^ 0xAA);
        eu.do[3] = 0x87 ^ 0xAC ^ (0x2D ^ 0xB);
        eu.do[4] = 0xFC ^ 0xC4 ^ (0x37 ^ 0x1D);
        eu.do[5] = 0xED ^ 0xC1;
        eu.do[6] = "  ".length();
        eu.do[7] = 90 + 103 - 141 + 107 ^ 165 + 74 - 147 + 98;
        eu.do[8] = 0xD1 ^ 0xA4 ^ (0x29 ^ 0x60);
        eu.do[9] = 0x30 ^ 0x54;
        eu.do[10] = " ".length();
        eu.do[11] = 0x20 ^ 0x25;
        eu.do[12] = 0xED ^ 0xB6 ^ (0xCD ^ 0x9A);
        eu.do[13] = "   ".length();
        eu.do[14] = 0x4B ^ 0x4C;
        eu.do[15] = 78 + 14 - 72 + 137 ^ 90 + 80 - 78 + 41;
        eu.do[16] = 0xAD ^ 0x85;
        eu.do[17] = 0x79 ^ 0x7D;
        eu.do[18] = 0x7E ^ 0x58;
        eu.do[19] = 0x74 ^ 0x6B;
        eu.do[20] = 0xFFFFFF36 & 0xFFC9;
        eu.do[21] = 0x2D ^ 8;
        eu.do[22] = 9 ^ 0x17;
        eu.do[23] = -(0xFFFFFF5B & 0x27E6) & (0xFFFFFFFB & 0x267F6F);
        eu.do[24] = 0xAE ^ 0xC1 ^ (0x6A ^ 0x34);
        eu.do[25] = 7 ^ 0x1A;
        eu.do[26] = 0xD2 ^ 0x91 ^ (0xA6 ^ 0xC5);
        eu.do[27] = 39 + 113 - -4 + 99;
        eu.do[28] = 0x36 ^ 0x30;
        eu.do[29] = 0x43 ^ 0x55;
        eu.do[30] = 89 + 22 - 47 + 83 ^ 118 + 38 - 139 + 139;
    }

    static {
        eu.if();
    }

    private static boolean new(int n) {
        return n <= 0;
    }

    private static boolean new(int n, int n2) {
        return n == n2;
    }

    private static boolean try(int n) {
        return n < 0;
    }
}

