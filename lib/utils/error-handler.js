var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "crypto"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ErrorRecoveryManager = exports.TimeoutErrorRecoveryStrategy = exports.NetworkErrorRecoveryStrategy = exports.ErrorHandlerUtils = exports.globalErrorHandler = exports.ErrorHandler = exports.CacheError = exports.ResourceExhaustedError = exports.ValidationError = exports.BootstrapError = exports.NodeUnreachableError = exports.DHTError = exports.DataCorruptedError = exports.MetadataError = exports.HandshakeError = exports.ProtocolError = exports.DNSResolutionError = exports.ConnectionRefusedError = exports.TimeoutError = exports.NetworkError = exports.AppError = exports.ErrorSeverity = exports.ErrorType = void 0;
    exports.isAppError = isAppError;
    exports.isErrorType = isErrorType;
    exports.withRetry = withRetry;
    const events_1 = require("events");
    const crypto_1 = require("crypto");
    var ErrorType;
    (function (ErrorType) {
        ErrorType["SOCKET_ERROR"] = "SOCKET_ERROR";
        ErrorType["CONNECTION_TIMEOUT"] = "CONNECTION_TIMEOUT";
        ErrorType["CONNECTION_REFUSED"] = "CONNECTION_REFUSED";
        ErrorType["NETWORK_UNREACHABLE"] = "NETWORK_UNREACHABLE";
        ErrorType["DNS_RESOLUTION_FAILED"] = "DNS_RESOLUTION_FAILED";
        ErrorType["PROTOCOL_ERROR"] = "PROTOCOL_ERROR";
        ErrorType["HANDSHAKE_FAILED"] = "HANDSHAKE_FAILED";
        ErrorType["METADATA_WARNING"] = "METADATA_WARNING";
        ErrorType["EXTENSION_ERROR"] = "EXTENSION_ERROR";
        ErrorType["PROTOCOL_VIOLATION"] = "PROTOCOL_VIOLATION";
        ErrorType["INVALID_METADATA"] = "INVALID_METADATA";
        ErrorType["INVALID_INFO_HASH"] = "INVALID_INFO_HASH";
        ErrorType["DECODE_ERROR"] = "DECODE_ERROR";
        ErrorType["ENCODE_ERROR"] = "ENCODE_ERROR";
        ErrorType["DATA_CORRUPTED"] = "DATA_CORRUPTED";
        ErrorType["INVALID_FORMAT"] = "INVALID_FORMAT";
        ErrorType["DHT_ERROR"] = "DHT_ERROR";
        ErrorType["NODE_UNREACHABLE"] = "NODE_UNREACHABLE";
        ErrorType["BOOTSTRAP_FAILED"] = "BOOTSTRAP_FAILED";
        ErrorType["KBUCKET_ERROR"] = "KBUCKET_ERROR";
        ErrorType["RPC_ERROR"] = "RPC_ERROR";
        ErrorType["SYSTEM_ERROR"] = "SYSTEM_ERROR";
        ErrorType["MEMORY_ERROR"] = "MEMORY_ERROR";
        ErrorType["FILE_SYSTEM_ERROR"] = "FILE_SYSTEM_ERROR";
        ErrorType["CONFIGURATION_ERROR"] = "CONFIGURATION_ERROR";
        ErrorType["CACHE_ERROR"] = "CACHE_ERROR";
        ErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
        ErrorType["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
        ErrorType["RESOURCE_EXHAUSTED"] = "RESOURCE_EXHAUSTED";
        ErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    })(ErrorType || (exports.ErrorType = ErrorType = {}));
    var ErrorSeverity;
    (function (ErrorSeverity) {
        ErrorSeverity["DEBUG"] = "DEBUG";
        ErrorSeverity["INFO"] = "INFO";
        ErrorSeverity["WARNING"] = "WARNING";
        ErrorSeverity["ERROR"] = "ERROR";
        ErrorSeverity["CRITICAL"] = "CRITICAL";
        ErrorSeverity["FATAL"] = "FATAL";
    })(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
    class AppError extends Error {
        constructor(type, message, severity = ErrorSeverity.ERROR, context = {}, originalError, recoverable = true) {
            super(message);
            this.name = 'AppError';
            this.type = type;
            this.severity = severity;
            this.timestamp = Date.now();
            this.context = context;
            this.originalError = originalError;
            this.recoverable = recoverable;
            this.errorId = (0, crypto_1.createHash)('md5')
                .update(`${type}-${message}-${this.timestamp}-${JSON.stringify(context)}`)
                .digest('hex')
                .substring(0, 8);
            if (originalError && originalError.stack) {
                this.stack = originalError.stack;
            }
            if (Object.keys(context).length > 0) {
                this.stack += `\nError Context: ${JSON.stringify(context, null, 2)}`;
            }
        }
        toJSON() {
            var _a;
            return {
                errorId: this.errorId,
                type: this.type,
                severity: this.severity,
                message: this.message,
                timestamp: this.timestamp,
                context: this.context,
                stack: this.stack,
                originalError: (_a = this.originalError) === null || _a === void 0 ? void 0 : _a.message
            };
        }
        toString() {
            return `[${this.severity}] ${this.type}: ${this.message} (ID: ${this.errorId})`;
        }
    }
    exports.AppError = AppError;
    class NetworkError extends AppError {
        constructor(message, context = {}, originalError, recoverable = true) {
            super(ErrorType.SOCKET_ERROR, message, ErrorSeverity.ERROR, context, originalError, recoverable);
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
    class ErrorHandler extends events_1.EventEmitter {
        constructor(config = {}) {
            super();
            this.errorHistory = [];
            this.errorCounts = new Map();
            this.lastErrorTime = new Map();
            this.recoveryAttempts = new Map();
            this.lastRecoveryTime = new Map();
            this.config = Object.assign({ enableConsoleLog: true, enableFileLog: false, maxErrorHistory: 1000, errorThreshold: 10, thresholdTimeWindow: 60000, enableStructuredLogging: false, logLevel: ErrorSeverity.INFO, enableErrorTracking: false }, config);
            this.recoveryManager = new ErrorRecoveryManager();
            Object.values(ErrorType).forEach(errorType => {
                this.errorCounts.set(errorType, 0);
                this.lastErrorTime.set(errorType, 0);
            });
        }
        handleError(error, context = {}) {
            const appError = this.normalizeError(error, context);
            if (this.shouldFilterError(appError)) {
                return;
            }
            this.addToHistory(appError);
            this.updateErrorCounts(appError);
            this.checkErrorThreshold(appError);
            this.logError(appError);
            this.emit('error', appError);
            this.emitBySeverity(appError);
            if (appError.recoverable) {
                this.attemptRecovery(appError);
            }
            if (this.config.enableErrorTracking && this.config.trackingEndpoint) {
                this.sendErrorTracking(appError);
            }
        }
        normalizeError(error, context) {
            if (isAppError(error)) {
                return new AppError(error.type, error.message, error.severity, Object.assign(Object.assign({}, error.context), context), error.originalError);
            }
            let errorType = ErrorType.SYSTEM_ERROR;
            let severity = ErrorSeverity.ERROR;
            if (error.name === 'TimeoutError' || error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                errorType = ErrorType.CONNECTION_TIMEOUT;
                severity = ErrorSeverity.WARNING;
            }
            else if (error.message.includes('ECONNREFUSED') || error.message.includes('refused')) {
                errorType = ErrorType.CONNECTION_REFUSED;
                severity = ErrorSeverity.ERROR;
            }
            else if (error.message.includes('DNS') || error.message.includes('ENOTFOUND')) {
                errorType = ErrorType.DNS_RESOLUTION_FAILED;
                severity = ErrorSeverity.ERROR;
            }
            else if (error.message.includes('protocol') || error.message.includes('handshake')) {
                errorType = ErrorType.PROTOCOL_ERROR;
                severity = ErrorSeverity.ERROR;
            }
            return new AppError(errorType, error.message, severity, Object.assign(Object.assign({}, context), { stack: error.stack, name: error.name, code: error.code }), error);
        }
        addToHistory(error) {
            const errorRecord = {
                id: error.errorId,
                type: error.type,
                message: error.message,
                severity: error.severity,
                timestamp: error.timestamp,
                context: error.context,
                recoverable: error.recoverable,
                retryCount: 0
            };
            this.errorHistory.push(errorRecord);
            if (this.errorHistory.length > this.config.maxErrorHistory) {
                this.errorHistory = this.errorHistory.slice(-this.config.maxErrorHistory);
            }
        }
        shouldFilterError(error) {
            if (error.severity < this.config.logLevel) {
                return true;
            }
            if (this.config.customErrorFilters && this.config.customErrorFilters.includes(error.type)) {
                return true;
            }
            return false;
        }
        attemptRecovery(error) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a;
                const strategy = (_a = this.config.recoveryStrategies) === null || _a === void 0 ? void 0 : _a[error.type];
                if (!strategy) {
                    const result = yield this.recoveryManager.attemptRecovery(error);
                    if (result.success) {
                        this.emit('recovery_success', { error, result });
                    }
                    else {
                        this.emit('recovery_failed', { error, result });
                    }
                    return;
                }
                const errorKey = `${error.type}_${error.context.operation || 'unknown'}`;
                const attempts = this.recoveryAttempts.get(errorKey) || 0;
                const lastAttempt = this.lastRecoveryTime.get(errorKey) || 0;
                const now = Date.now();
                if (attempts >= strategy.maxRetries) {
                    return;
                }
                let delay = strategy.delayMs;
                if (strategy.exponentialBackoff) {
                    delay = strategy.delayMs * Math.pow(2, attempts);
                }
                if (now - lastAttempt < delay) {
                    return;
                }
                this.recoveryAttempts.set(errorKey, attempts + 1);
                this.lastRecoveryTime.set(errorKey, now);
                this.emit('recovery_attempt', {
                    error,
                    attempt: attempts + 1,
                    maxAttempts: strategy.maxRetries,
                    delay
                });
            });
        }
        sendErrorTracking(error) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!this.config.trackingEndpoint) {
                    return;
                }
                try {
                    const trackingData = {
                        errorId: error.errorId,
                        type: error.type,
                        message: error.message,
                        severity: error.severity,
                        timestamp: error.timestamp,
                        context: error.context,
                        recoverable: error.recoverable,
                        stack: error.stack
                    };
                    console.log('Sending error tracking data:', trackingData);
                }
                catch (trackingError) {
                    console.warn('Failed to send error tracking:', trackingError);
                }
            });
        }
        updateErrorCounts(error) {
            const count = this.errorCounts.get(error.type) || 0;
            this.errorCounts.set(error.type, count + 1);
            this.lastErrorTime.set(error.type, Date.now());
        }
        checkErrorThreshold(error) {
            const count = this.errorCounts.get(error.type) || 0;
            const lastTime = this.lastErrorTime.get(error.type) || 0;
            const timeSinceLastError = Date.now() - lastTime;
            if (count >= this.config.errorThreshold && timeSinceLastError <= this.config.thresholdTimeWindow) {
                this.emit('errorThresholdExceeded', {
                    errorType: error.type,
                    count,
                    timeWindow: this.config.thresholdTimeWindow
                });
                this.errorCounts.set(error.type, 0);
            }
        }
        logError(error) {
            if (this.config.enableStructuredLogging) {
                this.logStructuredError(error);
            }
            else {
                this.logSimpleError(error);
            }
        }
        logStructuredError(error) {
            const logEntry = {
                timestamp: new Date(error.timestamp).toISOString(),
                level: this.getLogLevelString(error.severity),
                errorType: error.type,
                errorMessage: error.message,
                errorId: error.errorId,
                severity: error.severity,
                recoverable: error.recoverable,
                retryCount: error.context.retryCount,
                context: error.context,
                stack: error.stack
            };
            const logMessage = JSON.stringify(logEntry);
            if (this.config.enableConsoleLog) {
                switch (error.severity) {
                    case ErrorSeverity.DEBUG:
                        console.debug(logMessage);
                        break;
                    case ErrorSeverity.INFO:
                        console.info(logMessage);
                        break;
                    case ErrorSeverity.WARNING:
                        console.warn(logMessage);
                        break;
                    case ErrorSeverity.ERROR:
                    case ErrorSeverity.CRITICAL:
                        console.error(logMessage);
                        break;
                }
            }
            if (this.config.enableFileLog && this.config.logFilePath) {
                console.log(`Would log to file: ${this.config.logFilePath}`);
                console.log(logMessage);
            }
        }
        logSimpleError(error) {
            const timestamp = new Date(error.timestamp).toISOString();
            const logMessage = `[${timestamp}] [${this.getLogLevelString(error.severity)}] ${error.type}: ${error.message}`;
            if (this.config.enableConsoleLog) {
                switch (error.severity) {
                    case ErrorSeverity.DEBUG:
                        console.debug(logMessage, error.context);
                        break;
                    case ErrorSeverity.INFO:
                        console.info(logMessage, error.context);
                        break;
                    case ErrorSeverity.WARNING:
                        console.warn(logMessage, error.context);
                        break;
                    case ErrorSeverity.ERROR:
                    case ErrorSeverity.CRITICAL:
                        console.error(logMessage, error.context);
                        if (error.stack) {
                            console.error(error.stack);
                        }
                        break;
                }
            }
            if (this.config.enableFileLog && this.config.logFilePath) {
                console.log(`Would log to file: ${this.config.logFilePath}`);
                console.log(logMessage);
            }
        }
        getLogLevelString(severity) {
            switch (severity) {
                case ErrorSeverity.DEBUG:
                    return 'DEBUG';
                case ErrorSeverity.INFO:
                    return 'INFO';
                case ErrorSeverity.WARNING:
                    return 'WARNING';
                case ErrorSeverity.ERROR:
                    return 'ERROR';
                case ErrorSeverity.CRITICAL:
                    return 'CRITICAL';
                case ErrorSeverity.FATAL:
                    return 'FATAL';
                default:
                    return 'UNKNOWN';
            }
        }
        emitBySeverity(error) {
            switch (error.severity) {
                case ErrorSeverity.DEBUG:
                    this.emit('debug', error);
                    break;
                case ErrorSeverity.INFO:
                    this.emit('info', error);
                    break;
                case ErrorSeverity.WARNING:
                    this.emit('warning', error);
                    break;
                case ErrorSeverity.ERROR:
                    this.emit('error', error);
                    break;
                case ErrorSeverity.CRITICAL:
                    this.emit('critical', error);
                    break;
            }
        }
        getErrorStats() {
            const stats = {
                totalErrors: 0,
                errorsByType: {},
                errorsBySeverity: {},
                recentErrors: [],
                errorRates: {},
                recoveryStats: {
                    totalAttempts: 0,
                    successfulRecoveries: 0,
                    failedRecoveries: 0,
                    recoveryRate: 0
                },
                topErrorTypes: [],
                timeRange: {
                    start: 0,
                    end: Date.now()
                }
            };
            this.errorCounts.forEach(count => {
                stats.totalErrors += count;
            });
            this.errorCounts.forEach((count, type) => {
                stats.errorsByType[type] = count;
            });
            this.errorHistory.forEach(record => {
                const severity = record.severity;
                stats.errorsBySeverity[severity] = (stats.errorsBySeverity[severity] || 0) + 1;
            });
            const now = Date.now();
            const timeWindows = [60000, 300000, 900000, 3600000];
            timeWindows.forEach(window => {
                const windowStart = now - window;
                const errorsInWindow = this.errorHistory.filter(record => record.timestamp >= windowStart).length;
                stats.errorRates[`${window / 1000}s`] = errorsInWindow / (window / 1000);
            });
            const recoveryStats = this.recoveryManager.getRecoveryStats();
            stats.recoveryStats = {
                totalAttempts: recoveryStats.totalAttempts,
                successfulRecoveries: recoveryStats.successfulRecoveries,
                failedRecoveries: recoveryStats.failedRecoveries,
                recoveryRate: recoveryStats.successRate
            };
            const sortedErrorTypes = Object.entries(stats.errorsByType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);
            stats.topErrorTypes = sortedErrorTypes.map(([type, count]) => ({ type, count }));
            const recentCount = Math.min(10, this.errorHistory.length);
            stats.recentErrors = this.errorHistory.slice(-recentCount);
            if (this.errorHistory.length > 0) {
                stats.timeRange.start = this.errorHistory[0].timestamp;
            }
            return stats;
        }
        getErrorHistory(limit) {
            if (limit) {
                return this.errorHistory.slice(-limit);
            }
            return [...this.errorHistory];
        }
        getErrorTrends(timeWindow = 3600000) {
            const now = Date.now();
            const start = now - timeWindow;
            const interval = timeWindow / 12;
            const trends = [];
            for (let i = 0; i < 12; i++) {
                const intervalStart = start + (i * interval);
                const intervalEnd = intervalStart + interval;
                const errorsInInterval = this.errorHistory.filter(record => record.timestamp >= intervalStart && record.timestamp < intervalEnd);
                const errorsByType = {};
                const errorsBySeverity = {};
                errorsInInterval.forEach(record => {
                    errorsByType[record.type] = (errorsByType[record.type] || 0) + 1;
                    errorsBySeverity[record.severity] = (errorsBySeverity[record.severity] || 0) + 1;
                });
                trends.push({
                    timestamp: intervalStart,
                    count: errorsInInterval.length,
                    errorsByType,
                    errorsBySeverity
                });
            }
            return trends;
        }
        getErrorTypeStats(errorType) {
            const typeHistory = this.errorHistory.filter(record => record.type === errorType);
            const now = Date.now();
            return {
                type: errorType,
                totalCount: typeHistory.length,
                recentCount: typeHistory.filter(record => now - record.timestamp < 3600000).length,
                averageSeverity: typeHistory.length > 0
                    ? typeHistory.reduce((sum, record) => sum + this.getSeverityValue(record.severity), 0) / typeHistory.length
                    : 0,
                recoverableCount: typeHistory.filter(record => record.recoverable).length,
                lastOccurrence: typeHistory.length > 0 ? typeHistory[typeHistory.length - 1].timestamp : 0,
                firstOccurrence: typeHistory.length > 0 ? typeHistory[0].timestamp : 0
            };
        }
        resetStats() {
            this.errorHistory = [];
            this.errorCounts.clear();
            this.lastErrorTime.clear();
            this.recoveryAttempts.clear();
            this.lastRecoveryTime.clear();
            this.recoveryManager.clearRecoveryHistory();
            Object.values(ErrorType).forEach(errorType => {
                this.errorCounts.set(errorType, 0);
                this.lastErrorTime.set(errorType, 0);
            });
            this.emit('stats_reset');
        }
        getSeverityValue(severity) {
            switch (severity) {
                case ErrorSeverity.DEBUG: return 1;
                case ErrorSeverity.INFO: return 2;
                case ErrorSeverity.WARNING: return 3;
                case ErrorSeverity.ERROR: return 4;
                case ErrorSeverity.CRITICAL: return 5;
                case ErrorSeverity.FATAL: return 6;
                default: return 0;
            }
        }
        clearHistory() {
            this.errorHistory = [];
            this.errorCounts.clear();
            this.lastErrorTime.clear();
        }
    }
    exports.ErrorHandler = ErrorHandler;
    exports.globalErrorHandler = new ErrorHandler();
    class ErrorHandlerUtils {
        static safeExecute(fn, errorHandler = exports.globalErrorHandler, context = {}, defaultValue, operation) {
            try {
                return fn();
            }
            catch (error) {
                const errorContext = Object.assign(Object.assign({}, context), { operation: operation || 'safeExecute', executionType: 'sync' });
                errorHandler.handleError(error, errorContext);
                return defaultValue;
            }
        }
        static safeExecuteAsync(fn_1) {
            return __awaiter(this, arguments, void 0, function* (fn, errorHandler = exports.globalErrorHandler, context = {}, defaultValue, operation) {
                try {
                    return yield fn();
                }
                catch (error) {
                    const errorContext = Object.assign(Object.assign({}, context), { operation: operation || 'safeExecuteAsync', executionType: 'async' });
                    errorHandler.handleError(error, errorContext);
                    return defaultValue;
                }
            });
        }
        static safeExecuteWithRetry(fn_1) {
            return __awaiter(this, arguments, void 0, function* (fn, errorHandler = exports.globalErrorHandler, maxRetries = 3, delayMs = 1000, context = {}, operation, exponentialBackoff = true) {
                let lastError;
                for (let i = 0; i <= maxRetries; i++) {
                    try {
                        return yield fn();
                    }
                    catch (error) {
                        lastError = error;
                        if (i < maxRetries) {
                            const delay = exponentialBackoff ? delayMs * Math.pow(2, i) : delayMs;
                            yield new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                }
                const errorContext = Object.assign(Object.assign({}, context), { operation: operation || 'safeExecuteWithRetry', executionType: 'async', retryAttempts: maxRetries + 1, finalDelay: delayMs });
                errorHandler.handleError(lastError, errorContext);
                throw lastError;
            });
        }
        static safeExecuteWithTimeout(fn_1, timeoutMs_1) {
            return __awaiter(this, arguments, void 0, function* (fn, timeoutMs, errorHandler = exports.globalErrorHandler, context = {}, operation) {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`, Object.assign(Object.assign({}, context), { operation: operation || 'safeExecuteWithTimeout', timeoutMs })));
                    }, timeoutMs);
                });
                try {
                    return yield Promise.race([fn(), timeoutPromise]);
                }
                catch (error) {
                    const errorContext = Object.assign(Object.assign({}, context), { operation: operation || 'safeExecuteWithTimeout', timeoutMs, executionType: 'async' });
                    errorHandler.handleError(error, errorContext);
                    throw error;
                }
            });
        }
        static createErrorBoundary(fn, errorHandler = exports.globalErrorHandler, context = {}, operation) {
            return (...args) => {
                try {
                    return fn(...args);
                }
                catch (error) {
                    const errorContext = Object.assign(Object.assign({}, context), { operation: operation || 'errorBoundary', arguments: args, executionType: 'sync' });
                    errorHandler.handleError(error, errorContext);
                    throw error;
                }
            };
        }
        static createAsyncErrorBoundary(fn, errorHandler = exports.globalErrorHandler, context = {}, operation) {
            return (...args) => __awaiter(this, void 0, void 0, function* () {
                try {
                    return yield fn(...args);
                }
                catch (error) {
                    const errorContext = Object.assign(Object.assign({}, context), { operation: operation || 'asyncErrorBoundary', arguments: args, executionType: 'async' });
                    errorHandler.handleError(error, errorContext);
                    throw error;
                }
            });
        }
        static safeExecuteBatch(operations_1) {
            return __awaiter(this, arguments, void 0, function* (operations, errorHandler = exports.globalErrorHandler, context = {}, operation, concurrency = 3) {
                const results = [];
                const errors = [];
                const executeOperation = (op, index) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const result = yield op();
                        results[index] = result;
                    }
                    catch (error) {
                        errors[index] = error;
                        const errorContext = Object.assign(Object.assign({}, context), { operation: operation || 'safeExecuteBatch', batchIndex: index, executionType: 'async' });
                        errorHandler.handleError(error, errorContext);
                    }
                });
                const batches = [];
                for (let i = 0; i < operations.length; i += concurrency) {
                    const batch = operations.slice(i, i + concurrency);
                    batches.push(Promise.all(batch.map((op, j) => executeOperation(op, i + j))));
                }
                yield Promise.all(batches);
                return {
                    results: results.filter(r => r !== undefined),
                    errors: errors.filter(e => e !== undefined)
                };
            });
        }
    }
    exports.ErrorHandlerUtils = ErrorHandlerUtils;
    function isAppError(error) {
        return error instanceof AppError;
    }
    function isErrorType(error, type) {
        return isAppError(error) && error.type === type;
    }
    function withRetry(fn_1) {
        return __awaiter(this, arguments, void 0, function* (fn, maxRetries = 3, delayMs = 1000, context = {}) {
            let lastError;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return yield fn();
                }
                catch (error) {
                    lastError = error;
                    exports.globalErrorHandler.handleError(error, Object.assign(Object.assign({}, context), { attempt, maxRetries }));
                    if (attempt < maxRetries) {
                        yield new Promise(resolve => setTimeout(resolve, delayMs * attempt));
                    }
                }
            }
            throw lastError;
        });
    }
    class NetworkErrorRecoveryStrategy {
        constructor(options = {}) {
            this.options = Object.assign({ maxRetries: 3, baseDelay: 1000, maxDelay: 30000, backoffFactor: 2, jitter: true, enableExponentialBackoff: true }, options);
        }
        canRecover(error) {
            return [
                ErrorType.SOCKET_ERROR,
                ErrorType.CONNECTION_TIMEOUT,
                ErrorType.CONNECTION_REFUSED,
                ErrorType.NETWORK_UNREACHABLE,
                ErrorType.DNS_RESOLUTION_FAILED
            ].includes(error.type) && error.recoverable;
        }
        recover(error) {
            return __awaiter(this, void 0, void 0, function* () {
                const context = error.context;
                if (context.peer) {
                    return true;
                }
                if (context.component === 'DHT') {
                    return true;
                }
                return false;
            });
        }
        getDelay(attempt) {
            let delay = this.options.baseDelay || 1000;
            if (this.options.enableExponentialBackoff) {
                delay = delay * Math.pow(this.options.backoffFactor || 2, attempt - 1);
            }
            if (this.options.jitter) {
                delay = delay * (0.5 + Math.random() * 0.5);
            }
            return Math.min(delay, this.options.maxDelay || 30000);
        }
        getMaxAttempts() {
            return this.options.maxRetries || 3;
        }
    }
    exports.NetworkErrorRecoveryStrategy = NetworkErrorRecoveryStrategy;
    class TimeoutErrorRecoveryStrategy {
        constructor(options = {}) {
            this.options = Object.assign({ maxRetries: 2, baseDelay: 500, maxDelay: 10000, backoffFactor: 1.5, jitter: false, enableExponentialBackoff: true }, options);
        }
        canRecover(error) {
            return error.type === ErrorType.CONNECTION_TIMEOUT && error.recoverable;
        }
        recover(error) {
            return __awaiter(this, void 0, void 0, function* () {
                const context = error.context;
                if (context.operation) {
                    switch (context.operation) {
                        case 'metadata_fetch':
                            return true;
                        case 'peer_connection':
                            return true;
                        default:
                            return false;
                    }
                }
                return false;
            });
        }
        getDelay(attempt) {
            let delay = this.options.baseDelay || 500;
            if (this.options.enableExponentialBackoff) {
                delay = delay * Math.pow(this.options.backoffFactor || 1.5, attempt - 1);
            }
            return Math.min(delay, this.options.maxDelay || 10000);
        }
        getMaxAttempts() {
            return this.options.maxRetries || 2;
        }
    }
    exports.TimeoutErrorRecoveryStrategy = TimeoutErrorRecoveryStrategy;
    class ErrorRecoveryManager {
        constructor(defaultStrategy) {
            this.strategies = new Map();
            this.recoveryHistory = new Map();
            this.defaultStrategy = defaultStrategy || new NetworkErrorRecoveryStrategy();
            this.initializeDefaultStrategies();
        }
        initializeDefaultStrategies() {
            this.registerStrategy(ErrorType.SOCKET_ERROR, new NetworkErrorRecoveryStrategy());
            this.registerStrategy(ErrorType.CONNECTION_TIMEOUT, new TimeoutErrorRecoveryStrategy());
            this.registerStrategy(ErrorType.CONNECTION_REFUSED, new NetworkErrorRecoveryStrategy());
            this.registerStrategy(ErrorType.NETWORK_UNREACHABLE, new NetworkErrorRecoveryStrategy());
            this.registerStrategy(ErrorType.DNS_RESOLUTION_FAILED, new NetworkErrorRecoveryStrategy());
            this.registerStrategy(ErrorType.DHT_ERROR, new NetworkErrorRecoveryStrategy());
            this.registerStrategy(ErrorType.NODE_UNREACHABLE, new NetworkErrorRecoveryStrategy());
            this.registerStrategy(ErrorType.BOOTSTRAP_FAILED, new NetworkErrorRecoveryStrategy());
            this.registerStrategy(ErrorType.PROTOCOL_ERROR, new NetworkErrorRecoveryStrategy());
            this.registerStrategy(ErrorType.HANDSHAKE_FAILED, new NetworkErrorRecoveryStrategy());
        }
        registerStrategy(errorType, strategy) {
            if (!this.strategies.has(errorType)) {
                this.strategies.set(errorType, []);
            }
            this.strategies.get(errorType).push(strategy);
        }
        attemptRecovery(error) {
            return __awaiter(this, void 0, void 0, function* () {
                const startTime = Date.now();
                const errorKey = `${error.type}-${error.errorId}`;
                const strategies = this.strategies.get(error.type) || [this.defaultStrategy];
                for (const strategy of strategies) {
                    if (strategy.canRecover(error)) {
                        const maxAttempts = strategy.getMaxAttempts();
                        let totalDelay = 0;
                        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                            try {
                                const delay = attempt > 1 ? strategy.getDelay(attempt - 1) : 0;
                                totalDelay += delay;
                                if (delay > 0) {
                                    yield new Promise(resolve => setTimeout(resolve, delay));
                                }
                                const recovered = yield strategy.recover(error);
                                if (recovered) {
                                    const result = {
                                        success: true,
                                        attempts: attempt,
                                        totalDelay,
                                        recoveryTime: Date.now() - startTime
                                    };
                                    this.recordRecoveryHistory(errorKey, result);
                                    return result;
                                }
                            }
                            catch (recoveryError) {
                                console.warn(`Recovery attempt ${attempt} failed:`, recoveryError);
                            }
                        }
                    }
                }
                const result = {
                    success: false,
                    attempts: 0,
                    totalDelay: 0,
                    finalError: error,
                    recoveryTime: Date.now() - startTime
                };
                this.recordRecoveryHistory(errorKey, result);
                return result;
            });
        }
        recordRecoveryHistory(errorKey, result) {
            if (!this.recoveryHistory.has(errorKey)) {
                this.recoveryHistory.set(errorKey, []);
            }
            const history = this.recoveryHistory.get(errorKey);
            history.push(result);
            if (history.length > 10) {
                history.shift();
            }
        }
        getRecoveryStats() {
            let totalAttempts = 0;
            let successfulRecoveries = 0;
            let failedRecoveries = 0;
            let totalRecoveryTime = 0;
            for (const history of this.recoveryHistory.values()) {
                for (const result of history) {
                    totalAttempts++;
                    totalRecoveryTime += result.recoveryTime;
                    if (result.success) {
                        successfulRecoveries++;
                    }
                    else {
                        failedRecoveries++;
                    }
                }
            }
            const successRate = totalAttempts > 0 ? successfulRecoveries / totalAttempts : 0;
            const averageRecoveryTime = totalAttempts > 0 ? totalRecoveryTime / totalAttempts : 0;
            return {
                totalAttempts,
                successfulRecoveries,
                failedRecoveries,
                averageRecoveryTime,
                successRate
            };
        }
        clearRecoveryHistory() {
            this.recoveryHistory.clear();
        }
    }
    exports.ErrorRecoveryManager = ErrorRecoveryManager;
});
