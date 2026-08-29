/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.lcdui.Image
 */
import java.io.IOException;
import java.util.Hashtable;
import javax.microedition.lcdui.Image;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class L {
    private static final int[] do;
    private static final Hashtable do;

    private static boolean do(int n) {
        return n != 0;
    }

    private static void do() {
        do = new int[1];
        L.do[0] = " ".length();
    }

    static {
        L.do();
        do = new Hashtable();
    }

    private static boolean do(Object object) {
        return object != null;
    }

    public static Image do(String string) {
        Image image = null;
        if (L.do(do.containsKey(string) ? 1 : 0)) {
            image = (Image)do.get(string);
        }
        if (L.do(image)) {
            return image;
        }
        try {
            image = Image.createImage((String)(bT.if() + "/farm/" + string));
            "".length();
        }
        catch (IOException iOException) {
            "".length();
            image = Image.createImage((int)do[0], (int)do[0]);
        }
        if ("   ".length() == 0) {
            return null;
        }
        do.put(string, image);
        "".length();
        return image;
    }
}

