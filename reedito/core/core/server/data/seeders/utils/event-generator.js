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
exports.generateEvents = void 0;
const probabilityDistributions = __importStar(require("probability-distributions"));
const generateEvents = ({ shape = 'flat', trend = 'positive', total = 0, startTime = new Date(), endTime = new Date(), } = {}) => {
    if (total <= 0) {
        return [];
    }
    let alpha = 0;
    let beta = 0;
    let positiveTrend = trend === 'positive';
    switch (shape) {
        case 'linear':
            alpha = 2;
            beta = 1;
            break;
        case 'ease-in':
            alpha = 4;
            beta = 1;
            break;
        case 'ease-out':
            alpha = 1;
            beta = 4;
            positiveTrend = !positiveTrend;
            break;
        case 'flat':
            alpha = 1;
            beta = 1;
            break;
    }
    const data = probabilityDistributions.rbeta(total, alpha, beta, 0);
    const startTimeValue = startTime.valueOf();
    const timeDifference = endTime.valueOf() - startTimeValue;
    return data.map((x) => {
        if (!positiveTrend) {
            x = 1 - x;
        }
        return new Date(startTimeValue + timeDifference * x);
    });
};
exports.generateEvents = generateEvents;
