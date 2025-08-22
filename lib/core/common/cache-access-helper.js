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
        define(["require", "exports", "../../types/error", "../../types/error"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CacheAccessHelperFactory = exports.CacheAccessHelper = void 0;
    const error_1 = require("../../types/error");
    const error_2 = require("../../types/error");
    class CacheAccessHelper {
        constructor(errorHandler, config) {
            this.errorHandler = errorHandler;
            this.config = config;
            this.stats = new Map();
            this.accessHistory = new Map();
            this.initializeStats();
        }
        initializeStats() {
            this.stats.set(this.config.cacheName, {
                hits: 0,
                misses: 0,
                totalRequests: 0,
                hitRate: 0,
                lastAccessTime: 0,
                compressionSavings: 0
            });
        }
        getWithRetry(cache, key, operation = 'cache_access') {
            return __awaiter(this, void 0, void 0, function* () {
                return this.executeWithRetry(() => __awaiter(this, void 0, void 0, function* () {
                    const value = cache.get(key);
                    this.recordAccess(key, value !== undefined);
                    return value;
                }), operation, { key, cacheName: this.config.cacheName });
            });
        }
        setWithRetry(cache, key, value, ttl, operation = 'cache_set') {
            return __awaiter(this, void 0, void 0, function* () {
                return this.executeWithRetry(() => __awaiter(this, void 0, void 0, function* () {
                    if (ttl) {
                        cache.set(key, value, { ttl });
                    }
                    else {
                        cache.set(key, value);
                    }
                    this.recordAccess(key, true);
                }), operation, { key, cacheName: this.config.cacheName });
            });
        }
        batchGet(cache, keys, operation = 'batch_cache_get') {
            return __awaiter(this, void 0, void 0, function* () {
                const results = new Map();
                for (const key of keys) {
                    try {
                        const value = yield this.getWithRetry(cache, key, operation);
                        if (value !== undefined) {
                            results.set(key, value);
                        }
                    }
                    catch (error) {
                        this.errorHandler.handleError(error, {
                            operation,
                            key,
                            cacheName: this.config.cacheName,
                            errorType: error_2.ErrorType.CACHE
                        });
                    }
                }
                return results;
            });
        }
        batchSet(cache, entries, operation = 'batch_cache_set') {
            return __awaiter(this, void 0, void 0, function* () {
                const promises = entries.map(({ key, value, ttl }) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.setWithRetry(cache, key, value, ttl, operation);
                    }
                    catch (error) {
                        this.errorHandler.handleError(error, {
                            operation,
                            key,
                            cacheName: this.config.cacheName,
                            errorType: error_2.ErrorType.CACHE
                        });
                    }
                }));
                yield Promise.all(promises);
            });
        }
        setWithCompression(cache, key, value, ttl) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!this.config.enableCompression) {
                    return this.setWithRetry(cache, key, value, ttl, 'cache_set_compression');
                }
                try {
                    const serialized = JSON.stringify(value);
                    const originalSize = Buffer.byteLength(serialized, 'utf8');
                    if (originalSize > (this.config.compressionThreshold || 1024)) {
                        yield this.setWithRetry(cache, key, value, ttl, 'cache_set_compression');
                    }
                    else {
                        yield this.setWithRetry(cache, key, value, ttl, 'cache_set_compression');
                    }
                }
                catch (error) {
                    this.errorHandler.handleError(error, {
                        operation: 'cache_set_compression',
                        key,
                        cacheName: this.config.cacheName,
                        errorType: error_2.ErrorType.CACHE
                    });
                }
            });
        }
        getStats() {
            return this.stats.get(this.config.cacheName) || {
                hits: 0,
                misses: 0,
                totalRequests: 0,
                hitRate: 0,
                lastAccessTime: 0,
                compressionSavings: 0
            };
        }
        getAccessHistory(limit = 100) {
            const history = this.accessHistory.get(this.config.cacheName) || [];
            return history.slice(-limit);
        }
        resetStats() {
            this.initializeStats();
            this.accessHistory.delete(this.config.cacheName);
        }
        recordAccess(key, hit) {
            const stats = this.stats.get(this.config.cacheName);
            stats.totalRequests++;
            stats.lastAccessTime = Date.now();
            if (hit) {
                stats.hits++;
            }
            else {
                stats.misses++;
            }
            stats.hitRate = stats.hits / stats.totalRequests;
            if (!this.accessHistory.has(this.config.cacheName)) {
                this.accessHistory.set(this.config.cacheName, []);
            }
            const history = this.accessHistory.get(this.config.cacheName);
            history.push({ key, hit, timestamp: Date.now() });
            if (history.length > 1000) {
                history.splice(0, history.length - 1000);
            }
            if (this.config.enableAccessLogging) {
                console.log(`[${this.config.cacheName}] Cache ${hit ? 'hit' : 'miss'}: ${key}`);
            }
        }
        executeWithRetry(fn, operation, context) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!this.config.enableRetry) {
                    return fn();
                }
                const maxRetries = this.config.maxRetries || 3;
                const retryDelay = this.config.retryDelay || 1000;
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        return yield fn();
                    }
                    catch (error) {
                        if (attempt === maxRetries) {
                            const cacheError = new error_1.CacheError(`Cache operation failed after ${maxRetries} attempts: ${operation}`, Object.assign({ operation }, context));
                            this.errorHandler.handleError(cacheError, Object.assign(Object.assign({ operation,
                                attempt }, context), { errorType: error_2.ErrorType.CACHE }));
                            throw cacheError;
                        }
                        yield new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
                    }
                }
                throw new Error('Unreachable code');
            });
        }
    }
    exports.CacheAccessHelper = CacheAccessHelper;
    class CacheAccessHelperFactory {
        static getHelper(errorHandler, config) {
            const key = `${config.cacheName}_${JSON.stringify(config)}`;
            if (!this.helpers.has(key)) {
                this.helpers.set(key, new CacheAccessHelper(errorHandler, config));
            }
            return this.helpers.get(key);
        }
        static cleanup() {
            this.helpers.clear();
        }
    }
    CacheAccessHelperFactory.helpers = new Map();
    exports.CacheAccessHelperFactory = CacheAccessHelperFactory;
});
