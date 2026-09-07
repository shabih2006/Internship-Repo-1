"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveAIService = void 0;
var groq_sdk_1 = require("groq-sdk");
var prompt_config_js_1 = require("../config/prompt.config.js");
var chat_repository_js_1 = require("../repositories/chat.repository.js");
var LiveAIService = /** @class */ (function () {
    function LiveAIService() {
        this.chatRepository = new chat_repository_js_1.ChatRepository();
    }
    LiveAIService.prototype.generateResponse = function (studentId, prompt) {
        return __awaiter(this, void 0, void 0, function () {
            var apiKey, dbErr_1, preferenceInstruction, prefs, prefErr_1, MAX_HISTORY_TURNS, historyMessages, recentHistory, historyErr_1, groq, response, reply, dbErr_2, error_1;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        apiKey = (_a = process.env.GROQ_API_KEY) === null || _a === void 0 ? void 0 : _a.trim();
                        if (!apiKey || apiKey === 'your_groq_api_key' || apiKey === 'placeholder') {
                            throw new Error('GROQ_API_KEY is missing or invalid.');
                        }
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.chatRepository.saveConversation(studentId, 'user', prompt)];
                    case 2:
                        _e.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        dbErr_1 = _e.sent();
                        console.error('[DB Log Error]: Failed to log user prompt:', dbErr_1);
                        return [3 /*break*/, 4];
                    case 4:
                        preferenceInstruction = '';
                        _e.label = 5;
                    case 5:
                        _e.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, this.chatRepository.getUserPreference(studentId)];
                    case 6:
                        prefs = _e.sent();
                        if (prefs) {
                            preferenceInstruction = "\nUSER PREFERENCES:\n- Preferred Language: ".concat(prefs.preferredLanguage, "\n- Learning Style: ").concat(prefs.learningStyle, "\nAlways respond using the user's preferred language and learning style.");
                        }
                        return [3 /*break*/, 8];
                    case 7:
                        prefErr_1 = _e.sent();
                        console.warn('[Preference Warning]: Could not load preferences:', prefErr_1);
                        return [3 /*break*/, 8];
                    case 8:
                        MAX_HISTORY_TURNS = 10;
                        historyMessages = [
                            { role: 'system', content: "".concat(prompt_config_js_1.SYSTEM_PROMPT).concat(preferenceInstruction) },
                        ];
                        _e.label = 9;
                    case 9:
                        _e.trys.push([9, 11, , 12]);
                        return [4 /*yield*/, this.chatRepository.getRecentConversations(studentId, MAX_HISTORY_TURNS)];
                    case 10:
                        recentHistory = _e.sent();
                        recentHistory.forEach(function (c) {
                            historyMessages.push({
                                role: c.role === 'user' ? 'user' : 'assistant',
                                content: c.message,
                            });
                        });
                        return [3 /*break*/, 12];
                    case 11:
                        historyErr_1 = _e.sent();
                        console.warn('[History Warning]: Proceeding without past history window:', historyErr_1);
                        historyMessages.push({ role: 'user', content: prompt });
                        return [3 /*break*/, 12];
                    case 12:
                        _e.trys.push([12, 18, , 19]);
                        groq = new groq_sdk_1.default({ apiKey: apiKey });
                        return [4 /*yield*/, groq.chat.completions.create({
                                model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
                                messages: historyMessages,
                                temperature: 0.7,
                                max_completion_tokens: 1024,
                                top_p: 1,
                                stream: false,
                            })];
                    case 13:
                        response = _e.sent();
                        reply = (_d = (_c = (_b = response.choices[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.trim();
                        if (!reply) {
                            throw new Error('Groq returned an empty response.');
                        }
                        _e.label = 14;
                    case 14:
                        _e.trys.push([14, 16, , 17]);
                        return [4 /*yield*/, this.chatRepository.saveConversation(studentId, 'model', reply)];
                    case 15:
                        _e.sent();
                        return [3 /*break*/, 17];
                    case 16:
                        dbErr_2 = _e.sent();
                        console.error('[DB Log Error]: Failed to log model reply:', dbErr_2);
                        return [3 /*break*/, 17];
                    case 17: return [2 /*return*/, reply];
                    case 18:
                        error_1 = _e.sent();
                        console.error('[Groq API Error]:', (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || error_1);
                        return [2 /*return*/, "Oops! I couldn't process that request right now. Please try again in a moment!"];
                    case 19: return [2 /*return*/];
                }
            });
        });
    };
    return LiveAIService;
}());
exports.LiveAIService = LiveAIService;
