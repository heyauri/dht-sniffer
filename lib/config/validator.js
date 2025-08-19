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
    exports.globalConfigValidator = exports.ConfigValidatorManager = exports.MetadataConfigValidator = exports.CacheConfigValidator = exports.DHTConfigValidator = exports.BaseValidator = void 0;
    const error_1 = require("../types/error");
    class BaseValidator {
        validateNumber(value, min, max, field, required = true) {
            if (value === undefined) {
                if (required) {
                    throw new error_1.ValidationError(`${field} is required`, { field, value });
                }
                return;
            }
            if (typeof value !== 'number' || isNaN(value)) {
                throw new error_1.ValidationError(`${field} must be a number`, { field, value });
            }
            if (value < min || value > max) {
                throw new error_1.ValidationError(`${field} must be between ${min} and ${max}`, { field, value });
            }
        }
        validateString(value, field, required = true, minLength = 0, maxLength = Infinity) {
            if (value === undefined) {
                if (required) {
                    throw new error_1.ValidationError(`${field} is required`, { field, value });
                }
                return;
            }
            if (typeof value !== 'string') {
                throw new error_1.ValidationError(`${field} must be a string`, { field, value });
            }
            if (required && value.trim() === '') {
                throw new error_1.ValidationError(`${field} cannot be empty`, { field, value });
            }
            if (value.length < minLength || value.length > maxLength) {
                throw new error_1.ValidationError(`${field} length must be between ${minLength} and ${maxLength}`, {
                    field,
                    value,
                    length: value.length
                });
            }
        }
        validateBoolean(value, field, required = true) {
            if (value === undefined) {
                if (required) {
                    throw new error_1.ValidationError(`${field} is required`, { field, value });
                }
                return;
            }
            if (typeof value !== 'boolean') {
                throw new error_1.ValidationError(`${field} must be a boolean`, { field, value });
            }
        }
        validateArray(value, field, required = true, minLength = 0, maxLength = Infinity) {
            if (value === undefined) {
                if (required) {
                    throw new error_1.ValidationError(`${field} is required`, { field, value });
                }
                return;
            }
            if (!Array.isArray(value)) {
                throw new error_1.ValidationError(`${field} must be an array`, { field, value });
            }
            if (value.length < minLength || value.length > maxLength) {
                throw new error_1.ValidationError(`${field} length must be between ${minLength} and ${maxLength}`, {
                    field,
                    value,
                    length: value.length
                });
            }
        }
        validateObject(value, field, required = true) {
            if (value === undefined) {
                if (required) {
                    throw new error_1.ValidationError(`${field} is required`, { field, value });
                }
                return;
            }
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                throw new error_1.ValidationError(`${field} must be an object`, { field, value });
            }
        }
        validateIPAddress(value, field, required = true) {
            if (value === undefined) {
                if (required) {
                    throw new error_1.ValidationError(`${field} is required`, { field, value });
                }
                return;
            }
            this.validateString(value, field, required);
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            if (!ipRegex.test(value)) {
                throw new error_1.ValidationError(`${field} must be a valid IP address`, { field, value });
            }
        }
        validatePort(value, field, required = true) {
            this.validateNumber(value, 1, 65535, field, required);
        }
        validateInterval(value, field, required = true, min = 0) {
            this.validateNumber(value, min, Infinity, field, required);
        }
    }
    exports.BaseValidator = BaseValidator;
    class DHTConfigValidator extends BaseValidator {
        validate(config) {
            const errors = [];
            const warnings = [];
            try {
                if (config.address !== undefined) {
                    try {
                        this.validateIPAddress(config.address, 'address', false);
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            errors.push(error.message);
                        }
                    }
                }
                try {
                    this.validatePort(config.port, 'port', false);
                }
                catch (error) {
                    if (error instanceof error_1.ValidationError) {
                        errors.push(error.message);
                    }
                }
                try {
                    this.validateNumber(config.nodesMaxSize, 1, Infinity, 'nodesMaxSize');
                }
                catch (error) {
                    if (error instanceof error_1.ValidationError) {
                        errors.push(error.message);
                    }
                }
                try {
                    this.validateInterval(config.refreshPeriod, 'refreshPeriod', false, 1000);
                }
                catch (error) {
                    if (error instanceof error_1.ValidationError) {
                        errors.push(error.message);
                    }
                }
                try {
                    this.validateInterval(config.announcePeriod, 'announcePeriod', false, 1000);
                }
                catch (error) {
                    if (error instanceof error_1.ValidationError) {
                        errors.push(error.message);
                    }
                }
                if (config.bootstrap !== undefined) {
                    try {
                        if (typeof config.bootstrap !== 'boolean' && !Array.isArray(config.bootstrap)) {
                            throw new error_1.ValidationError('bootstrap must be a boolean or string array', {
                                field: 'bootstrap',
                                value: config.bootstrap
                            });
                        }
                        if (Array.isArray(config.bootstrap)) {
                            for (let i = 0; i < config.bootstrap.length; i++) {
                                const node = config.bootstrap[i];
                                if (typeof node !== 'string') {
                                    errors.push(`bootstrap[${i}] must be a string`);
                                }
                            }
                        }
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            errors.push(error.message);
                        }
                    }
                }
                if (config.memoryThreshold !== undefined) {
                    try {
                        this.validateNumber(config.memoryThreshold, 1, Infinity, 'memoryThreshold');
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            warnings.push(error.message);
                        }
                    }
                }
                if (config.cleanupInterval !== undefined) {
                    try {
                        this.validateInterval(config.cleanupInterval, 'cleanupInterval', false);
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            warnings.push(error.message);
                        }
                    }
                }
            }
            catch (error) {
                errors.push(`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`);
            }
            return {
                isValid: errors.length === 0,
                errors,
                warnings: warnings.length > 0 ? warnings : undefined
            };
        }
    }
    exports.DHTConfigValidator = DHTConfigValidator;
    class CacheConfigValidator extends BaseValidator {
        validate(config) {
            const errors = [];
            const warnings = [];
            try {
                const sizeFields = [
                    'fetchedTupleSize',
                    'fetchedInfoHashSize',
                    'findNodeCacheSize',
                    'latestCalledPeersSize',
                    'usefulPeersSize',
                    'metadataFetchingCacheSize'
                ];
                sizeFields.forEach(field => {
                    if (config[field] !== undefined) {
                        try {
                            this.validateNumber(config[field], 1, 1000000, field);
                        }
                        catch (error) {
                            if (error instanceof error_1.ValidationError) {
                                errors.push(error.message);
                            }
                        }
                    }
                });
                if (config.compressionThreshold !== undefined) {
                    try {
                        this.validateNumber(config.compressionThreshold, 1, Infinity, 'compressionThreshold');
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            warnings.push(error.message);
                        }
                    }
                }
                if (config.maxRetryAttempts !== undefined) {
                    try {
                        this.validateNumber(config.maxRetryAttempts, 0, 100, 'maxRetryAttempts');
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            warnings.push(error.message);
                        }
                    }
                }
                if (config.circuitBreakerThreshold !== undefined) {
                    try {
                        this.validateNumber(config.circuitBreakerThreshold, 1, 100, 'circuitBreakerThreshold');
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            warnings.push(error.message);
                        }
                    }
                }
            }
            catch (error) {
                errors.push(`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`);
            }
            return {
                isValid: errors.length === 0,
                errors,
                warnings: warnings.length > 0 ? warnings : undefined
            };
        }
    }
    exports.CacheConfigValidator = CacheConfigValidator;
    class MetadataConfigValidator extends BaseValidator {
        validate(config) {
            const errors = [];
            const warnings = [];
            try {
                try {
                    this.validateNumber(config.maximumParallelFetchingTorrent, 1, 1000, 'maximumParallelFetchingTorrent');
                }
                catch (error) {
                    if (error instanceof error_1.ValidationError) {
                        errors.push(error.message);
                    }
                }
                if (config.maximumWaitingQueueSize !== undefined) {
                    try {
                        this.validateNumber(config.maximumWaitingQueueSize, 0, 10000, 'maximumWaitingQueueSize');
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            warnings.push(error.message);
                        }
                    }
                }
                if (config.requestTimeout !== undefined) {
                    try {
                        this.validateInterval(config.requestTimeout, 'requestTimeout', false, 1000);
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            warnings.push(error.message);
                        }
                    }
                }
                if (config.maxRetries !== undefined) {
                    try {
                        this.validateNumber(config.maxRetries, 0, 10, 'maxRetries');
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            warnings.push(error.message);
                        }
                    }
                }
                if (config.retryDelay !== undefined) {
                    try {
                        this.validateInterval(config.retryDelay, 'retryDelay', false);
                    }
                    catch (error) {
                        if (error instanceof error_1.ValidationError) {
                            warnings.push(error.message);
                        }
                    }
                }
            }
            catch (error) {
                errors.push(`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`);
            }
            return {
                isValid: errors.length === 0,
                errors,
                warnings: warnings.length > 0 ? warnings : undefined
            };
        }
    }
    exports.MetadataConfigValidator = MetadataConfigValidator;
    class ConfigValidatorManager {
        constructor() {
            this.validators = new Map();
            this.registerValidator('dht', new DHTConfigValidator());
            this.registerValidator('cache', new CacheConfigValidator());
            this.registerValidator('metadata', new MetadataConfigValidator());
        }
        registerValidator(name, validator) {
            this.validators.set(name, validator);
        }
        validate(type, config) {
            const validator = this.validators.get(type);
            if (!validator) {
                return {
                    isValid: false,
                    errors: [`No validator found for type: ${type}`]
                };
            }
            return validator.validate(config);
        }
        validateAll(configs) {
            const results = {};
            for (const [type, config] of Object.entries(configs)) {
                results[type] = this.validate(type, config);
            }
            return results;
        }
    }
    exports.ConfigValidatorManager = ConfigValidatorManager;
    exports.globalConfigValidator = new ConfigValidatorManager();
});
