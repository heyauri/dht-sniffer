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
    exports.isWireWithUtMetadata = isWireWithUtMetadata;
    exports.isProtocolInstance = isProtocolInstance;
    function isWireWithUtMetadata(wire) {
        return wire &&
            typeof wire.on === 'function' &&
            typeof wire.extended === 'function' &&
            (wire.ut_metadata !== undefined);
    }
    function isProtocolInstance(obj) {
        return obj &&
            typeof obj.use === 'function' &&
            typeof obj.handshake === 'function' &&
            typeof obj.extended === 'function' &&
            typeof obj.on === 'function' &&
            typeof obj.pipe === 'function';
    }
});
