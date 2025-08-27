(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "../errors/error-handler-impl", "../errors/error-monitor", "./dht-manager", "./peer-manager", "./cache-manager", "./metadata-manager"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.globalContainer = exports.DIContainer = void 0;
    exports.createDefaultContainer = createDefaultContainer;
    const events_1 = require("events");
    const error_handler_impl_1 = require("../errors/error-handler-impl");
    const error_monitor_1 = require("../errors/error-monitor");
    const dht_manager_1 = require("./dht-manager");
    const peer_manager_1 = require("./peer-manager");
    const cache_manager_1 = require("./cache-manager");
    const metadata_manager_1 = require("./metadata-manager");
    class DIContainer extends events_1.EventEmitter {
        constructor() {
            super(...arguments);
            this.services = new Map();
            this.singletons = new Map();
            this.instances = new Map();
            this.initializing = new Set();
        }
        register(name, factory, singleton = false) {
            if (singleton) {
                this.singletons.set(name, factory);
            }
            else {
                this.services.set(name, factory);
            }
            this.emit('serviceRegistered', { name, singleton });
        }
        get(name) {
            if (this.initializing.has(name)) {
                throw new Error(`Circular dependency detected for service: ${name}`);
            }
            if (this.instances.has(name)) {
                return this.instances.get(name);
            }
            if (this.singletons.has(name)) {
                const factory = this.singletons.get(name);
                this.initializing.add(name);
                try {
                    const instance = factory();
                    this.instances.set(name, instance);
                    this.initializing.delete(name);
                    return instance;
                }
                catch (error) {
                    this.initializing.delete(name);
                    throw error;
                }
            }
            if (this.services.has(name)) {
                const factory = this.services.get(name);
                this.initializing.add(name);
                try {
                    const instance = factory();
                    this.initializing.delete(name);
                    return instance;
                }
                catch (error) {
                    this.initializing.delete(name);
                    throw error;
                }
            }
            throw new Error(`Service ${name} not found`);
        }
        has(name) {
            return this.services.has(name) || this.singletons.has(name) || this.instances.has(name);
        }
        remove(name) {
            this.services.delete(name);
            this.singletons.delete(name);
            const instance = this.instances.get(name);
            if (instance && typeof instance.destroy === 'function') {
                instance.destroy();
            }
            this.instances.delete(name);
            this.emit('serviceRemoved', { name });
        }
        clear() {
            this.instances.forEach((instance, name) => {
                if (typeof instance.destroy === 'function') {
                    try {
                        instance.destroy();
                    }
                    catch (error) {
                        console.error(`Error destroying service ${name}:`, error);
                    }
                }
            });
            this.services.clear();
            this.singletons.clear();
            this.instances.clear();
            this.initializing.clear();
            this.emit('containerCleared');
        }
        getServiceNames() {
            return [
                ...Array.from(this.services.keys()),
                ...Array.from(this.singletons.keys()),
                ...Array.from(this.instances.keys())
            ];
        }
        getStats() {
            return {
                services: this.services.size,
                singletons: this.singletons.size,
                instances: this.instances.size,
                total: this.services.size + this.singletons.size + this.instances.size,
                serviceNames: this.getServiceNames()
            };
        }
    }
    exports.DIContainer = DIContainer;
    function createDefaultContainer(config) {
        const container = new DIContainer();
        container.register('errorHandler', () => new error_handler_impl_1.ErrorHandlerImpl(), true);
        container.register('errorMonitor', () => {
            const errorHandler = container.get('errorHandler');
            const errorMonitorConfig = config.errorMonitorConfig || {};
            return new error_monitor_1.ErrorMonitor(errorHandler, errorMonitorConfig);
        }, true);
        container.register('cacheManager', () => {
            const errorHandler = container.get('errorHandler');
            const cacheConfig = config.cache || {
                fetchedTupleSize: 1000,
                fetchedInfoHashSize: 5000,
                findNodeCacheSize: 2000,
                latestCalledPeersSize: 1000,
                usefulPeersSize: 5000,
                metadataFetchingCacheSize: 1000
            };
            return new cache_manager_1.CacheManager(cacheConfig, errorHandler);
        }, true);
        container.register('peerManager', () => {
            const errorHandler = container.get('errorHandler');
            const cacheManager = container.get('cacheManager');
            const peerConfig = config.peer || {};
            return new peer_manager_1.PeerManager(Object.assign(Object.assign({}, peerConfig), { enableErrorHandling: true, enableMemoryMonitoring: true }), null, cacheManager, errorHandler);
        }, true);
        container.register('metadataManager', () => {
            const errorHandler = container.get('errorHandler');
            const cacheManager = container.get('cacheManager');
            const metadataConfig = config.metadata || {};
            return new metadata_manager_1.MetadataManager(Object.assign(Object.assign({}, metadataConfig), { enableErrorHandling: true, enableMemoryMonitoring: true }), errorHandler, cacheManager);
        }, true);
        container.register('dhtManager', () => {
            const errorHandler = container.get('errorHandler');
            const peerManager = container.get('peerManager');
            const cacheManager = container.get('cacheManager');
            const dhtConfig = config.dht || {};
            return new dht_manager_1.DHTManager(Object.assign(Object.assign({}, dhtConfig), { enableErrorHandling: true, enableMemoryMonitoring: true }), errorHandler, peerManager, cacheManager);
        }, true);
        return container;
    }
    exports.globalContainer = new DIContainer();
});
