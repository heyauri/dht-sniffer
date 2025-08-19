(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../types/error", "./error-handler-impl"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.globalErrorHandler = exports.DefaultErrorHandler = exports.ErrorHandlerImpl = exports.SystemError = exports.ValidationError = exports.CacheError = exports.MetadataError = exports.DHTError = exports.NetworkError = exports.AppError = exports.ErrorSeverity = exports.ErrorType = void 0;
    const error_1 = require("../types/error");
    Object.defineProperty(exports, "ErrorType", { enumerable: true, get: function () { return error_1.ErrorType; } });
    Object.defineProperty(exports, "ErrorSeverity", { enumerable: true, get: function () { return error_1.ErrorSeverity; } });
    Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return error_1.AppError; } });
    Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return error_1.NetworkError; } });
    Object.defineProperty(exports, "DHTError", { enumerable: true, get: function () { return error_1.DHTError; } });
    Object.defineProperty(exports, "MetadataError", { enumerable: true, get: function () { return error_1.MetadataError; } });
    Object.defineProperty(exports, "CacheError", { enumerable: true, get: function () { return error_1.CacheError; } });
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return error_1.ValidationError; } });
    Object.defineProperty(exports, "SystemError", { enumerable: true, get: function () { return error_1.SystemError; } });
    const error_handler_impl_1 = require("./error-handler-impl");
    Object.defineProperty(exports, "ErrorHandlerImpl", { enumerable: true, get: function () { return error_handler_impl_1.ErrorHandlerImpl; } });
    Object.defineProperty(exports, "DefaultErrorHandler", { enumerable: true, get: function () { return error_handler_impl_1.ErrorHandlerImpl; } });
    exports.globalErrorHandler = new error_handler_impl_1.ErrorHandlerImpl();
});
