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
    exports.isAppError = exports.TimeoutError = exports.SystemError = exports.ValidationError = exports.ConfigError = exports.CacheError = exports.MetadataError = exports.DHTError = exports.NetworkError = exports.AppError = exports.ErrorSeverity = exports.ErrorType = void 0;
    var ErrorType;
    (function (ErrorType) {
        ErrorType["NETWORK"] = "NETWORK";
        ErrorType["DHT"] = "DHT";
        ErrorType["METADATA"] = "METADATA";
        ErrorType["CACHE"] = "CACHE";
        ErrorType["PEER"] = "PEER";
        ErrorType["CONFIG"] = "CONFIG";
        ErrorType["VALIDATION"] = "VALIDATION";
        ErrorType["SYSTEM"] = "SYSTEM";
        ErrorType["UNKNOWN"] = "UNKNOWN";
    })(ErrorType = exports.ErrorType || (exports.ErrorType = {}));
    var ErrorSeverity;
    (function (ErrorSeverity) {
        ErrorSeverity["DEBUG"] = "DEBUG";
        ErrorSeverity["INFO"] = "INFO";
        ErrorSeverity["WARNING"] = "WARNING";
        ErrorSeverity["LOW"] = "LOW";
        ErrorSeverity["MEDIUM"] = "MEDIUM";
        ErrorSeverity["HIGH"] = "HIGH";
        ErrorSeverity["ERROR"] = "ERROR";
        ErrorSeverity["CRITICAL"] = "CRITICAL";
        ErrorSeverity["FATAL"] = "FATAL";
    })(ErrorSeverity = exports.ErrorSeverity || (exports.ErrorSeverity = {}));
    class AppError extends Error {
        constructor(message, type = ErrorType.UNKNOWN, severity = ErrorSeverity.MEDIUM, context = {}, recoverable = false, recoveryStrategy) {
            super(message);
            this.name = 'AppError';
            this.type = type;
            this.severity = severity;
            this.timestamp = Date.now();
            this.errorId = `${type}_${this.timestamp}_${Math.random().toString(36).substr(2, 9)}`;
            this.context = Object.assign({ timestamp: this.timestamp, component: 'Unknown' }, context);
            this.recoverable = recoverable;
            this.recoveryStrategy = recoveryStrategy;
            Error.captureStackTrace(this, AppError);
        }
        toJSON() {
            return {
                name: this.name,
                message: this.message,
                type: this.type,
                severity: this.severity,
                context: this.context,
                recoverable: this.recoverable,
                recoveryStrategy: this.recoveryStrategy,
                timestamp: this.timestamp,
                stack: this.stack
            };
        }
    }
    exports.AppError = AppError;
    class NetworkError extends AppError {
        constructor(message, context = {}, recoverable = true) {
            super(message, ErrorType.NETWORK, ErrorSeverity.HIGH, Object.assign({ component: 'Network' }, context), recoverable);
            this.name = 'NetworkError';
        }
    }
    exports.NetworkError = NetworkError;
    class DHTError extends AppError {
        constructor(message, context = {}, recoverable = true) {
            super(message, ErrorType.DHT, ErrorSeverity.HIGH, Object.assign({ component: 'DHT' }, context), recoverable);
            this.name = 'DHTError';
        }
    }
    exports.DHTError = DHTError;
    class MetadataError extends AppError {
        constructor(message, context = {}, recoverable = true) {
            super(message, ErrorType.METADATA, ErrorSeverity.MEDIUM, Object.assign({ component: 'Metadata' }, context), recoverable);
            this.name = 'MetadataError';
        }
    }
    exports.MetadataError = MetadataError;
    class CacheError extends AppError {
        constructor(message, context = {}, recoverable = true) {
            super(message, ErrorType.CACHE, ErrorSeverity.LOW, Object.assign({ component: 'Cache' }, context), recoverable);
            this.name = 'CacheError';
        }
    }
    exports.CacheError = CacheError;
    class ConfigError extends AppError {
        constructor(message, context = {}, recoverable = false) {
            super(message, ErrorType.CONFIG, ErrorSeverity.CRITICAL, Object.assign({ component: 'Config' }, context), recoverable);
            this.name = 'ConfigError';
        }
    }
    exports.ConfigError = ConfigError;
    class ValidationError extends AppError {
        constructor(message, context = {}, recoverable = false) {
            super(message, ErrorType.VALIDATION, ErrorSeverity.MEDIUM, Object.assign({ component: 'Validation' }, context), recoverable);
            this.name = 'ValidationError';
        }
    }
    exports.ValidationError = ValidationError;
    class SystemError extends AppError {
        constructor(message, context = {}, recoverable = false) {
            super(message, ErrorType.SYSTEM, ErrorSeverity.CRITICAL, Object.assign({ component: 'System' }, context), recoverable);
            this.name = 'SystemError';
        }
    }
    exports.SystemError = SystemError;
    class TimeoutError extends AppError {
        constructor(message, context = {}, recoverable = true) {
            super(message, ErrorType.SYSTEM, ErrorSeverity.HIGH, Object.assign({ component: 'Timeout' }, context), recoverable);
            this.name = 'TimeoutError';
        }
    }
    exports.TimeoutError = TimeoutError;
    function isAppError(error) {
        return error.type !== undefined &&
            error.severity !== undefined &&
            error.context !== undefined;
    }
    exports.isAppError = isAppError;
});
