const hex = "0101177800020063000a00140002000a14010000001e0000000202000000300000000803000000030000000104000000140000000a050000000a0000000206000f42400000582d08000001f4000000640900001260000000010000000007000000ce000000140000000007000000cd000000140000000007000000da00000014000000000700000111000000140000000007000000d4000000140000000007000001130000001400000000070000011f00000014000000000700000119000000140000000007000001180000001400000000070000011c000000140000000007000001160000001400000000070000011d0000001400000000";
const buf = Buffer.from(hex, "hex");
let offset = 0;
function readByte() { const b = buf.readInt8(offset); offset += 1; return b; }
function readShort() { const b = buf.readInt16BE(offset); offset += 2; return b; }
function readInt() { const b = buf.readInt32BE(offset); offset += 4; return b; }

console.log("action =", readByte());
console.log("type =", readByte());
console.log("img =", readShort());

const nItem = readShort();
console.log("nItem =", nItem);
for(let i=0; i<nItem; i++) {
  console.log("  item", readShort(), "num", readShort());
}

const nMission = readShort();
console.log("nMission =", nMission);
for(let i=0; i<nMission; i++) {
  console.log("  mission", readByte(), "target", readInt(), "current", readInt());
}

while(offset < buf.length) {
    console.log("remaining byte", readByte());
}
