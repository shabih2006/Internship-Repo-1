"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.AuthController = void 0;
var auth_service_1 = require("../services/auth.service");
var authService = new auth_service_1.AuthService();
var JWT_SECRET = process.env.JWT_SECRET;
var AuthController = /** @class */ (function () {
    function AuthController() {
    }
    AuthController.prototype.register = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, email, password, role, user, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        _a = req.body, email = _a.email, password = _a.password, role = _a.role;
                        if (!email || !password) {
                            res.status(400).json({ error: 'Email and password are required.' });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, authService.registerUser(email, password, role)];
                    case 1:
                        user = _b.sent();
                        res.status(201).json({
                            message: 'User registered successfully!',
                            user: user,
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _b.sent();
                        res.status(400).json({ error: error_1.message || 'Server error during registration.' });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    AuthController.prototype.login = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, email, password, isTestExpiry, result, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        _a = req.body, email = _a.email, password = _a.password;
                        if (!email || !password) {
                            res.status(400).json({ error: 'Email and password are required.' });
                            return [2 /*return*/];
                        }
                        isTestExpiry = req.query.testExpiry === 'true';
                        return [4 /*yield*/, authService.loginUser(email, password, isTestExpiry, JWT_SECRET)];
                    case 1:
                        result = _b.sent();
                        res.status(200).json(__assign({ message: 'Login successful!' }, result));
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _b.sent();
                        res.status(401).json({ error: error_2.message || 'Server error during login.' });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return AuthController;
}());
exports.AuthController = AuthController;
