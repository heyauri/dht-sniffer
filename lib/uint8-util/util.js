(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.equal = exports.concat = exports.hex2arr = exports.arr2hex = exports.alphabet = void 0;
    exports.alphabet = '0123456789abcdef';
    const encodeLookup = [];
    const decodeLookup = [];
    for (let i = 0; i < 256; i++) {
        encodeLookup[i] = exports.alphabet[i >> 4 & 0xf] + exports.alphabet[i & 0xf];
        if (i < 16) {
            if (i < 10) {
                decodeLookup[0x30 + i] = i;
            }
            else {
                decodeLookup[0x61 - 10 + i] = i;
            }
        }
    }
    const arr2hex = data => {
        const length = data.length;
        let string = '';
        let i = 0;
        while (i < length) {
            string += encodeLookup[data[i++]];
        }
        return string;
    };
    exports.arr2hex = arr2hex;
    const hex2arr = str => {
        const sizeof = str.length >> 1;
        const length = sizeof << 1;
        const array = new Uint8Array(sizeof);
        let n = 0;
        let i = 0;
        while (i < length) {
            array[n++] = decodeLookup[str.charCodeAt(i++)] << 4 | decodeLookup[str.charCodeAt(i++)];
        }
        return array;
    };
    exports.hex2arr = hex2arr;
    const concat = (chunks, size = 0) => {
        const length = chunks.length || 0;
        if (!size) {
            let i = length;
            while (i--)
                size += chunks[i].length;
        }
        const b = new Uint8Array(size);
        let offset = size;
        let i = length;
        while (i--) {
            offset -= chunks[i].length;
            b.set(chunks[i], offset);
        }
        return b;
    };
    exports.concat = concat;
    const equal = (a, b) => {
        if (a.length !== b.length)
            return false;
        for (let i = a.length; i > -1; i -= 1) {
            if ((a[i] !== b[i]))
                return false;
        }
        return true;
    };
    exports.equal = equal;
});
