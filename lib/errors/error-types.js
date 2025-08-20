(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../types/error"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isAppError = exports.TimeoutError = exports.ConfigError = exports.ValidationError = exports.CacheError = exports.MetadataError = exports.DHTError = exports.SystemError = exports.NetworkError = exports.AppError = exports.ErrorSeverity = exports.ErrorType = void 0;
    const error_1 = require("../types/error");
    Object.defineProperty(exports, "ErrorType", { enumerable: true, get: function () { return error_1.ErrorType; } });
    Object.defineProperty(exports, "ErrorSeverity", { enumerable: true, get: function () { return error_1.ErrorSeverity; } });
    Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return error_1.AppError; } });
    Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return error_1.NetworkError; } });
    Object.defineProperty(exports, "SystemError", { enumerable: true, get: function () { return error_1.SystemError; } });
    Object.defineProperty(exports, "DHTError", { enumerable: true, get: function () { return error_1.DHTError; } });
    Object.defineProperty(exports, "MetadataError", { enumerable: true, get: function () { return error_1.MetadataError; } });
    Object.defineProperty(exports, "CacheError", { enumerable: true, get: function () { return error_1.CacheError; } });
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return error_1.ValidationError; } });
    Object.defineProperty(exports, "ConfigError", { enumerable: true, get: function () { return error_1.ConfigError; } });
    Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function () { return error_1.TimeoutError; } });
    Object.defineProperty(exports, "isAppError", { enumerable: true, get: function () { return error_1.isAppError; } });
});
