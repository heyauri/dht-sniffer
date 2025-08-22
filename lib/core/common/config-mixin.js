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
    exports.peerConfigValidationRules = exports.dhtConfigValidationRules = exports.cacheConfigValidationRules = exports.withConfigValidation = void 0;
    function withConfigValidation(Base) {
        return class extends Base {
            getConfigDefaults() {
                return {
                    enableErrorHandling: true,
                    enableMemoryMonitoring: true,
                    cleanupInterval: 5 * 60 * 1000,
                    memoryThreshold: 100 * 1024 * 1024,
                    enableRetry: true,
                    enablePerformanceMonitoring: true
                };
            }
            mergeWithDefaults(config) {
                const defaults = this.getConfigDefaults();
                return Object.assign(Object.assign({}, defaults), config);
            }
            validateConfig(config) {
                if (!config) {
                    throw new Error('Config is required');
                }
                if (config.cleanupInterval !== undefined && (typeof config.cleanupInterval !== 'number' || config.cleanupInterval <= 0)) {
                    throw new Error('cleanupInterval must be a positive number');
                }
                if (config.memoryThreshold !== undefined && (typeof config.memoryThreshold !== 'number' || config.memoryThreshold <= 0)) {
                    throw new Error('memoryThreshold must be a positive number');
                }
            }
        };
    }
    exports.withConfigValidation = withConfigValidation;
    exports.cacheConfigValidationRules = [
        {
            field: 'fetchedTupleSize',
            type: 'number',
            required: false,
            min: 1,
            max: 100000
        },
        {
            field: 'fetchedInfoHashSize',
            type: 'number',
            required: false,
            min: 1,
            max: 100000
        },
        {
            field: 'findNodeCacheSize',
            type: 'number',
            required: false,
            min: 1,
            max: 100000
        },
        {
            field: 'latestCalledPeersSize',
            type: 'number',
            required: false,
            min: 1,
            max: 10000
        },
        {
            field: 'usefulPeersSize',
            type: 'number',
            required: false,
            min: 1,
            max: 10000
        },
        {
            field: 'metadataFetchingCacheSize',
            type: 'number',
            required: false,
            min: 1,
            max: 10000
        }
    ];
    exports.dhtConfigValidationRules = [
        {
            field: 'maxTables',
            type: 'number',
            required: false,
            min: 1,
            max: 10000
        },
        {
            field: 'maxValues',
            type: 'number',
            required: false,
            min: 1,
            max: 100000
        },
        {
            field: 'maxPeers',
            type: 'number',
            required: false,
            min: 1,
            max: 100000
        }
    ];
    exports.peerConfigValidationRules = [
        {
            field: 'maxNodes',
            type: 'number',
            required: false,
            min: 1,
            max: 10000
        },
        {
            field: 'nodeRefreshTime',
            type: 'number',
            required: false,
            min: 1000,
            max: 3600000
        },
        {
            field: 'findNodeProbability',
            type: 'number',
            required: false,
            min: 0,
            max: 1
        }
    ];
});
