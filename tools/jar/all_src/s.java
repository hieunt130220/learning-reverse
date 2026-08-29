/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  javax.microedition.io.Connector
 *  javax.wireless.messaging.Message
 *  javax.wireless.messaging.MessageConnection
 *  javax.wireless.messaging.TextMessage
 */
import javax.microedition.io.Connector;
import javax.wireless.messaging.Message;
import javax.wireless.messaging.MessageConnection;
import javax.wireless.messaging.TextMessage;

/*
 * Illegal identifiers - consider using --renameillegalidents true
 */
public final class s
implements Runnable {
    private final String do;
    private final String if;

    public s(String string, String string2) {
        this.if = string;
        this.do = string2;
    }

    public final void run() {
        try {
            MessageConnection messageConnection = (MessageConnection)Connector.open((String)this.if);
            TextMessage textMessage = (TextMessage)messageConnection.newMessage("text");
            textMessage.setAddress(this.if);
            textMessage.setPayloadText(this.do);
            messageConnection.send((Message)textMessage);
            bx.int(bT.K);
            return;
        }
        catch (Exception exception) {
            "".length();
            bx.int(bT.do);
            return;
        }
    }
}

