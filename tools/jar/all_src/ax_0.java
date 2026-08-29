/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Graphics
 *  javax.microedition.lcdui.Image
 */
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 * Renamed from aX
 */
public final class ax_0
extends ep {
    public static ax_0 do;
    private static int do;
    private static final int[] do;
    public static Image do;

    public static void do(long l, boolean bl) {
        new cU(l, bl).do();
    }

    public final void try() {
        aO.do = do[0];
        do = do[0];
        if (ax_0.do(aO.do)) {
            do = ep.case;
        }
        super.try();
        cU.do = 0L;
        ax_0.do(500L, do[1]);
    }

    public static ax_0 do() {
        if (ax_0.do(do)) {
            do = new ax_0();
            return do;
        }
        return do;
    }

    static {
        ax_0.if();
        do = do[7];
    }

    public final void byte() {
        if (ax_0.if(do, do[2])) {
            if (ax_0.do(aO.do)) {
                if (ax_0.do(aO.do, do[3])) {
                    gs_0.do().try();
                    do = null;
                    aO.do = do[0];
                    bx.do.case();
                    "".length();
                    if ("  ".length() <= " ".length()) {
                        return;
                    }
                }
            } else if (ax_0.do(do, do[4])) {
                fo_0.do().case();
                gC.do().for();
                if (ax_0.if(fo_0.int ? 1 : 0)) {
                    fo_0.int = do[1];
                    ac_0.do("avatarSV");
                    ac_0.int();
                    ax_0.for(do[0]);
                    "".length();
                    if ("   ".length() <= "  ".length()) {
                        return;
                    }
                } else {
                    ac_0.int();
                    fo_0.do().goto();
                    if (ax_0.do(gx_0.do(), bx.do)) {
                        fo_0.do().try();
                    }
                    do = null;
                    "".length();
                    if ((0x73 ^ 0x77) < 0) {
                        return;
                    }
                }
            }
        } else if (ax_0.do(aO.do) && ax_0.if(do)) {
            gs_0.do().try();
            do = null;
            aO.do = do[0];
            bx.do.case();
        }
        do += do[1];
    }

    private static void for(int n) {
        bx.int();
        gC.do().do[ax_0.do[5]] = n;
        gC.do().for(do[0]);
        fo_0.do().goto();
        fo_0.do().try();
        do = null;
    }

    private static boolean do(int n, int n2) {
        return n == n2;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static boolean do(Object object) {
        return object == null;
    }

    public final void if(int n, int n2) {
        switch (n) {
            case 50: {
                ax_0.for(do[0]);
                return;
            }
            case 51: {
                ax_0.for(do[1]);
            }
        }
    }

    private static void if() {
        do = new int[8];
        ax_0.do[0] = (0xC ^ 0x12) & ~(0x4D ^ 0x53);
        ax_0.do[1] = " ".length();
        ax_0.do[2] = 0x47 ^ 0x55 ^ (0x57 ^ 0x76);
        ax_0.do[3] = "  ".length();
        ax_0.do[4] = 0x75 ^ 0x41;
        ax_0.do[5] = 0x3D ^ 0x39;
        ax_0.do[6] = "   ".length();
        ax_0.do[7] = 0x96 ^ 0xB6 ^ (0x41 ^ 0x75);
    }

    private static boolean do(Object object, Object object2) {
        return object != object2;
    }

    private static boolean if(Object object) {
        return object != null;
    }

    public final void do(Graphics graphics) {
        w.do(do[0], do[0], bx.char, bx.do.getHeight(), do[0], graphics);
        if (ax_0.if(do, do[1]) && ax_0.if(do)) {
            graphics.drawImage(do, bx.char >> do[1], bx.new >> do[1], do[6]);
        }
    }

    private static boolean if(int n, int n2) {
        return n > n2;
    }

    private static boolean if(int n) {
        return n == 0;
    }
}

