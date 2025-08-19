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
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./common", "./dht", "./metadata", "./cache", "./error", "./config", "./protocol", "./utils", "./protocol"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Protocol = exports.SystemError = exports.ValidationError = exports.ConfigError = exports.CacheError = exports.MetadataError = exports.DHTError = exports.NetworkError = exports.AppError = exports.ErrorSeverity = exports.ErrorType = exports.isAppError = exports.NodeUnreachableError = exports.DataCorruptedError = exports.HandshakeError = exports.ProtocolError = exports.DNSResolutionError = exports.ConnectionRefusedError = exports.SocketError = void 0;
    __exportStar(require("./common"), exports);
    __exportStar(require("./dht"), exports);
    __exportStar(require("./metadata"), exports);
    __exportStar(require("./cache"), exports);
    const error_1 = require("./error");
    Object.defineProperty(exports, "ErrorType", { enumerable: true, get: function () { return error_1.ErrorType; } });
    Object.defineProperty(exports, "ErrorSeverity", { enumerable: true, get: function () { return error_1.ErrorSeverity; } });
    Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return error_1.AppError; } });
    Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return error_1.NetworkError; } });
    Object.defineProperty(exports, "DHTError", { enumerable: true, get: function () { return error_1.DHTError; } });
    Object.defineProperty(exports, "MetadataError", { enumerable: true, get: function () { return error_1.MetadataError; } });
    Object.defineProperty(exports, "CacheError", { enumerable: true, get: function () { return error_1.CacheError; } });
    Object.defineProperty(exports, "ConfigError", { enumerable: true, get: function () { return error_1.ConfigError; } });
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return error_1.ValidationError; } });
    Object.defineProperty(exports, "SystemError", { enumerable: true, get: function () { return error_1.SystemError; } });
    Object.defineProperty(exports, "SocketError", { enumerable: true, get: function () { return error_1.SocketError; } });
    Object.defineProperty(exports, "ConnectionRefusedError", { enumerable: true, get: function () { return error_1.ConnectionRefusedError; } });
    Object.defineProperty(exports, "DNSResolutionError", { enumerable: true, get: function () { return error_1.DNSResolutionError; } });
    Object.defineProperty(exports, "ProtocolError", { enumerable: true, get: function () { return error_1.ProtocolError; } });
    Object.defineProperty(exports, "HandshakeError", { enumerable: true, get: function () { return error_1.HandshakeError; } });
    Object.defineProperty(exports, "DataCorruptedError", { enumerable: true, get: function () { return error_1.DataCorruptedError; } });
    Object.defineProperty(exports, "NodeUnreachableError", { enumerable: true, get: function () { return error_1.NodeUnreachableError; } });
    Object.defineProperty(exports, "isAppError", { enumerable: true, get: function () { return error_1.isAppError; } });
    __exportStar(require("./config"), exports);
    __exportStar(require("./protocol"), exports);
    __exportStar(require("./utils"), exports);
    const protocol_1 = require("./protocol");
    Object.defineProperty(exports, "Protocol", { enumerable: true, get: function () { return protocol_1.Protocol; } });
});
