# Reverse APK — AvatarHD (`com.TeaM.Avatar`)

Môi trường reverse cho **Unity IL2CPP game** (không phải app Java thường).
APK gốc: `/Users/devios/learning-reverse/AvatarHD_3.4.4_APKPure.apk` (101 MB).

## Đặc điểm target (quan trọng)
- Engine: **Unity + IL2CPP** → toàn bộ logic C# đã biên dịch sang native.
- `lib/arm64-v8a/libil2cpp.so` (28 MB) = logic game. `global-metadata.dat` (4.9 MB) = metadata.
- Chỉ 1 `classes.dex` (Java rất mỏng, chỉ là loader). Có Firebase (Auth/Messaging/Analytics).
- Đã khôi phục **5947 class C#**. Assembly game = `Assembly-CSharp.dll`
  (ví dụ class: `AincradService`, `AincradMsgHandler`, `AntiCheat`, `AddItemShop`, `AesCryptoServiceProvider`).
- Manifest: package `com.TeaM.Avatar`, `debuggable=false`, không cleartext, quyền BILLING + location + notification.

## Công cụ đã cài
| Công cụ | Phiên bản | Dùng cho |
|---|---|---|
| jadx | 1.5.6 | Đọc Java layer (loader, Firebase) |
| apktool | 3.0.3 | Giải mã manifest/smali, repack |
| adb | 1.0.41 | Kết nối thiết bị, cài, logcat |
| frida / frida-ps | 17.17.0 | Hook động (venv `~/re-tools/frida-venv`, symlink ở `~/.local/bin`) |
| Il2CppDumper | v6.7.46 (net7, chạy qua dotnet 10) | Khôi phục C# từ libil2cpp.so |
| frida-il2cpp-bridge | npm (trong `frida_scripts/`) | Hook IL2CPP theo tên class/method |
| dotnet | 10.0.302 | Runtime cho Il2CppDumper |
| sdkmanager | cmdline-tools | Cài build-tools (zipalign/apksigner) khi cần repack |
| uv | 0.11.7 | Quản lý Python (macOS 26 làm hỏng python homebrew) |

> Lưu ý macOS 26.2: `platform.mac_ver()` của python homebrew bị rỗng → pipx/uv fail.
> Đã dùng Python standalone do `uv` quản lý cho frida. `alias il2cppdumper` đã thêm vào `~/.zshrc`.

## Cấu trúc workspace
```
avatar-re/
├── apk_extracted/     # unzip toàn bộ APK
├── jadx_out/          # Java đã decompile (185 MB)
├── apktool_out/       # smali + manifest + res (207 MB)
├── il2cpp_out/        # KẾT QUẢ CHÍNH:
│   ├── dump.cs        #   9.8 MB — toàn bộ class/method C# (đọc bằng editor)
│   ├── il2cpp.h       #   16 MB  — header cho IDA/Ghidra
│   ├── script.json    #   25 MB  — auto-rename hàm trong IDA/Ghidra
│   ├── stringliteral.json
│   └── DummyDll/       #   .NET assembly khôi phục (mở bằng dnSpy/ILSpy)
├── frida_scripts/     # agent.ts (il2cpp-bridge), bypass.js (SSL/root), _agent.js đã build
├── tools/Il2CppDumper/
└── notes/
```

## Quy trình reverse

### 1. Đọc tĩnh logic game (bắt đầu ở đây)
```bash
# Tìm class/method quan tâm trong dump.cs
grep -n "class AincradService" il2cpp_out/dump.cs
grep -niE "password|token|encrypt|Aes|serverUrl|http" il2cpp_out/dump.cs | head
```
Mở `DummyDll/Assembly-CSharp.dll` bằng **dnSpy/ILSpy** để xem cấu trúc dạng cây (dễ hơn dump.cs phẳng).

### 2. Phân tích native trong IDA/Ghidra
- Nạp `apk_extracted/lib/arm64-v8a/libil2cpp.so`.
- IDA: `File > Script file > tools/Il2CppDumper/ida_with_struct_py3.py`, chọn `il2cpp.h` + `script.json`
  → tất cả hàm được đổi tên theo class/method C# thật.
- Ghidra: dùng `ghidra_with_struct.py`.

### 3. Java layer (phụ)
```bash
grep -rniE "firebase|api|http|url" jadx_out/sources/com/TeaM 2>/dev/null | head
```

### 4. Phân tích động (cần thiết bị/emulator + frida-server)
```bash
adb devices
frida-ps -U            # xác nhận frida-server chạy trên thiết bị
# Hook IL2CPP theo tên class:
cd frida_scripts && npm run build
frida -U -f com.TeaM.Avatar -l _agent.js       # sửa agent.ts để chọn class/method
# Bypass SSL pinning + root:
frida -U -f com.TeaM.Avatar -l bypass.js
```
> Cần **frida-server 17.17.x** khớp phiên bản, đẩy lên thiết bị đã root / emulator.
> Với IL2CPP nên ưu tiên `agent.ts` (frida-il2cpp-bridge) thay vì hook Java.

### 5. Repack (nếu patch smali)
```bash
sdkmanager "build-tools;35.0.0"   # lấy zipalign + apksigner (một lần)
apktool b apktool_out -o rebuilt.apk
# rồi zipalign + apksigner sign
```

## Chạy lại Il2CppDumper
```bash
il2cppdumper apk_extracted/lib/arm64-v8a/libil2cpp.so \
             apk_extracted/assets/bin/Data/Managed/Metadata/global-metadata.dat \
             il2cpp_out
```

## Bonus: assets Unity
`assets/bin/Data/data.unity3d` (65 MB) chứa asset game — mở bằng **AssetStudio / AssetRipper** (cài riêng khi cần).
