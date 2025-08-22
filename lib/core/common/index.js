(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./retry-manager", "./performance-monitor", "./memory-manager", "./config-validator"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createCommonModules = exports.CommonModulesFactory = exports.createConfigValidator = exports.ValidationRules = exports.ConfigValidator = exports.MemoryManager = exports.PerformanceMonitor = exports.RetryManager = void 0;
    var retry_manager_1 = require("./retry-manager");
    Object.defineProperty(exports, "RetryManager", { enumerable: true, get: function () { return retry_manager_1.RetryManager; } });
    var performance_monitor_1 = require("./performance-monitor");
    Object.defineProperty(exports, "PerformanceMonitor", { enumerable: true, get: function () { return performance_monitor_1.PerformanceMonitor; } });
    var memory_manager_1 = require("./memory-manager");
    Object.defineProperty(exports, "MemoryManager", { enumerable: true, get: function () { return memory_manager_1.MemoryManager; } });
    var config_validator_1 = require("./config-validator");
    Object.defineProperty(exports, "ConfigValidator", { enumerable: true, get: function () { return config_validator_1.ConfigValidator; } });
    Object.defineProperty(exports, "ValidationRules", { enumerable: true, get: function () { return config_validator_1.ValidationRules; } });
    Object.defineProperty(exports, "createConfigValidator", { enumerable: true, get: function () { return config_validator_1.createConfigValidator; } });
    class CommonModulesFactory {
        static createRetryManager(config) {
            return new (require('./retry-manager').RetryManager)(config);
        }
        static createPerformanceMonitor(config) {
            return new (require('./performance-monitor').PerformanceMonitor)(config);
        }
        static createMemoryManager(config) {
            return new (require('./memory-manager').MemoryManager)(config);
        }
        static createConfigValidator() {
            const { createConfigValidator } = require('./config-validator');
            return createConfigValidator();
        }
    }
    exports.CommonModulesFactory = CommonModulesFactory;
    function createCommonModules(config) {
        const { createConfigValidator } = require('./config-validator');
        return {
            retryManager: CommonModulesFactory.createRetryManager(config === null || config === void 0 ? void 0 : config.retry),
            performanceMonitor: CommonModulesFactory.createPerformanceMonitor(config === null || config === void 0 ? void 0 : config.performance),
            memoryManager: CommonModulesFactory.createMemoryManager(config === null || config === void 0 ? void 0 : config.memory),
            configValidator: createConfigValidator()
        };
    }
    exports.createCommonModules = createCommonModules;
});
