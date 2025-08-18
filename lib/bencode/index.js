(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./encode", "./decode", "./encoding-length"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const encode_1 = require("./encode");
    const decode_1 = require("./decode");
    const encoding_length_1 = require("./encoding-length");
    const encodingLength = encoding_length_1.default;
    exports.default = { encode: encode_1.default, decode: decode_1.default, byteLength: encoding_length_1.default, encodingLength };
});
