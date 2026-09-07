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
exports.ChatController = void 0;
var chat_repository_js_1 = require("../repositories/chat.repository.js");
var chat_service_js_1 = require("../services/chat.service.js");
var chatService = new chat_service_js_1.default();
var ChatController = /** @class */ (function () {
    function ChatController() {
    }
    ChatController.prototype.handleChat = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var message, studentId, result, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        message = req.body.message;
                        if (!message || typeof message !== 'string' || message.trim() === '') {
                            res.status(400).json({ error: 'Message content cannot be empty.' });
                            return [2 /*return*/];
                        }
                        studentId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 1;
                        return [4 /*yield*/, chatService.generateResponse(studentId, { message: message })];
                    case 1:
                        result = _b.sent();
                        res.status(200).json(result);
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _b.sent();
                        console.error('ChatController Error:', error_1);
                        res.status(500).json({
                            success: false,
                            error: 'An internal server error occurred while processing your request.',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ChatController.prototype.getHistory = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var studentId, history_1, error_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        studentId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                        return [4 /*yield*/, chatService.getHistory(studentId)];
                    case 1:
                        history_1 = _b.sent();
                        res.status(200).json({ success: true, history: history_1 });
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _b.sent();
                        console.error('ChatController History Error:', error_2);
                        res.status(500).json({ error: 'Failed to retrieve chat history.' });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ChatController.prototype.updatePreferences = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var studentId, _a, preferredLanguage, learningStyle, repository, updated, error_3;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        studentId = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id) || 1;
                        _a = req.body, preferredLanguage = _a.preferredLanguage, learningStyle = _a.learningStyle;
                        if (!preferredLanguage) {
                            res.status(400).json({ error: 'preferredLanguage is required.' });
                            return [2 /*return*/];
                        }
                        repository = new chat_repository_js_1.ChatRepository();
                        return [4 /*yield*/, repository.updateUserPreference(studentId, preferredLanguage, learningStyle || 'Detailed')];
                    case 1:
                        updated = _c.sent();
                        res.status(200).json({ success: true, preference: updated });
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _c.sent();
                        console.error('Update Preferences Error:', error_3);
                        res.status(500).json({ error: 'Failed to update user preferences.' });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return ChatController;
}());
exports.ChatController = ChatController;
