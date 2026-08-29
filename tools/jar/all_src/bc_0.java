/*
 * Decompiled with CFR 0.152.
 */
import java.awt.Desktop;
import java.net.URI;
import main.AngelChip;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Renamed from bc
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class bc_0 {
    private final String do;
    private static final int[] do;

    public bc_0(String string) {
        this.do = string;
    }

    private static boolean do(int n) {
        return n != 0;
    }

    private static void if() {
        do = new int[1];
        bc_0.do[0] = (0x56 ^ 0x68) & ~(0x96 ^ 0xA8);
    }

    public final void do() {
        try {
            Class.forName("java.awt.Desktop");
            "".length();
            Class.forName("java.net.URI");
            "".length();
            "".length();
        }
        catch (ClassNotFoundException classNotFoundException) {
            "".length();
            AngelChip.do(this.do);
            return;
        }
        if (((0x70 ^ 0x74) & ~(0xA9 ^ 0xAD)) != 0) {
            return;
        }
        if (bc_0.do(Desktop.isDesktopSupported() ? 1 : 0)) {
            try {
                Desktop.getDesktop().browse(new URI(this.do));
                System.exit(do[0]);
                return;
            }
            catch (Exception exception) {
                "".length();
            }
        }
        AngelChip.do(this.do);
    }

    static {
        bc_0.if();
    }
}

