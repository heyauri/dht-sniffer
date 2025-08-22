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
        define(["require", "exports", "net", "util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getPortUsage = exports.killProcessOnPort = exports.getDHTAvailablePort = exports.findAvailablePort = exports.isPortAvailable = void 0;
    const net = require("net");
    const util = require("util");
    function isPortAvailable(port, host = '0.0.0.0') {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                const server = net.createServer();
                server.listen(port, host, () => {
                    const { port: listenedPort } = server.address();
                    server.close(() => {
                        resolve(listenedPort === port);
                    });
                });
                server.on('error', () => {
                    resolve(false);
                });
            });
        });
    }
    exports.isPortAvailable = isPortAvailable;
    function findAvailablePort(startPort = 6881, host = '0.0.0.0', maxAttempts = 100) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < maxAttempts; i++) {
                const port = startPort + i;
                if (yield isPortAvailable(port, host)) {
                    return port;
                }
            }
            throw new Error(`No available port found starting from ${startPort} after ${maxAttempts} attempts`);
        });
    }
    exports.findAvailablePort = findAvailablePort;
    function getDHTAvailablePort(preferredPort = 6881) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (yield isPortAvailable(preferredPort)) {
                    return preferredPort;
                }
                const dhtPorts = [6881, 6882, 6883, 6884, 6885, 6886, 6887, 6888, 6889];
                for (const port of dhtPorts) {
                    if (yield isPortAvailable(port)) {
                        return port;
                    }
                }
                return yield findAvailablePort(6881);
            }
            catch (error) {
                throw new Error(`Failed to find available DHT port: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    exports.getDHTAvailablePort = getDHTAvailablePort;
    function killProcessOnPort(port) {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.platform !== 'darwin' && process.platform !== 'linux') {
                return false;
            }
            const { exec } = require('child_process');
            const execAsync = util.promisify(exec);
            try {
                const { stdout } = yield execAsync(`lsof -ti:${port}`);
                const pids = stdout.trim().split('\n').filter(pid => pid);
                if (pids.length === 0) {
                    return false;
                }
                for (const pid of pids) {
                    yield execAsync(`kill -9 ${pid}`);
                }
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    exports.killProcessOnPort = killProcessOnPort;
    function getPortUsage(port) {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.platform !== 'darwin' && process.platform !== 'linux') {
                return 'Port usage information not available on this platform';
            }
            const { exec } = require('child_process');
            const execAsync = util.promisify(exec);
            try {
                const { stdout } = yield execAsync(`lsof -i:${port}`);
                return stdout;
            }
            catch (error) {
                return `Port ${port} appears to be available`;
            }
        });
    }
    exports.getPortUsage = getPortUsage;
});
