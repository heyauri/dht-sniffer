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
        define(["require", "exports", "../types/error"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ErrorAggregator = exports.ErrorFormatter = exports.ErrorHandlerUtils = void 0;
    const error_1 = require("../types/error");
    class ErrorHandlerUtils {
        static safeExecute(fn, errorHandler, context = {}, defaultValue, operation) {
            try {
                return fn();
            }
            catch (error) {
                const errorContext = Object.assign(Object.assign({}, context), { operation: operation || 'safeExecute', executionType: 'sync' });
                errorHandler.handleError(error, errorContext);
                return defaultValue;
            }
        }
        static safeExecuteAsync(fn_1, errorHandler_1) {
            return __awaiter(this, arguments, void 0, function* (fn, errorHandler, context = {}, defaultValue, operation) {
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
        static safeExecuteWithRetry(fn_1, errorHandler_1) {
            return __awaiter(this, arguments, void 0, function* (fn, errorHandler, maxRetries = 3, delayMs = 1000, context = {}, operation, exponentialBackoff = true) {
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
        static safeExecuteWithTimeout(fn_1, timeoutMs_1, errorHandler_1) {
            return __awaiter(this, arguments, void 0, function* (fn, timeoutMs, errorHandler, context = {}, operation) {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new error_1.TimeoutError(`Operation timed out after ${timeoutMs}ms`, Object.assign(Object.assign({}, context), { operation: operation || 'safeExecuteWithTimeout', timeoutMs })));
                    }, timeoutMs);
                });
                try {
                    return yield Promise.race([fn(), timeoutPromise]);
                }
                catch (error) {
                    const errorContext = Object.assign(Object.assign({}, context), { operation: operation || 'safeExecuteWithTimeout', timeoutMs, executionType: 'async', timestamp: Date.now(), component: context.component || 'ErrorUtils' });
                    errorHandler.handleError(error, errorContext);
                    throw error;
                }
            });
        }
        static createErrorBoundary(fn, errorHandler, context = {}, operation) {
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
        static createAsyncErrorBoundary(fn, errorHandler, context = {}, operation) {
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
        static safeExecuteBatch(operations_1, errorHandler_1) {
            return __awaiter(this, arguments, void 0, function* (operations, errorHandler, context = {}, operation, concurrency = 3) {
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
    class ErrorFormatter {
        static formatError(error) {
            if ((0, error_1.isAppError)(error)) {
                return `[${error.type}] ${error.message} (Severity: ${error.severity}, ID: ${error.errorId})`;
            }
            return `${error.name}: ${error.message}`;
        }
        static formatErrorToJson(error) {
            if ((0, error_1.isAppError)(error)) {
                return error.toJSON();
            }
            return {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }
        static formatLogEntry(error, includeStack = true) {
            const timestamp = new Date().toISOString();
            if ((0, error_1.isAppError)(error)) {
                const entry = {
                    timestamp,
                    level: ErrorFormatter.getSeverityString(error.severity),
                    errorType: error.type,
                    errorMessage: error.message,
                    errorId: error.errorId,
                    severity: error.severity,
                    recoverable: error.recoverable,
                    context: error.context
                };
                if (includeStack && error.stack) {
                    entry.stack = error.stack;
                }
                return entry;
            }
            const entry = {
                timestamp,
                level: 'ERROR',
                errorMessage: error.message,
                errorName: error.name
            };
            if (includeStack && error.stack) {
                entry.stack = error.stack;
            }
            return entry;
        }
        static getSeverityString(severity) {
            switch (severity) {
                case error_1.ErrorSeverity.DEBUG: return 'DEBUG';
                case error_1.ErrorSeverity.INFO: return 'INFO';
                case error_1.ErrorSeverity.WARNING: return 'WARNING';
                case error_1.ErrorSeverity.ERROR: return 'ERROR';
                case error_1.ErrorSeverity.CRITICAL: return 'CRITICAL';
                case error_1.ErrorSeverity.FATAL: return 'FATAL';
                default: return 'UNKNOWN';
            }
        }
    }
    exports.ErrorFormatter = ErrorFormatter;
    class ErrorAggregator {
        constructor(maxErrorsPerType = 100) {
            this.errors = new Map();
            this.maxErrorsPerType = maxErrorsPerType;
        }
        addError(error) {
            const errorType = error.type;
            if (!this.errors.has(errorType)) {
                this.errors.set(errorType, []);
            }
            const errorList = this.errors.get(errorType);
            errorList.push(error);
            if (errorList.length > this.maxErrorsPerType) {
                errorList.shift();
            }
        }
        getStats() {
            const stats = {
                totalErrors: 0,
                errorsByType: {},
                recentErrors: []
            };
            for (const [type, errors] of this.errors) {
                stats.totalErrors += errors.length;
                stats.errorsByType[type] = errors.length;
                const recentOfType = errors.slice(-5);
                stats.recentErrors.push(...recentOfType);
            }
            stats.recentErrors.sort((a, b) => b.timestamp - a.timestamp);
            stats.recentErrors = stats.recentErrors.slice(0, 20);
            return stats;
        }
        clearErrors(errorType) {
            if (errorType) {
                this.errors.delete(errorType);
            }
            else {
                this.errors.clear();
            }
        }
        getErrorsByType(errorType) {
            return this.errors.get(errorType) || [];
        }
    }
    exports.ErrorAggregator = ErrorAggregator;
});
