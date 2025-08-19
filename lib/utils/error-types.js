(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./error-handler", "./error-handler"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CacheError = exports.ResourceExhaustedError = exports.ValidationError = exports.BootstrapError = exports.NodeUnreachableError = exports.DHTError = exports.DataCorruptedError = exports.MetadataError = exports.HandshakeError = exports.ProtocolError = exports.DNSResolutionError = exports.ConnectionRefusedError = exports.TimeoutError = exports.NetworkError = exports.SocketError = exports.SystemError = exports.AppError = exports.ErrorSeverity = exports.ErrorType = void 0;
    exports.isAppError = isAppError;
    exports.isErrorType = isErrorType;
    var error_handler_1 = require("./error-handler");
    Object.defineProperty(exports, "ErrorType", { enumerable: true, get: function () { return error_handler_1.ErrorType; } });
    var error_handler_2 = require("./error-handler");
    Object.defineProperty(exports, "ErrorSeverity", { enumerable: true, get: function () { return error_handler_2.ErrorSeverity; } });
    class AppError extends Error {
        constructor(type, message, severity = ErrorSeverity.ERROR, context = {}, originalError, recoverable = true) {
            super(message);
            this.name = 'AppError';
            this.type = type;
            this.severity = severity;
            this.context = context;
            this.originalError = originalError;
            this.recoverable = recoverable;
            this.timestamp = Date.now();
            this.errorId = this.generateErrorId();
            this.stack = (originalError === null || originalError === void 0 ? void 0 : originalError.stack) || this.stack;
        }
        generateErrorId() {
            const timestamp = this.timestamp.toString(36);
            const random = Math.random().toString(36).substr(2, 5);
            const type = this.type.toString().substr(0, 3);
            return `${timestamp}-${random}-${type}`;
        }
        toJSON() {
            return {
                errorId: this.errorId,
                type: this.type,
                message: this.message,
                severity: this.severity,
                timestamp: this.timestamp,
                context: this.context,
                recoverable: this.recoverable,
                stack: this.stack,
                name: this.name
            };
        }
        toString() {
            return `[${this.type}] ${this.message} (Severity: ${this.severity}, ID: ${this.errorId})`;
        }
    }
    exports.AppError = AppError;
    class SystemError extends AppError {
        constructor(message, context = {}, originalError, recoverable = true) {
            super(ErrorType.SYSTEM_ERROR, message, ErrorSeverity.ERROR, context, originalError, recoverable);
            this.name = 'SystemError';
        }
    }
    exports.SystemError = SystemError;
    class SocketError extends AppError {
        constructor(message, context = {}, originalError, recoverable = true) {
            super(ErrorType.SOCKET_ERROR, message, ErrorSeverity.ERROR, context, originalError, recoverable);
            this.name = 'SocketError';
        }
    }
    exports.SocketError = SocketError;
    class NetworkError extends AppError {
        constructor(message, context = {}, originalError, recoverable = true) {
            super(ErrorType.NETWORK_ERROR, message, ErrorSeverity.ERROR, context, originalError, recoverable);
            this.name = 'NetworkError';
        }
    }
    exports.NetworkError = NetworkError;
    class TimeoutError extends AppError {
        constructor(message = 'Connection timeout', context = {}, originalError, recoverable = true) {
            super(ErrorType.CONNECTION_TIMEOUT, message, ErrorSeverity.WARNING, context, originalError, recoverable);
            this.name = 'TimeoutError';
        }
    }
    exports.TimeoutError = TimeoutError;
    class ConnectionRefusedError extends AppError {
        constructor(message = 'Connection refused', context = {}, originalError, recoverable = false) {
            super(ErrorType.CONNECTION_REFUSED, message, ErrorSeverity.ERROR, context, originalError, recoverable);
            this.name = 'ConnectionRefusedError';
        }
    }
    exports.ConnectionRefusedError = ConnectionRefusedError;
    class DNSResolutionError extends AppError {
        constructor(message = 'DNS resolution failed', context = {}, originalError, recoverable = false) {
            super(ErrorType.DNS_RESOLUTION_FAILED, message, ErrorSeverity.ERROR, context, originalError, recoverable);
            this.name = 'DNSResolutionError';
        }
    }
    exports.DNSResolutionError = DNSResolutionError;
    class ProtocolError extends AppError {
        constructor(message, context = {}, originalError, recoverable = true) {
            super(ErrorType.PROTOCOL_ERROR, message, ErrorSeverity.ERROR, context, originalError, recoverable);
            this.name = 'ProtocolError';
        }
    }
    exports.ProtocolError = ProtocolError;
    class HandshakeError extends AppError {
        constructor(message = 'Handshake failed', context = {}, originalError, recoverable = true) {
            super(ErrorType.HANDSHAKE_FAILED, message, ErrorSeverity.ERROR, context, originalError, recoverable);
            this.name = 'HandshakeError';
        }
    }
    exports.HandshakeError = HandshakeError;
    class MetadataError extends AppError {
        constructor(message, context = {}, originalError, recoverable = true) {
            super(ErrorType.INVALID_METADATA, message, ErrorSeverity.ERROR, context, originalError, recoverable);
            this.name = 'MetadataError';
        }
    }
    exports.MetadataError = MetadataError;
    class DataCorruptedError extends AppError {
        constructor(message = 'Data corrupted', context = {}, originalError, recoverable = false) {
            super(ErrorType.DATA_CORRUPTED, message, ErrorSeverity.CRITICAL, context, originalError, recoverable);
            this.name = 'DataCorruptedError';
        }
    }
    exports.DataCorruptedError = DataCorruptedError;
    class DHTError extends AppError {
        constructor(message, context = {}, originalError, recoverable = true) {
            super(ErrorType.DHT_ERROR, message, ErrorSeverity.ERROR, context, originalError, recoverable);
            this.name = 'DHTError';
        }
    }
    exports.DHTError = DHTError;
    class NodeUnreachableError extends AppError {
        constructor(message = 'Node unreachable', context = {}, originalError, recoverable = true) {
            super(ErrorType.NODE_UNREACHABLE, message, ErrorSeverity.WARNING, context, originalError, recoverable);
            this.name = 'NodeUnreachableError';
        }
    }
    exports.NodeUnreachableError = NodeUnreachableError;
    class BootstrapError extends AppError {
        constructor(message = 'Bootstrap failed', context = {}, originalError, recoverable = true) {
            super(ErrorType.BOOTSTRAP_FAILED, message, ErrorSeverity.CRITICAL, context, originalError, recoverable);
            this.name = 'BootstrapError';
        }
    }
    exports.BootstrapError = BootstrapError;
    class ValidationError extends AppError {
        constructor(message, context = {}, originalError, recoverable = true) {
            super(ErrorType.VALIDATION_ERROR, message, ErrorSeverity.WARNING, context, originalError, recoverable);
            this.name = 'ValidationError';
        }
    }
    exports.ValidationError = ValidationError;
    class ResourceExhaustedError extends AppError {
        constructor(message = 'Resource exhausted', context = {}, originalError, recoverable = true) {
            super(ErrorType.RESOURCE_EXHAUSTED, message, ErrorSeverity.WARNING, context, originalError, recoverable);
            this.name = 'ResourceExhaustedError';
        }
    }
    exports.ResourceExhaustedError = ResourceExhaustedError;
    class CacheError extends AppError {
        constructor(message, context = {}, originalError, recoverable = true) {
            super(ErrorType.CACHE_ERROR, message, ErrorSeverity.WARNING, context, originalError, recoverable);
            this.name = 'CacheError';
        }
    }
    exports.CacheError = CacheError;
    function isAppError(error) {
        return error instanceof AppError;
    }
    function isErrorType(error, type) {
        return isAppError(error) && error.type === type;
    }
});
