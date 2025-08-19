(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "../types/error"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.globalErrorHandler = exports.ErrorHandlerImpl = void 0;
    const events_1 = require("events");
    const error_1 = require("../types/error");
    class ErrorHandlerImpl extends events_1.EventEmitter {
        constructor() {
            super();
            this.errorHistory = [];
            this.errorCounts = new Map();
            this.lastErrorTime = new Map();
            this.handlers = new Map();
            Object.values(error_1.ErrorType).forEach(errorType => {
                this.errorCounts.set(errorType, 0);
                this.lastErrorTime.set(errorType, 0);
            });
        }
        handleError(error, context = {}) {
            const appError = this.normalizeError(error, context);
            this.addToHistory(appError);
            this.updateErrorCounts(appError);
            this.lastErrorTime.set(appError.type, Date.now());
            const handler = this.handlers.get(appError.type);
            if (handler) {
                handler(appError);
            }
            this.emit('error', appError);
            this.emitBySeverity(appError);
            this.logError(appError);
        }
        registerHandler(type, handler) {
            this.handlers.set(type, handler);
        }
        unregisterHandler(type) {
            this.handlers.delete(type);
        }
        getErrorStats() {
            const errorsByType = {};
            const errorsBySeverity = {};
            Object.values(error_1.ErrorType).forEach(type => {
                errorsByType[type] = this.errorCounts.get(type) || 0;
            });
            Object.values(error_1.ErrorSeverity).forEach(severity => {
                errorsBySeverity[severity] = 0;
            });
            this.errorHistory.forEach(error => {
                errorsBySeverity[error.severity]++;
            });
            return {
                totalErrors: this.errorHistory.length,
                errorsByType,
                errorsBySeverity
            };
        }
        normalizeError(error, context) {
            if ((0, error_1.isAppError)(error)) {
                return new error_1.AppError(error.message, error.type, error.severity, Object.assign(Object.assign({}, error.context), context), error.recoverable, error.recoveryStrategy);
            }
            else {
                return new error_1.AppError(error.message, error_1.ErrorType.UNKNOWN, error_1.ErrorSeverity.MEDIUM, Object.assign({ component: 'Unknown' }, context), false);
            }
        }
        addToHistory(error) {
            this.errorHistory.push(error);
            if (this.errorHistory.length > 1000) {
                this.errorHistory = this.errorHistory.slice(-1000);
            }
        }
        updateErrorCounts(error) {
            const currentCount = this.errorCounts.get(error.type) || 0;
            this.errorCounts.set(error.type, currentCount + 1);
        }
        emitBySeverity(error) {
            this.emit(error.severity.toLowerCase(), error);
        }
        logError(error) {
            const timestamp = new Date(error.timestamp).toISOString();
            const logMessage = `[${timestamp}] [${error.type}] [${error.severity}] ${error.message} (ID: ${error.errorId})`;
            switch (error.severity) {
                case error_1.ErrorSeverity.DEBUG:
                    console.debug(logMessage);
                    break;
                case error_1.ErrorSeverity.INFO:
                    console.info(logMessage);
                    break;
                case error_1.ErrorSeverity.WARNING:
                case error_1.ErrorSeverity.LOW:
                case error_1.ErrorSeverity.MEDIUM:
                    console.warn(logMessage);
                    break;
                case error_1.ErrorSeverity.HIGH:
                case error_1.ErrorSeverity.ERROR:
                case error_1.ErrorSeverity.CRITICAL:
                case error_1.ErrorSeverity.FATAL:
                    console.error(logMessage);
                    break;
            }
            if (error.stack) {
                console.error(error.stack);
            }
        }
    }
    exports.ErrorHandlerImpl = ErrorHandlerImpl;
    exports.globalErrorHandler = new ErrorHandlerImpl();
});
