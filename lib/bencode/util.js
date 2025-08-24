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
    exports.digitCount = digitCount;
    exports.getType = getType;
    function digitCount(value) {
        const sign = value < 0 ? 1 : 0;
        value = Math.abs(Number(value || 1));
        return Math.floor(Math.log10(value)) + 1 + sign;
    }
    function getType(value) {
        if (ArrayBuffer.isView(value))
            return 'arraybufferview';
        if (Array.isArray(value))
            return 'array';
        if (value instanceof Number)
            return 'number';
        if (value instanceof Boolean)
            return 'boolean';
        if (value instanceof Set)
            return 'set';
        if (value instanceof Map)
            return 'map';
        if (value instanceof String)
            return 'string';
        if (value instanceof ArrayBuffer)
            return 'arraybuffer';
        return typeof value;
    }
});
