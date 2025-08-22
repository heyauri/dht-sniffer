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
    exports.ValidationRules = exports.ConfigValidator = exports.ConfigValidationError = void 0;
    exports.createConfigValidator = createConfigValidator;
    class ConfigValidationError extends Error {
        constructor(message, field, value, expected) {
            super(message);
            this.field = field;
            this.value = value;
            this.expected = expected;
            this.name = 'ConfigValidationError';
        }
    }
    exports.ConfigValidationError = ConfigValidationError;
    class ConfigValidator {
        constructor() {
            this.rules = new Map();
            this.errors = [];
        }
        addRule(configType, rule) {
            if (!this.rules.has(configType)) {
                this.rules.set(configType, []);
            }
            this.rules.get(configType).push(rule);
        }
        addRules(configType, rules) {
            if (!this.rules.has(configType)) {
                this.rules.set(configType, []);
            }
            this.rules.get(configType).push(...rules);
        }
        validate(configType, config) {
            this.errors = [];
            const rules = this.rules.get(configType);
            if (!rules) {
                return true;
            }
            for (const rule of rules) {
                this.validateRule(config, rule);
            }
            return this.errors.length === 0;
        }
        validateRule(config, rule) {
            const value = config[rule.field];
            if (rule.required && (value === undefined || value === null)) {
                this.errors.push(new ConfigValidationError(rule.message || `Field '${rule.field}' is required`, rule.field, value, 'required'));
                return;
            }
            if (!rule.required && (value === undefined || value === null)) {
                return;
            }
            if (rule.type && !this.validateType(value, rule.type)) {
                this.errors.push(new ConfigValidationError(rule.message || `Field '${rule.field}' must be of type ${rule.type}`, rule.field, value, rule.type));
                return;
            }
            if (rule.type === 'number') {
                if (rule.min !== undefined && value < rule.min) {
                    this.errors.push(new ConfigValidationError(rule.message || `Field '${rule.field}' must be at least ${rule.min}`, rule.field, value, `>= ${rule.min}`));
                }
                if (rule.max !== undefined && value > rule.max) {
                    this.errors.push(new ConfigValidationError(rule.message || `Field '${rule.field}' must be at most ${rule.max}`, rule.field, value, `<= ${rule.max}`));
                }
            }
            if (rule.type === 'string') {
                if (rule.minLength !== undefined && value.length < rule.minLength) {
                    this.errors.push(new ConfigValidationError(rule.message || `Field '${rule.field}' must be at least ${rule.minLength} characters long`, rule.field, value, `length >= ${rule.minLength}`));
                }
                if (rule.maxLength !== undefined && value.length > rule.maxLength) {
                    this.errors.push(new ConfigValidationError(rule.message || `Field '${rule.field}' must be at most ${rule.maxLength} characters long`, rule.field, value, `length <= ${rule.maxLength}`));
                }
            }
            if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
                this.errors.push(new ConfigValidationError(rule.message || `Field '${rule.field}' does not match required pattern`, rule.field, value, rule.pattern.toString()));
            }
            if (rule.enum && !rule.enum.includes(value)) {
                this.errors.push(new ConfigValidationError(rule.message || `Field '${rule.field}' must be one of: ${rule.enum.join(', ')}`, rule.field, value, `one of [${rule.enum.join(', ')}]`));
            }
            if (rule.custom) {
                const customResult = rule.custom(value);
                if (customResult !== true) {
                    const message = typeof customResult === 'string' ? customResult :
                        rule.message || `Field '${rule.field}' failed custom validation`;
                    this.errors.push(new ConfigValidationError(message, rule.field, value, 'custom validation'));
                }
            }
        }
        validateType(value, type) {
            switch (type) {
                case 'string':
                    return typeof value === 'string';
                case 'number':
                    return typeof value === 'number' && !isNaN(value);
                case 'boolean':
                    return typeof value === 'boolean';
                case 'object':
                    return typeof value === 'object' && value !== null && !Array.isArray(value);
                case 'array':
                    return Array.isArray(value);
                default:
                    return true;
            }
        }
        getErrors() {
            return [...this.errors];
        }
        getFirstError() {
            return this.errors.length > 0 ? this.errors[0] : null;
        }
        clearErrors() {
            this.errors = [];
        }
        removeRules(configType) {
            this.rules.delete(configType);
        }
        getConfigTypes() {
            return Array.from(this.rules.keys());
        }
        validateOrThrow(configType, config) {
            if (!this.validate(configType, config)) {
                const firstError = this.getFirstError();
                if (firstError) {
                    throw firstError;
                }
            }
        }
    }
    exports.ConfigValidator = ConfigValidator;
    class ValidationRules {
        static getDHTManagerRules() {
            return [
                {
                    field: 'port',
                    type: 'number',
                    min: 1,
                    max: 65535,
                    required: true,
                    message: 'Port must be between 1 and 65535'
                },
                {
                    field: 'maxNodes',
                    type: 'number',
                    min: 1,
                    required: true,
                    message: 'maxNodes must be greater than 0'
                },
                {
                    field: 'refreshInterval',
                    type: 'number',
                    min: 1000,
                    message: 'refreshInterval must be at least 1000ms'
                }
            ];
        }
        static getMetadataManagerRules() {
            return [
                {
                    field: 'maximumParallelFetchingTorrent',
                    type: 'number',
                    min: 1,
                    required: true,
                    message: 'maximumParallelFetchingTorrent must be greater than 0'
                },
                {
                    field: 'maximumWaitingQueueSize',
                    type: 'number',
                    min: -1,
                    message: 'maximumWaitingQueueSize must be -1 (unlimited) or greater'
                },
                {
                    field: 'downloadMaxTime',
                    type: 'number',
                    min: 1000,
                    message: 'downloadMaxTime must be at least 1000ms'
                },
                {
                    field: 'aggressiveLevel',
                    type: 'number',
                    min: 0,
                    max: 2,
                    message: 'aggressiveLevel must be between 0 and 2'
                },
                {
                    field: 'maxRetries',
                    type: 'number',
                    min: 0,
                    message: 'maxRetries must be greater than or equal to 0'
                },
                {
                    field: 'retryDelay',
                    type: 'number',
                    min: 0,
                    message: 'retryDelay must be greater than or equal to 0'
                }
            ];
        }
        static getCacheManagerRules() {
            return [
                {
                    field: 'maxCacheSize',
                    type: 'number',
                    min: 1,
                    required: true,
                    message: 'maxCacheSize must be greater than 0'
                },
                {
                    field: 'cacheTTL',
                    type: 'number',
                    min: 0,
                    message: 'cacheTTL must be greater than or equal to 0'
                },
                {
                    field: 'enableCompression',
                    type: 'boolean',
                    message: 'enableCompression must be a boolean'
                }
            ];
        }
        static getBaseManagerRules() {
            return [
                {
                    field: 'enableErrorHandling',
                    type: 'boolean',
                    message: 'enableErrorHandling must be a boolean'
                },
                {
                    field: 'enableMemoryMonitoring',
                    type: 'boolean',
                    message: 'enableMemoryMonitoring must be a boolean'
                },
                {
                    field: 'cleanupInterval',
                    type: 'number',
                    min: 1,
                    message: 'cleanupInterval must be a positive number'
                },
                {
                    field: 'memoryThreshold',
                    type: 'number',
                    min: 1,
                    message: 'memoryThreshold must be a positive number'
                }
            ];
        }
    }
    exports.ValidationRules = ValidationRules;
    function createConfigValidator() {
        const validator = new ConfigValidator();
        validator.addRules('DHTManager', ValidationRules.getDHTManagerRules());
        validator.addRules('MetadataManager', ValidationRules.getMetadataManagerRules());
        validator.addRules('CacheManager', ValidationRules.getCacheManagerRules());
        validator.addRules('BaseManager', ValidationRules.getBaseManagerRules());
        return validator;
    }
});
