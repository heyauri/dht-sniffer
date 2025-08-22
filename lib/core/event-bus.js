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
        define(["require", "exports", "events"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.globalEventBus = exports.createDefaultEventBus = exports.EventTypes = exports.EventBus = void 0;
    const events_1 = require("events");
    class EventBus extends events_1.EventEmitter {
        constructor() {
            super();
            this.subscribers = new Map();
            this.prioritySubscribers = new Map();
            this.eventHistory = [];
            this.maxHistorySize = 1000;
            this.eventStats = new Map();
            this.setMaxListeners(100);
        }
        subscribe(event, handler, options = {}) {
            const { once = false, priority = 0 } = options;
            if (priority !== 0) {
                if (!this.prioritySubscribers.has(event)) {
                    this.prioritySubscribers.set(event, new Map());
                }
                const priorityMap = this.prioritySubscribers.get(event);
                if (!priorityMap.has(priority)) {
                    priorityMap.set(priority, []);
                }
                priorityMap.get(priority).push(handler);
                const sortedPriorities = Array.from(priorityMap.keys()).sort((a, b) => b - a);
                const allHandlers = [];
                sortedPriorities.forEach(p => {
                    allHandlers.push(...priorityMap.get(p));
                });
                this.subscribers.set(event, allHandlers);
            }
            else {
                if (!this.subscribers.has(event)) {
                    this.subscribers.set(event, []);
                }
                this.subscribers.get(event).push(handler);
            }
            if (once) {
                const onceHandler = (data) => {
                    handler(data);
                    this.unsubscribe(event, handler);
                };
                const index = this.subscribers.get(event).indexOf(handler);
                if (index > -1) {
                    this.subscribers.get(event)[index] = onceHandler;
                }
            }
            return () => this.unsubscribe(event, handler);
        }
        unsubscribe(event, handler) {
            const handlers = this.subscribers.get(event);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index > -1) {
                    handlers.splice(index, 1);
                }
                if (handlers.length === 0) {
                    this.subscribers.delete(event);
                }
            }
            const priorityMap = this.prioritySubscribers.get(event);
            if (priorityMap) {
                priorityMap.forEach((handlers, priority) => {
                    const index = handlers.indexOf(handler);
                    if (index > -1) {
                        handlers.splice(index, 1);
                    }
                    if (handlers.length === 0) {
                        priorityMap.delete(priority);
                    }
                });
                if (priorityMap.size === 0) {
                    this.prioritySubscribers.delete(event);
                }
            }
        }
        publish(event, data = {}, options = {}) {
            const { async = false, recordHistory = true } = options;
            const eventData = Object.assign(Object.assign({}, data), { timestamp: Date.now(), eventName: event });
            if (recordHistory) {
                this.recordEvent(event, eventData);
            }
            this.updateEventStats(event);
            const handlers = this.subscribers.get(event) || [];
            if (async) {
                handlers.forEach(handler => {
                    setImmediate(() => {
                        try {
                            handler(eventData);
                        }
                        catch (error) {
                            console.error(`Error in async event handler for ${event}:`, error);
                            this.publish('error', {
                                originalEvent: event,
                                error: error instanceof Error ? error.message : String(error),
                                handler: handler.name || 'anonymous'
                            });
                        }
                    });
                });
            }
            else {
                handlers.forEach(handler => {
                    try {
                        handler(eventData);
                    }
                    catch (error) {
                        console.error(`Error in event handler for ${event}:`, error);
                        this.publish('error', {
                            originalEvent: event,
                            error: error instanceof Error ? error.message : String(error),
                            handler: handler.name || 'anonymous'
                        });
                    }
                });
            }
            super.emit(event, eventData);
        }
        publishAsync(event, data = {}) {
            const _super = Object.create(null, {
                emit: { get: () => super.emit }
            });
            return __awaiter(this, void 0, void 0, function* () {
                const eventData = Object.assign(Object.assign({}, data), { timestamp: Date.now(), eventName: event });
                this.recordEvent(event, eventData);
                this.updateEventStats(event);
                const handlers = this.subscribers.get(event) || [];
                const promises = handlers.map(handler => {
                    try {
                        const result = handler(eventData);
                        return result instanceof Promise ? result : Promise.resolve();
                    }
                    catch (error) {
                        console.error(`Error in async event handler for ${event}:`, error);
                        this.publish('error', {
                            originalEvent: event,
                            error: error instanceof Error ? error.message : String(error),
                            handler: handler.name || 'anonymous'
                        });
                        return Promise.resolve();
                    }
                });
                yield Promise.all(promises);
                _super.emit.call(this, event, eventData);
            });
        }
        recordEvent(event, data) {
            this.eventHistory.push({
                event,
                data,
                timestamp: Date.now()
            });
            if (this.eventHistory.length > this.maxHistorySize) {
                this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
            }
        }
        updateEventStats(event) {
            const stats = this.eventStats.get(event) || { count: 0, lastEmitted: 0 };
            stats.count++;
            stats.lastEmitted = Date.now();
            this.eventStats.set(event, stats);
        }
        getEventHistory(event, limit = 100) {
            let history = this.eventHistory;
            if (event) {
                history = history.filter(item => item.event === event);
            }
            return history.slice(-limit);
        }
        getEventStats() {
            const stats = {};
            this.eventStats.forEach((value, key) => {
                stats[key] = Object.assign({}, value);
            });
            return stats;
        }
        getSubscriberCount(event) {
            var _a;
            if (event) {
                return ((_a = this.subscribers.get(event)) === null || _a === void 0 ? void 0 : _a.length) || 0;
            }
            let total = 0;
            this.subscribers.forEach(handlers => {
                total += handlers.length;
            });
            return total;
        }
        getEventNames() {
            return Array.from(this.subscribers.keys());
        }
        clearHistory() {
            this.eventHistory = [];
        }
        clearAllSubscriptions() {
            this.subscribers.clear();
            this.prioritySubscribers.clear();
            this.removeAllListeners();
        }
        setMaxHistorySize(size) {
            this.maxHistorySize = Math.max(0, size);
            if (this.eventHistory.length > this.maxHistorySize) {
                this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
            }
        }
        hasSubscribers(event) {
            return this.subscribers.has(event) && this.subscribers.get(event).length > 0;
        }
    }
    exports.EventBus = EventBus;
    exports.EventTypes = {
        SYSTEM: {
            STARTUP: 'system.startup',
            SHUTDOWN: 'system.shutdown',
            error: 'system.error',
            warning: 'system.warning',
            INFO: 'system.info',
            started: 'system.started',
            memoryWarning: 'system.memoryWarning',
            performanceStats: 'system.performanceStats',
            healthCheck: 'system.healthCheck',
            memoryCleanupCompleted: 'system.memoryCleanupCompleted',
            restarting: 'system.restarting',
            restarted: 'system.restarted',
            restartFailed: 'system.restartFailed',
            shuttingDown: 'system.shuttingDown',
            shutdownCompleted: 'system.shutdownCompleted',
            shutdownFailed: 'system.shutdownFailed'
        },
        DHT: {
            STARTED: 'dht.started',
            STOPPED: 'dht.stopped',
            nodeDiscovered: 'dht.nodeDiscovered',
            nodeLost: 'dht.nodeLost',
            querySent: 'dht.querySent',
            queryReceived: 'dht.queryReceived',
            responseReceived: 'dht.responseReceived',
            peerFound: 'dht.peerFound',
            nodeFound: 'dht.nodeFound',
            error: 'dht.error',
            warning: 'dht.warning',
            infoHashFound: 'dht.infoHashFound'
        },
        PEER: {
            connected: 'peer.connected',
            disconnected: 'peer.disconnected',
            imported: 'peer.imported',
            exported: 'peer.exported',
            updated: 'peer.updated'
        },
        CACHE: {
            HIT: 'cache.hit',
            MISS: 'cache.miss',
            evicted: 'cache.evicted',
            cleared: 'cache.cleared',
            sizeChanged: 'cache.sizeChanged'
        },
        METADATA: {
            fetched: 'metadata.fetched',
            fetchFailed: 'metadata.fetchFailed',
            queued: 'metadata.queued',
            processing: 'metadata.processing',
            completed: 'metadata.completed',
            queueRequest: 'metadata.queueRequest',
            error: 'metadata.error'
        },
        MANAGER: {
            created: 'manager.created',
            destroyed: 'manager.destroyed',
            cleanupCompleted: 'manager.cleanupCompleted',
            memoryWarning: 'manager.memoryWarning'
        }
    };
    function createDefaultEventBus() {
        const eventBus = new EventBus();
        eventBus.setMaxHistorySize(500);
        eventBus.subscribe(exports.EventTypes.SYSTEM.error, (data) => {
            console.error('[System Error]', data);
        }, { priority: 100 });
        eventBus.subscribe(exports.EventTypes.SYSTEM.warning, (data) => {
            console.warn('[System Warning]', data);
        }, { priority: 90 });
        return eventBus;
    }
    exports.createDefaultEventBus = createDefaultEventBus;
    exports.globalEventBus = createDefaultEventBus();
});
