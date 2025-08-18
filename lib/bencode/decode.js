(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../uint8-util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const uint8_util_1 = require("../uint8-util");
    const INTEGER_START = 0x69;
    const STRING_DELIM = 0x3A;
    const DICTIONARY_START = 0x64;
    const LIST_START = 0x6C;
    const END_OF_TYPE = 0x65;
    function getIntFromBuffer(buffer, start, end) {
        let sum = 0;
        let sign = 1;
        for (let i = start; i < end; i++) {
            const num = buffer[i];
            if (num < 58 && num >= 48) {
                sum = sum * 10 + (num - 48);
                continue;
            }
            if (i === start && num === 43) {
                continue;
            }
            if (i === start && num === 45) {
                sign = -1;
                continue;
            }
            if (num === 46) {
                break;
            }
            throw new Error('not a number: buffer[' + i + '] = ' + num);
        }
        return sum * sign;
    }
    function decode(data, start, end, encoding) {
        if (data == null || data.length === 0) {
            return null;
        }
        if (typeof start !== 'number' && encoding == null) {
            encoding = start;
            start = undefined;
        }
        if (typeof end !== 'number' && encoding == null) {
            encoding = end;
            end = undefined;
        }
        decode.position = 0;
        decode.encoding = encoding || null;
        decode.data = !(ArrayBuffer.isView(data))
            ? (0, uint8_util_1.text2arr)(data)
            : new Uint8Array(data.slice(start, end));
        decode.bytes = decode.data.length;
        return decode.next();
    }
    decode.bytes = 0;
    decode.position = 0;
    decode.data = null;
    decode.encoding = null;
    decode.next = function () {
        switch (decode.data[decode.position]) {
            case DICTIONARY_START:
                return decode.dictionary();
            case LIST_START:
                return decode.list();
            case INTEGER_START:
                return decode.integer();
            default:
                return decode.buffer();
        }
    };
    decode.find = function (chr) {
        let i = decode.position;
        const c = decode.data.length;
        const d = decode.data;
        while (i < c) {
            if (d[i] === chr)
                return i;
            i++;
        }
        throw new Error('Invalid data: Missing delimiter "' +
            String.fromCharCode(chr) + '" [0x' +
            chr.toString(16) + ']');
    };
    decode.dictionary = function () {
        decode.position++;
        const dict = {};
        while (decode.data[decode.position] !== END_OF_TYPE) {
            const buffer = decode.buffer();
            let key = (0, uint8_util_1.arr2text)(buffer);
            if (key.includes('\uFFFD'))
                key = (0, uint8_util_1.arr2hex)(buffer);
            dict[key] = decode.next();
        }
        decode.position++;
        return dict;
    };
    decode.list = function () {
        decode.position++;
        const lst = [];
        while (decode.data[decode.position] !== END_OF_TYPE) {
            lst.push(decode.next());
        }
        decode.position++;
        return lst;
    };
    decode.integer = function () {
        const end = decode.find(END_OF_TYPE);
        const number = getIntFromBuffer(decode.data, decode.position + 1, end);
        decode.position += end + 1 - decode.position;
        return number;
    };
    decode.buffer = function () {
        let sep = decode.find(STRING_DELIM);
        const length = getIntFromBuffer(decode.data, decode.position, sep);
        const end = ++sep + length;
        decode.position = end;
        return decode.encoding
            ? (0, uint8_util_1.arr2text)(decode.data.slice(sep, end))
            : decode.data.slice(sep, end);
    };
    exports.default = decode;
});
