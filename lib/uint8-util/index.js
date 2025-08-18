var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "node:crypto", "./util.js"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.randomBytes = exports.hash = exports.bin2hex = exports.hex2bin = exports.base2arr = exports.arr2base = exports.text2arr = exports.arr2text = void 0;
    const node_crypto_1 = require("node:crypto");
    const decoder = new TextDecoder();
    const arr2text = (data, enc) => {
        if (data.byteLength > 1024) {
            if (!enc)
                return decoder.decode(data);
            const dec = new TextDecoder(enc);
            return dec.decode(data);
        }
        return Buffer.from(data).toString(enc || 'utf8');
    };
    exports.arr2text = arr2text;
    const text2arr = str => new Uint8Array(Buffer.from(str, 'utf8'));
    exports.text2arr = text2arr;
    const arr2base = data => Buffer.from(data).toString('base64');
    exports.arr2base = arr2base;
    const base2arr = str => new Uint8Array(Buffer.from(str, 'base64'));
    exports.base2arr = base2arr;
    const hex2bin = hex => Buffer.from(hex, 'hex').toString('binary');
    exports.hex2bin = hex2bin;
    const bin2hex = bin => Buffer.from(bin, 'binary').toString('hex');
    exports.bin2hex = bin2hex;
    const hash = (data_1, format_1, ...args_1) => __awaiter(void 0, [data_1, format_1, ...args_1], void 0, function* (data, format, algo = 'sha1') {
        algo = algo.replace('sha-', 'sha');
        const out = (0, node_crypto_1.createHash)(algo).update(data);
        return format ? out.digest(format) : new Uint8Array(out.digest().buffer);
    });
    exports.hash = hash;
    const randomBytes = size => {
        return new Uint8Array((0, node_crypto_1.randomBytes)(size));
    };
    exports.randomBytes = randomBytes;
    __exportStar(require("./util.js"), exports);
});
