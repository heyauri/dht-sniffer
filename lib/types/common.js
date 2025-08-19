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
    exports.TaskStatus = void 0;
    var TaskStatus;
    (function (TaskStatus) {
        TaskStatus["PENDING"] = "PENDING";
        TaskStatus["RUNNING"] = "RUNNING";
        TaskStatus["COMPLETED"] = "COMPLETED";
        TaskStatus["FAILED"] = "FAILED";
        TaskStatus["CANCELLED"] = "CANCELLED";
    })(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
});
