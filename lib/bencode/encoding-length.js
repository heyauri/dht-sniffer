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
    function listLength(list) {
        let length = 1 + 1;
        for (const value of list) {
            length += encodingLength(value);
        }
        return length;
    }
    function mapLength(map) {
        let length = 1 + 1;
        for (const [key, value] of map) {
            const keyLength = (0, uint8_util_1.text2arr)(key).byteLength;
            length += (0, util_1.digitCount)(keyLength) + 1 + keyLength;
            length += encodingLength(value);
        }
        return length;
    }
    function objectLength(value) {
        let length = 1 + 1;
        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i++) {
            const keyLength = (0, uint8_util_1.text2arr)(keys[i]).byteLength;
            length += (0, util_1.digitCount)(keyLength) + 1 + keyLength;
            length += encodingLength(value[keys[i]]);
        }
        return length;
    }
    function stringLength(value) {
        const length = (0, uint8_util_1.text2arr)(value).byteLength;
        return (0, util_1.digitCount)(length) + 1 + length;
    }
    function arrayBufferLength(value) {
        const length = value.byteLength - value.byteOffset;
        return (0, util_1.digitCount)(length) + 1 + length;
    }
    function encodingLength(value) {
        const length = 0;
        if (value == null)
            return length;
        const type = (0, util_1.getType)(value);
        switch (type) {
            case 'arraybufferview': return arrayBufferLength(value);
            case 'string': return stringLength(value);
            case 'array':
            case 'set': return listLength(value);
            case 'number': return 1 + (0, util_1.digitCount)(Math.floor(value)) + 1;
            case 'bigint': return 1 + value.toString().length + 1;
            case 'object': return objectLength(value);
            case 'map': return mapLength(value);
            default:
                throw new TypeError(`Unsupported value of type "${type}"`);
        }
    }
    exports.default = encodingLength;
});
