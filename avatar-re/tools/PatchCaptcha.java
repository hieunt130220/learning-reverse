import java.io.*;
import java.util.*;
import java.util.zip.*;
import org.objectweb.asm.*;

public class PatchCaptcha {
    public static void main(String[] args) throws Exception {
        String inputJar = args.length > 0 ? args[0] : "avatar-jar/avatar-auto.jar";
        String outputJar = args.length > 1 ? args[1] : "avatar-jar/avatar-auto-captcha.jar";
        String loggerClassPath = args.length > 2 ? args[2] : "avatar-re/tools/CaptchaLogger.class";

        System.out.println("[Patch] input=" + inputJar + " output=" + outputJar + " logger=" + loggerClassPath);

        // Read logger class bytes
        byte[] loggerBytes = readFile(loggerClassPath);
        System.out.println("[Patch] logger bytes=" + loggerBytes.length);

        // Open jars
        ZipFile zipIn = new ZipFile(inputJar);
        ZipOutputStream zos = new ZipOutputStream(new FileOutputStream(outputJar));

        // Copy all entries, patch fJ.class
        Enumeration<? extends ZipEntry> entries = zipIn.entries();
        int patched = 0;
        while (entries.hasMoreElements()) {
            ZipEntry e = entries.nextElement();
            String name = e.getName();
            InputStream is = zipIn.getInputStream(e);
            byte[] data = readAll(is);
            is.close();

            if (name.equals("fJ.class")) {
                System.out.println("[Patch] patching fJ.class size=" + data.length);
                byte[] patchedBytes = patchFJ(data);
                System.out.println("[Patch] patched size=" + patchedBytes.length);
                ZipEntry ne = new ZipEntry(name);
                ne.setTime(e.getTime());
                zos.putNextEntry(ne);
                zos.write(patchedBytes);
                zos.closeEntry();
                patched++;
            } else {
                ZipEntry ne = new ZipEntry(name);
                ne.setTime(e.getTime());
                // Preserve method if needed
                if (e.getMethod() == ZipEntry.STORED) {
                    ne.setMethod(ZipEntry.STORED);
                    ne.setSize(data.length);
                    ne.setCompressedSize(data.length);
                    java.util.zip.CRC32 crc = new java.util.zip.CRC32();
                    crc.update(data);
                    ne.setCrc(crc.getValue());
                }
                zos.putNextEntry(ne);
                zos.write(data);
                zos.closeEntry();
            }
        }

        // Add CaptchaLogger.class and inner classes
        File loggerDir = new File(loggerClassPath).getParentFile();
        File[] loggerFiles = loggerDir.listFiles((dir, name) -> name.startsWith("CaptchaLogger") && name.endsWith(".class"));
        if (loggerFiles != null) {
            for (File lf : loggerFiles) {
                byte[] lb = readFile(lf.getAbsolutePath());
                ZipEntry le = new ZipEntry(lf.getName());
                zos.putNextEntry(le);
                zos.write(lb);
                zos.closeEntry();
                System.out.println("[Patch] added " + lf.getName() + " bytes=" + lb.length);
            }
        } else {
            ZipEntry loggerEntry = new ZipEntry("CaptchaLogger.class");
            zos.putNextEntry(loggerEntry);
            zos.write(loggerBytes);
            zos.closeEntry();
            System.out.println("[Patch] added CaptchaLogger.class");
        }

        zos.close();
        zipIn.close();

        if (patched == 0) {
            System.err.println("[Patch] WARNING: fJ.class not found or not patched!");
            System.exit(1);
        }
        System.out.println("[Patch] done. Patched " + patched + " class(es). Output: " + outputJar);
    }

    private static byte[] patchFJ(byte[] classBytes) throws Exception {
        ClassReader cr = new ClassReader(classBytes);
        ClassWriter cw = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        ClassVisitor cv = new ClassVisitor(Opcodes.ASM9, cw) {
            @Override
            public MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
                MethodVisitor mv = super.visitMethod(access, name, descriptor, signature, exceptions);
                // Target: public final void for(bm)  or maybe synthetic? In fJ, method name is "for" with (Lbm;)V
                if (name.equals("for") && descriptor.equals("(Lbm;)V")) {
                    System.out.println("[Patch] found target method for(Lbm;)V");
                    return new MethodVisitor(Opcodes.ASM9, mv) {
                        boolean inserted = false;
                        @Override
                        public void visitMethodInsn(int opcode, String owner, String mname, String mdesc, boolean itf) {
                            // Look for Image.createImage([BII) call
                            if (!inserted && opcode == Opcodes.INVOKESTATIC && owner.equals("javax/microedition/lcdui/Image") && mname.equals("createImage") && mdesc.equals("([BII)Ljavax/microedition/lcdui/Image;")) {
                                System.out.println("[Patch] found Image.createImage call, inserting log before it");
                                // Stack before call: ..., byte[], int offset, int len
                                // We need to duplicate the byte[] and call log, but we need to preserve stack for createImage
                                // Stack: [array, offset, len] - createImage consumes all three
                                // To log, we need to dup the array without disturbing offset/len.
                                // Approach: DUP the array is tricky because offset and len are on top.
                                // So we need to save array to a temporary local variable, or use stack manipulation:
                                // Current stack: array, offset, len (len on top)
                                // We want to call log(array) before createImage, but keep stack for createImage.
                                // Solution: 
                                //   DUP_X2? Let's think.
                                // Stack bottom -> top: [array, offset, len]
                                // We need to keep [array, offset, len] for createImage, but also need [array] for log.
                                // We can do:
                                //   DUP2_X1? Not.
                                // Simplest: store array into a new local variable, reload it.
                                // But we don't know max locals. Easiest: use DUP with swapping.
                                // Alternative: 
                                //   - Store len in temp (pop len, store)
                                //   - Store offset in temp
                                //   - Dup array, call log, then reload offset and len
                                // But we can use ASM's local variable allocation: we need to allocate a new local.
                                // Simpler: Use the existing local variable 4 which already holds the array.
                                // At this point, local 4 holds the same array (astore 4 at 7067). So we can just
                                // load local 4 and call log, without touching stack.
                                // The stack for createImage is still [array, offset, len] where array is from stack (not local).
                                // But we can also just do: ALOAD 4; INVOKESTATIC CaptchaLogger.log
                                // This does not disturb the stack for createImage because we push an extra array, call log (consumes it), then stack returns to [array, offset, len].
                                // So we can just insert: ALOAD 4, INVOKESTATIC log
                                super.visitVarInsn(Opcodes.ALOAD, 4);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "CaptchaLogger", "log", "([B)V", false);
                                inserted = true;
                            }
                            super.visitMethodInsn(opcode, owner, mname, mdesc, itf);
                        }
                    };
                }
                return mv;
            }
        };
        cr.accept(cv, 0);
        return cw.toByteArray();
    }

    private static byte[] readFile(String path) throws IOException {
        File f = new File(path);
        if (!f.exists()) {
            // Try alternative path relative to project root
            f = new File("/Users/hieunt/learning-reverse/" + path);
        }
        FileInputStream fis = new FileInputStream(f);
        byte[] data = readAll(fis);
        fis.close();
        return data;
    }

    private static byte[] readAll(InputStream is) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
        return baos.toByteArray();
    }
}
