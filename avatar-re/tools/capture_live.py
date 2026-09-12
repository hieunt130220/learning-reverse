"""Live Frida capture for fishing protocol verification (Phase A/B).

Phase A: log Thread.backtrace for setIndex calls inside the challenge window
         (from onCaCanCau until 3s after doFinishFishing) plus sampled baseline
         backtraces of out-of-window background calls, to distinguish the
         challenge answer calls from the continuous setIndex(0,0) spam.
Phase B: optional --replace "k0,k1,..." rewrites the answer setIndex calls to
         (K, isClick=1), filtered by --ret-filter (libil2cpp offset of the
         answer caller's return address) learned from Phase A.

Verification-only tooling. Not committed. Never log account/packet secrets.
"""
import argparse
import json
import sys
import time

import frida

parser = argparse.ArgumentParser()
parser.add_argument('--replace', default=None,
                    help='comma-separated K values to substitute into answer setIndex calls (Phase B)')
parser.add_argument('--ret-filter', default=None,
                    help='libil2cpp offset (hex, no 0x needed) of the answer caller return address')
args = parser.parse_args()

replace_seq = []
if args.replace:
    replace_seq = [int(x) for x in args.replace.split(',') if x.strip() != '']
ret_filter = None
if args.ret_filter:
    ret_filter = int(args.ret_filter, 16)

device = frida.get_remote_device()


def get_game_pid():
    for p in device.enumerate_processes():
        if p.name == 'Avatar':
            return p.pid
    raise SystemExit('game process not found')


session = device.attach(get_game_pid())

hook_js = """
const base = Process.getModuleByName('libil2cpp.so').base;
const msgGetData = new NativeFunction(base.add(0xBFB1FC), 'pointer', ['pointer']);

// Phase A state
let challengeArmedUntil = 0;   // ms epoch; window open from onCaCanCau
let btCounter = 0;

// Phase B state (set from Python args)
const REPLACE_SEQ = %REPLACE_SEQ%;
const RET_FILTER = %RET_FILTER%;   // null = no filter
let replaceIdx = 0;

function frameLabel(addr) {
    const m = Process.findModuleByAddress(addr);
    if (m === null) return addr.toString();
    return m.name + '+0x' + addr.sub(m.base).toString(16);
}

function compactBacktrace(ctx) {
    try {
        return Thread.backtrace(ctx, Backtracer.ACCURATE).slice(0, 8).map(frameLabel);
    } catch (e) {
        return ['<bt-error>'];
    }
}

function readBytes(il2cppBytes) {
    if (il2cppBytes.isNull()) return [];
    const len = il2cppBytes.add(0x18).readS32();
    const dataPtr = il2cppBytes.add(0x20);
    const buf = [];
    for (let i = 0; i < len; i++) {
        buf.push(dataPtr.add(i).readU8());
    }
    return buf;
}

function readJaggedArray(arrPtr) {
    if (arrPtr.isNull()) return [];
    const len = arrPtr.add(0x18).readS32();
    const dataPtr = arrPtr.add(0x20);
    const result = [];
    for (let i = 0; i < len; i++) {
        const subArrPtr = dataPtr.add(i * 8).readPointer();
        if (subArrPtr.isNull()) {
            result.push({ len: 0 });
        } else {
            const b = readBytes(subArrPtr);
            result.push({ len: b.length });
        }
    }
    return result;
}

// Hooks
const rva_onCaCanCau = 0x5DDD68;
const rva_setIndex = 0x5DBA60;
const rva_doFinishFishing = 0x71BC4C;
const rva_doStartFishing = 0x71BF14;
const rva_doSat = 0x5DB350;
const rva_onQuanCau = 0x5DDCD8;
const rva_onFinish = 0x5DE938;
const rva_onCauCaXong = 0x5DEB9C;
const rva_onStartFishing = 0x5DEED0;
const rva_sendMessage = 0x6798C4;
const rva_onRecieveMsg = 0x679F70;

Interceptor.attach(base.add(rva_doSat), {
    onEnter(args) {
        send({ event: 'doSat', x: args[1].toInt32(), y: args[2].toInt32() });
    }
});

Interceptor.attach(base.add(rva_doStartFishing), {
    onEnter(args) {
        send({ event: 'doStartFishing' });
    }
});

Interceptor.attach(base.add(rva_onStartFishing), {
    onEnter(args) {
        send({ event: 'onStartFishing', iss: args[1].toInt32() });
    }
});

Interceptor.attach(base.add(rva_onQuanCau), {
    onEnter(args) {
        send({ event: 'onQuanCau', idUser: args[1].toInt32() });
    }
});

Interceptor.attach(base.add(rva_onCaCanCau), {
    onEnter(args) {
        const idUser = args[1].toInt32();
        const idFish = args[2].toInt32();
        const timeDelay = args[3].toInt32();
        const refs = readJaggedArray(args[4]);
        const queries = readJaggedArray(args[5]);

        // open the challenge window: keep it open until 3s after doFinishFishing
        challengeArmedUntil = Date.now() + 60000;

        send({
            event: 'onCaCanCau',
            idUser: idUser,
            idFish: idFish,
            timeDelay: timeDelay,
            refCount: refs.length,
            refLens: refs.map(r => r.len),
            queryCount: queries.length,
            queryLens: queries.map(q => q.len)
        });
    }
});

Interceptor.attach(base.add(rva_setIndex), {
    onEnter(args) {
        const now = Date.now();
        const inWindow = now < challengeArmedUntil;
        const key = args[1].toInt32();
        const isClick = args[2].toInt32();

        btCounter++;
        const sampleBt = inWindow || (btCounter % 256 === 0);

        if (REPLACE_SEQ.length > 0 && inWindow && replaceIdx < REPLACE_SEQ.length) {
            // Phase B: optionally filter by caller return address, then rewrite args
            let matches = true;
            let firstIl2cpp = null;
            if (RET_FILTER !== null) {
                const bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                for (let i = 0; i < bt.length && i < 4; i++) {
                    const m = Process.findModuleByAddress(bt[i]);
                    if (m !== null && m.name === 'libil2cpp.so') {
                        firstIl2cpp = bt[i].sub(m.base).toString(16);
                        break;
                    }
                }
                matches = (firstIl2cpp !== null &&
                           parseInt(firstIl2cpp, 16) === RET_FILTER);
            }
            if (matches) {
                const newKey = REPLACE_SEQ[replaceIdx];
                args[1] = ptr(newKey);
                args[2] = ptr(1);
                send({
                    event: 'setIndexReplaced',
                    idx: replaceIdx,
                    origKey: key,
                    origIsClick: isClick,
                    newKey: newKey,
                    ret: firstIl2cpp
                });
                replaceIdx++;
                return;
            } else {
                send({
                    event: 'setIndexSkipped',
                    key: key,
                    isClick: isClick,
                    ret: firstIl2cpp
                });
                return;
            }
        }

        if (sampleBt) {
            send({
                event: 'setIndexBT',
                key: key,
                isClick: isClick,
                inWindow: inWindow,
                bt: compactBacktrace(this.context)
            });
        }
        // out-of-window unsampled spam is intentionally not logged
    }
});

Interceptor.attach(base.add(rva_doFinishFishing), {
    onEnter(args) {
        const isF = args[1].toInt32();
        const arrPtr = args[2];
        let bytes = [];
        if (!arrPtr.isNull()) {
            const len = arrPtr.add(0x18).readS32();
            const dataPtr = arrPtr.add(0x20);
            for (let i = 0; i < len; i++) {
                bytes.push(dataPtr.add(i).readS8());
            }
        }
        // close the challenge window 3s from now
        challengeArmedUntil = Date.now() + 3000;
        send({
            event: 'doFinishFishing',
            source: 'ParkService.doFinishFishing',
            isF: isF,
            length: bytes.length,
            answerBytes: bytes
        });
    }
});

Interceptor.attach(base.add(rva_onFinish), {
    onEnter(args) {
        send({ event: 'onFinish', idUser: args[1].toInt32(), idFish: args[2].toInt32() });
    }
});

Interceptor.attach(base.add(rva_onCauCaXong), {
    onEnter(args) {
        send({ event: 'onCauCaXong', idUser: args[1].toInt32() });
    }
});

Interceptor.attach(base.add(rva_sendMessage), {
    onEnter(args) {
        try {
            const msg = args[1];
            if (msg.isNull()) return;
            const cmd = msg.add(0x10).readS8();
            // Keep the native command/body observation independent from the
            // FishingScr hooks. Some builds dispatch doFinishFishing through
            // a wrapper, so the method hook can miss TX43 even though the
            // packet is actually sent.
            if (cmd === 43 || cmd === 41 || cmd === 45 || cmd === 44 || cmd === -43) {
                const dataPtr = msgGetData(msg);
                const b = readBytes(dataPtr);
                send({
                    event: 'TX',
                    source: 'Session_ME.sendMessage(native)',
                    cmd: cmd,
                    len: b.length,
                    hex: b.map(x => x.toString(16).padStart(2, '0')).join(' ')
                });
            }
        } catch(e) {}
    }
});

Interceptor.attach(base.add(rva_onRecieveMsg), {
    onEnter(args) {
        try {
            const msg = args[1];
            if (msg.isNull()) return;
            const cmd = msg.add(0x10).readS8();
            if (cmd === 79 || cmd === 43 || cmd === 41 || cmd === 45 || cmd === 44) {
                const dataPtr = msgGetData(msg);
                const b = readBytes(dataPtr);
                send({
                    event: 'RX',
                    cmd: cmd,
                    len: b.length,
                    hex: b.slice(0, 32).map(x => x.toString(16).padStart(2, '0')).join(' ')
                });
            }
        } catch(e) {}
    }
});

send({
    status: 'ready',
    replaceSeq: REPLACE_SEQ,
    retFilter: RET_FILTER
});
"""

hook_js = hook_js.replace('%REPLACE_SEQ%', json.dumps(replace_seq))
hook_js = hook_js.replace('%RET_FILTER%', json.dumps(ret_filter))

script = session.create_script(hook_js)


def on_msg(message, data):
    if message['type'] == 'send':
        p = message['payload']
        print(f"[{time.strftime('%H:%M:%S')}] {json.dumps(p)}")
        sys.stdout.flush()
    else:
        print(f"[ERR] {message}")
        sys.stdout.flush()


script.on('message', on_msg)
script.load()

try:
    while True:
        time.sleep(0.5)
except KeyboardInterrupt:
    session.detach()
