(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../../errors/error-handler", "../../types/error"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ErrorHandlingDecorator = exports.withErrorHandling = void 0;
    const error_handler_1 = require("../../errors/error-handler");
    const error_1 = require("../../types/error");
    function withErrorHandling(Base) {
        return class extends Base {
            constructor(...args) {
                super(...args);
                this.errorHistory = [];
                this.errorCounts = new Map();
                this.severityCounts = new Map();
                this.errorTimestamps = [];
                this.errorThreshold = 10;
                this.errorThresholdWindow = 60000;
                this.errorHandler = args.find(arg => arg instanceof error_handler_1.ErrorHandlerImpl) || new error_handler_1.ErrorHandlerImpl();
                this.errorConfig = args.find(arg => arg && typeof arg === 'object' && arg.enableErrorHandling !== undefined) || {};
                this.managerName = this.constructor.name;
                this.initializeErrorHandling();
            }
            initializeErrorHandling() {
                Object.values(error_1.ErrorType).forEach(type => {
                    this.errorCounts.set(type, 0);
                });
                Object.values(error_1.ErrorSeverity).forEach(severity => {
                    this.severityCounts.set(severity, 0);
                });
                if (this.errorConfig.errorThreshold) {
                    this.errorThreshold = this.errorConfig.errorThreshold;
                }
                if (this.errorConfig.errorThresholdWindow) {
                    this.errorThresholdWindow = this.errorConfig.errorThresholdWindow;
                }
            }
            handleError(operation, error, context, errorType = error_1.ErrorType.SYSTEM) {
                if (!this.errorConfig.enableErrorHandling) {
                    return;
                }
                const processedError = this.normalizeError(error, errorType);
                const errorContext = Object.assign({ manager: this.managerName, operation }, context);
                this.recordError(processedError, operation, errorType);
                this.checkErrorThreshold();
                this.errorHandler.handleError(processedError, errorContext);
                if (this.errorConfig.enableErrorLogging) {
                    this.logError(processedError, operation, errorContext);
                }
                if (this.errorConfig.enableErrorRecovery) {
                    this.attemptErrorRecovery(processedError, operation, errorContext);
                }
            }
            handleWarning(operation, warning, context) {
                const warningError = new Error(warning);
                this.handleError(operation, warningError, context, error_1.ErrorType.VALIDATION);
            }
            handleCriticalError(operation, error, context) {
                this.handleError(operation, error, context, error_1.ErrorType.SYSTEM);
                console.error(`[${this.managerName}] CRITICAL ERROR in ${operation}:`, error);
                if (typeof this.emit === 'function') {
                    this.emit('criticalError', {
                        manager: this.managerName,
                        operation,
                        error,
                        context,
                        timestamp: Date.now()
                    });
                }
            }
            getErrorStats() {
                const now = Date.now();
                const windowStart = now - this.errorThresholdWindow;
                const errorsByType = {};
                this.errorCounts.forEach((value, key) => {
                    errorsByType[key] = value;
                });
                const errorsBySeverity = {};
                this.severityCounts.forEach((value, key) => {
                    errorsBySeverity[key] = value;
                });
                return {
                    totalErrors: this.errorHistory.length,
                    errorsByType,
                    errorsBySeverity,
                    recentErrors: this.errorHistory
                        .filter(e => e.timestamp > windowStart)
                        .map(e => ({
                        error: e.error,
                        timestamp: e.timestamp,
                        operation: e.operation
                    }))
                };
            }
            clearErrorHistory() {
                this.errorHistory = [];
                this.errorTimestamps = [];
                Object.values(error_1.ErrorType).forEach(type => {
                    this.errorCounts.set(type, 0);
                });
                Object.values(error_1.ErrorSeverity).forEach(severity => {
                    this.severityCounts.set(severity, 0);
                });
            }
            setErrorThreshold(threshold, window) {
                this.errorThreshold = threshold;
                this.errorThresholdWindow = window;
            }
            normalizeError(error, _errorType) {
                if (error instanceof Error) {
                    return error;
                }
                if (typeof error === 'string') {
                    return new Error(error);
                }
                if (error && typeof error === 'object') {
                    return new Error(JSON.stringify(error));
                }
                return new Error(String(error));
            }
            recordError(error, operation, errorType) {
                const timestamp = Date.now();
                const severity = this.determineSeverity(errorType);
                this.errorHistory.push({
                    error,
                    timestamp,
                    operation,
                    type: errorType,
                    severity
                });
                const maxHistory = this.errorConfig.maxErrorHistory || 1000;
                if (this.errorHistory.length > maxHistory) {
                    this.errorHistory.splice(0, this.errorHistory.length - maxHistory);
                }
                this.errorCounts.set(errorType, (this.errorCounts.get(errorType) || 0) + 1);
                this.severityCounts.set(severity, (this.severityCounts.get(severity) || 0) + 1);
                this.errorTimestamps.push(timestamp);
                const windowStart = timestamp - this.errorThresholdWindow;
                this.errorTimestamps = this.errorTimestamps.filter(t => t > windowStart);
            }
            determineSeverity(errorType) {
                switch (errorType) {
                    case error_1.ErrorType.NETWORK:
                    case error_1.ErrorType.SYSTEM:
                        return error_1.ErrorSeverity.MEDIUM;
                    case error_1.ErrorType.VALIDATION:
                    default:
                        return error_1.ErrorSeverity.LOW;
                }
            }
            checkErrorThreshold() {
                if (this.errorTimestamps.length >= this.errorThreshold) {
                    const errorRate = this.errorTimestamps.length / (this.errorThresholdWindow / 1000);
                    console.warn(`[${this.managerName}] Error threshold exceeded: ${this.errorTimestamps.length} errors in ${this.errorThresholdWindow}ms (rate: ${errorRate.toFixed(2)} errors/sec)`);
                    if (typeof this.emit === 'function') {
                        this.emit('errorThresholdExceeded', {
                            manager: this.managerName,
                            threshold: this.errorThreshold,
                            window: this.errorThresholdWindow,
                            actualCount: this.errorTimestamps.length,
                            errorRate,
                            timestamp: Date.now()
                        });
                    }
                }
            }
            logError(error, operation, context) {
                const logMessage = `[${this.managerName}] Error in ${operation}: ${error.message}`;
                if (context) {
                    console.error(logMessage, '\nContext:', context, '\nStack:', error.stack);
                }
                else {
                    console.error(logMessage, '\nStack:', error.stack);
                }
            }
            attemptErrorRecovery(error, operation, _context) {
                if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
                    console.log(`[${this.managerName}] Attempting automatic recovery for ${operation}...`);
                }
            }
        };
    }
    exports.withErrorHandling = withErrorHandling;
    class ErrorHandlingDecorator {
        static create(errorHandler, operation, _errorType = error_1.ErrorType.SYSTEM, context) {
            return function (_target, propertyKey, descriptor) {
                const originalMethod = descriptor.value;
                descriptor.value = function (...args) {
                    try {
                        return originalMethod.apply(this, args);
                    }
                    catch (error) {
                        if (errorHandler && typeof errorHandler.handleError === 'function') {
                            errorHandler.handleError(error, Object.assign({ operation, method: propertyKey, args }, context));
                        }
                        throw error;
                    }
                };
                return descriptor;
            };
        }
    }
    exports.ErrorHandlingDecorator = ErrorHandlingDecorator;
});
