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
        define(["require", "exports", "events", "./error-types"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ErrorRecoveryManager = exports.TimeoutErrorRecoveryStrategy = exports.NetworkErrorRecoveryStrategy = void 0;
    exports.withRetry = withRetry;
    const events_1 = require("events");
    const error_types_1 = require("./error-types");
    class NetworkErrorRecoveryStrategy {
        constructor(options = {}) {
            this.options = Object.assign({ maxRetries: 3, baseDelay: 1000, maxDelay: 30000, backoffFactor: 2, jitter: true, enableExponentialBackoff: true }, options);
        }
        canRecover(error) {
            return error.type === error_types_1.ErrorType.NETWORK && error.recoverable;
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
            return error.type === error_types_1.ErrorType.NETWORK && error.recoverable;
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
    class ErrorRecoveryManager extends events_1.EventEmitter {
        constructor(defaultStrategy) {
            super();
            this.strategies = new Map();
            this.recoveryHistory = new Map();
            this.defaultStrategy = defaultStrategy || new NetworkErrorRecoveryStrategy();
            this.initializeDefaultStrategies();
        }
        initializeDefaultStrategies() {
            this.registerStrategy(error_types_1.ErrorType.NETWORK, new NetworkErrorRecoveryStrategy());
            this.registerStrategy(error_types_1.ErrorType.NETWORK, new TimeoutErrorRecoveryStrategy());
            this.registerStrategy(error_types_1.ErrorType.DHT, new NetworkErrorRecoveryStrategy());
            this.registerStrategy(error_types_1.ErrorType.NETWORK, new NetworkErrorRecoveryStrategy());
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
                                    this.emit('recovery_success', { error, result });
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
                this.emit('recovery_failed', { error, result });
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
    function withRetry(fn_1) {
        return __awaiter(this, arguments, void 0, function* (fn, maxRetries = 3, delayMs = 1000, context = {}) {
            let lastError;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return yield fn();
                }
                catch (error) {
                    lastError = error;
                    console.warn(`Attempt ${attempt} failed:`, error);
                    if (attempt < maxRetries) {
                        yield new Promise(resolve => setTimeout(resolve, delayMs * attempt));
                    }
                }
            }
            throw lastError;
        });
    }
});
