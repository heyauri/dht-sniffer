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
        define(["require", "exports", "events", "../../types/error"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RetryManager = void 0;
    const events_1 = require("events");
    const error_1 = require("../../types/error");
    class RetryManager extends events_1.EventEmitter {
        constructor(config = {}) {
            super();
            this.config = Object.assign({ enableRetry: true, maxRetries: 3, retryDelay: 1000, retryBackoffFactor: 2, requestTimeout: 30000 }, config);
            this.retryCount = {};
            this.stats = {
                totalAttempts: 0,
                successfulAttempts: 0,
                failedAttempts: 0,
                currentRetryCount: {}
            };
        }
        executeWithRetry(operation, operationKey, context) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!this.config.enableRetry) {
                    return operation();
                }
                let lastError;
                let attempt = 0;
                const maxAttempts = this.config.maxRetries + 1;
                if (!this.retryCount[operationKey]) {
                    this.retryCount[operationKey] = 0;
                }
                while (attempt < maxAttempts) {
                    try {
                        this.stats.totalAttempts++;
                        const result = yield Promise.race([
                            operation(),
                            new Promise((_, reject) => setTimeout(() => reject(new error_1.TimeoutError('Operation timeout')), this.config.requestTimeout))
                        ]);
                        this.stats.successfulAttempts++;
                        return result;
                    }
                    catch (error) {
                        lastError = error;
                        attempt++;
                        this.retryCount[operationKey]++;
                        this.stats.failedAttempts++;
                        if (attempt >= maxAttempts) {
                            break;
                        }
                        const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffFactor, attempt - 1);
                        const retryEvent = {
                            operation: operationKey,
                            attempt,
                            maxAttempts,
                            delay,
                            error: lastError.message,
                            context
                        };
                        this.emit('retry', retryEvent);
                        yield new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                throw lastError;
            });
        }
        resetRetryCount(operationKey) {
            delete this.retryCount[operationKey];
        }
        cleanupExpiredRetries(maxAge = 3600000) {
            const now = Date.now();
            Object.keys(this.retryCount).forEach(key => {
                if (now - this.getOperationStartTime(key) > maxAge) {
                    delete this.retryCount[key];
                }
            });
        }
        getRetryStats() {
            return Object.assign(Object.assign({}, this.stats), { currentRetryCount: Object.assign({}, this.retryCount) });
        }
        getOperationStartTime(operationKey) {
            return Date.now() - (this.retryCount[operationKey] * this.config.retryDelay);
        }
        updateConfig(newConfig) {
            this.config = Object.assign(Object.assign({}, this.config), newConfig);
        }
        clearAllRetryCounts() {
            this.retryCount = {};
        }
        destroy() {
            this.clearAllRetryCounts();
            this.removeAllListeners();
        }
    }
    exports.RetryManager = RetryManager;
});
