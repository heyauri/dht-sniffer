(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../uint8-util", "./util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const uint8_util_1 = require("../uint8-util");
    const util_1 = require("./util");
    function encode(data, buffer, offset) {
        const buffers = [];
        let result = null;
        encode._encode(buffers, data);
        result = (0, uint8_util_1.concat)(buffers);
        encode.bytes = result.length;
        if (ArrayBuffer.isView(buffer)) {
            buffer.set(result, offset);
            return buffer;
        }
        return result;
    }
    encode.bytes = -1;
    encode._floatConversionDetected = false;
    encode._encode = function (buffers, data) {
        if (data == null) {
            return;
        }
        switch ((0, util_1.getType)(data)) {
            case 'object':
                encode.dict(buffers, data);
                break;
            case 'map':
                encode.dictMap(buffers, data);
                break;
            case 'array':
                encode.list(buffers, data);
                break;
            case 'set':
                encode.listSet(buffers, data);
                break;
            case 'string':
                encode.string(buffers, data);
                break;
            case 'number':
                encode.number(buffers, data);
                break;
            case 'boolean':
                encode.number(buffers, data);
                break;
            case 'arraybufferview':
                encode.buffer(buffers, new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                break;
            case 'arraybuffer':
                encode.buffer(buffers, new Uint8Array(data));
                break;
        }
    };
    const buffE = new Uint8Array([0x65]);
    const buffD = new Uint8Array([0x64]);
    const buffL = new Uint8Array([0x6C]);
    encode.buffer = function (buffers, data) {
        buffers.push((0, uint8_util_1.text2arr)(data.length + ':'), data);
    };
    encode.string = function (buffers, data) {
        buffers.push((0, uint8_util_1.text2arr)((0, uint8_util_1.text2arr)(data).byteLength + ':' + data));
    };
    encode.number = function (buffers, data) {
        if (Number.isInteger(data))
            return buffers.push((0, uint8_util_1.text2arr)('i' + BigInt(data) + 'e'));
        const maxLo = 0x80000000;
        const hi = (data / maxLo) << 0;
        const lo = (data % maxLo) << 0;
        const val = hi * maxLo + lo;
        buffers.push((0, uint8_util_1.text2arr)('i' + val + 'e'));
        if (val !== data && !encode._floatConversionDetected) {
            encode._floatConversionDetected = true;
            console.warn('WARNING: Possible data corruption detected with value "' + data + '":', 'Bencoding only defines support for integers, value was converted to "' + val + '"');
            console.trace();
        }
    };
    encode.dict = function (buffers, data) {
        buffers.push(buffD);
        let j = 0;
        let k;
        const keys = Object.keys(data).sort();
        const kl = keys.length;
        for (; j < kl; j++) {
            k = keys[j];
            if (data[k] == null)
                continue;
            encode.string(buffers, k);
            encode._encode(buffers, data[k]);
        }
        buffers.push(buffE);
    };
    encode.dictMap = function (buffers, data) {
        buffers.push(buffD);
        const keys = Array.from(data.keys()).sort();
        for (const key of keys) {
            if (data.get(key) == null)
                continue;
            ArrayBuffer.isView(key)
                ? encode._encode(buffers, key)
                : encode.string(buffers, String(key));
            encode._encode(buffers, data.get(key));
        }
        buffers.push(buffE);
    };
    encode.list = function (buffers, data) {
        let i = 0;
        const c = data.length;
        buffers.push(buffL);
        for (; i < c; i++) {
            if (data[i] == null)
                continue;
            encode._encode(buffers, data[i]);
        }
        buffers.push(buffE);
    };
    encode.listSet = function (buffers, data) {
        buffers.push(buffL);
        for (const item of data) {
            if (item == null)
                continue;
            encode._encode(buffers, item);
        }
        buffers.push(buffE);
    };
    exports.default = encode;
});
