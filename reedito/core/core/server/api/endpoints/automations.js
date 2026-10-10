"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.controller = void 0;
const automationsApi = __importStar(require("../../services/automations/automations-api"));
exports.controller = {
    docName: 'automations',
    browse: {
        headers: {
            cacheInvalidate: false,
        },
        permissions: true,
        async query() {
            return await automationsApi.browse();
        },
    },
    read: {
        headers: {
            cacheInvalidate: false,
        },
        data: ['id'],
        permissions: true,
        async query(frame) {
            return await automationsApi.read(frame.data.id);
        },
    },
    edit: {
        headers: {
            cacheInvalidate: false,
        },
        options: ['id'],
        permissions: true,
        async query(frame) {
            return await automationsApi.edit(frame.options.id, frame.data?.automations?.[0]);
        },
    },
    poll: {
        statusCode: 204,
        headers: {
            cacheInvalidate: false,
        },
        permissions: {
            docName: 'automations',
            method: 'poll',
        },
        query() {
            automationsApi.requestPoll();
        },
    },
};
