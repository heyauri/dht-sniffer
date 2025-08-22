(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isProtocolInstance = exports.isWireWithUtMetadata = void 0;
    const events_1 = require("events");
    function isWireWithUtMetadata(wire) {
        return wire && typeof wire.ut_metadata !== 'undefined';
    }
    exports.isWireWithUtMetadata = isWireWithUtMetadata;
    function isProtocolInstance(obj) {
        return obj && typeof obj.handshake === 'function' && typeof obj.extended === 'function';
    }
    exports.isProtocolInstance = isProtocolInstance;
});
