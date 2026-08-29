/*
 * Decompiled with CFR 0.152.
 */
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 * Duplicate member names - consider using --renamedupmembers true
 */
public final class bm {
    DataInputStream do;
    DataOutputStream do;
    ByteArrayOutputStream do;
    public byte do;
    private ByteArrayInputStream do = null;

    public bm(byte by2, byte[] byArray) {
        this.do = by2;
        this.do = new ByteArrayInputStream(byArray);
        this.do = new DataInputStream(this.do);
    }

    public bm() {
    }

    public final DataInputStream do() {
        return this.do;
    }

    public bm(byte by2) {
        this.do = by2;
        this.do = new ByteArrayOutputStream();
        this.do = new DataOutputStream(this.do);
    }
}

