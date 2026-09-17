// linkmap17_agent.js — Frida agent: dump LinkMap dest roomIDs for map 17 gates.
//
// Prereq: device/emulator + frida-server + AvatarHD 3.4.4 (com.TeaM.Avatar)
// Run:
//   frida -U -f com.TeaM.Avatar -l linkmap17_agent.js --no-pause
//
// Then in-game: walk into Khu ngoại ô (map 17) and touch each of the 3 gates.
// Expected hooks fire on saveLinkMap / getPosLinkMap / requestResendLinkMap / join.
//
// Native (AvatarHD 3.4.4 arm64):
//   ImageMap.requestResendLinkMap 0x8F69EC → TX -51 [i8 24, i16 mapId-1]
//   ImageMap.saveLinkMap          0x8F6728
//   ImageMap.getPosLinkMap        0x8F74C4
//   ImageMap.getLinkMap           0x8F6ADC
//   ImageMap.LinkMap.ctor         0x78BB40  fields +0x10..0x1c ints, +0x20 i16 idMapTo
//   GlobalService.requestDownloadData 0x6A02A8 → cmd 0xCD (-51), writeByte subtype, writeShort idMap

"use strict";

function log(msg) {
  console.log("[linkmap17] " + msg);
}

function readLinkMapObj(p) {
  // ImageMap.LinkMap instance
  try {
    const x1 = p.add(0x10).readS32();
    const y1 = p.add(0x14).readS32();
    const x2 = p.add(0x18).readS32();
    const y2 = p.add(0x1c).readS32();
    const idMapTo = p.add(0x20).readS16();
    return { x1, y1, x2, y2, idMapTo };
  } catch (e) {
    return { error: String(e) };
  }
}

function dumpVectorLinkMaps(vecPtr, label) {
  if (vecPtr.isNull()) {
    log(label + ": vector=null");
    return;
  }
  try {
    // System.Collections.ArrayList-like: size at +0x18, items at +0x20 (Il2Cpp standard)
    const size = vecPtr.add(0x18).readS32();
    const items = vecPtr.add(0x20).readPointer();
    log(label + ": size=" + size);
    for (let i = 0; i < size && i < 32; i++) {
      const obj = items.add(i * Process.pointerSize).readPointer();
      if (obj.isNull()) continue;
      log("  [" + i + "] " + JSON.stringify(readLinkMapObj(obj)));
    }
  } catch (e) {
    log(label + " dump error: " + e);
  }
}

rpc.exports = {
  init: function () {
    if (!Il2Cpp) {
      log("Il2Cpp not ready — wait for attach");
      return false;
    }
    Il2Cpp.perform(function () {
      const img = Il2Cpp.domain.assembly("Assembly-CSharp").image;

      function hookClassMethod(className, methodName, wrapper) {
        try {
          const klass = img.class(className);
          const method = klass.method(methodName);
          const orig = method;
          method.implementation = function () {
            try {
              wrapper(this, arguments, orig);
            } catch (e) {
              log(className + "." + methodName + " wrapper error: " + e);
            }
            return orig.apply(this, arguments);
          };
          log("hooked " + className + "." + methodName + " @ " + method.handle);
        } catch (e) {
          log("hook fail " + className + "." + methodName + ": " + e);
        }
      }

      // TX -51 request path
      hookClassMethod("ImageMap", "requestResendLinkMap", function (self, args) {
        log("requestResendLinkMap called");
      });

      hookClassMethod("GlobalService", "requestDownloadData", function (self, args) {
        // args: subtype (byte), idMap (short)
        const subtype = args[1];
        const idMap = args[2];
        log("requestDownloadData subtype=" + subtype + " idMap=" + idMap);
      });

      // saveLinkMap(idMap, wMap, hMap, list)
      hookClassMethod("ImageMap", "saveLinkMap", function (self, args) {
        const idMap = args[1];
        const wMap = args[2];
        const hMap = args[3];
        const list = args[4];
        log("saveLinkMap idMap=" + idMap + " w=" + wMap + " h=" + hMap);
        dumpVectorLinkMaps(list, "saveLinkMap.list");
      });

      // getPosLinkMap(x, y) — called when player walks on a tile
      hookClassMethod("ImageMap", "getPosLinkMap", function (self, args) {
        const x = args[1];
        const y = args[2];
        log("getPosLinkMap x=" + x + " y=" + y);
      });

      // getLinkMap(idMap)
      hookClassMethod("ImageMap", "getLinkMap", function (self, args) {
        log("getLinkMap idMap=" + args[1]);
      });

      // Park join — see dest room when walking through a gate
      try {
        const Park = img.class("ParkService");
        Park.method("doJoinPark").implementation = function (map, area) {
          log("doJoinPark map=" + map + " area=" + area);
          return this.method("doJoinPark").invoke(map, area);
        };
        log("hooked ParkService.doJoinPark");
      } catch (e) {
        log("ParkService.doJoinPark hook: " + e);
      }

      log("ready — walk map 17 and touch the 3 gates");
    });
    return true;
  },
};
