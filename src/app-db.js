"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var express_1 = require("express");
var jsonwebtoken_1 = require("jsonwebtoken");
var express_rate_limit_1 = require("express-rate-limit");
var auth_controller_js_1 = require("./controllers/auth.controller.js");
var student_controller_js_1 = require("./controllers/student.controller.js");
var chat_controller_js_1 = require("./controllers/chat.controller.js");
var app = (0, express_1.default)();
var JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
}
app.use(express_1.default.json());
var authController = new auth_controller_js_1.AuthController();
var studentController = new student_controller_js_1.StudentController();
var chatController = new chat_controller_js_1.ChatController();
// RATE LIMITER
var chatRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: 'Too many chat requests from this IP. Please wait a minute before trying again.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
var authenticateToken = function (req, res, next) {
    var authHeader = req.headers['authorization'];
    var token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Access denied. No token provided.' });
        return;
    }
    jsonwebtoken_1.default.verify(token, JWT_SECRET, function (err, user) {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                res.status(401).json({ error: 'Token has expired. Please log in again.' });
                return;
            }
            res.status(401).json({ error: 'Invalid or malformed token.' });
            return;
        }
        req.user = user;
        next();
    });
};
var authorizeRoles = function () {
    var allowedRoles = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        allowedRoles[_i] = arguments[_i];
    }
    return function (req, res, next) {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                error: "Forbidden: Access restricted to roles [".concat(allowedRoles.join(', '), "]"),
            });
            return;
        }
        next();
    };
};
// ROUTE DEFINITIONS
app.post('/auth/register', function (req, res) { return authController.register(req, res); });
app.post('/auth/login', function (req, res) { return authController.login(req, res); });
app.get('/students', authenticateToken, function (req, res) { return studentController.getAll(req, res); });
app.get('/students/:id', authenticateToken, function (req, res) { return studentController.getById(req, res); });
app.post('/students', authenticateToken, function (req, res) { return studentController.create(req, res); });
app.delete('/students/:id', authenticateToken, authorizeRoles('ADMIN'), function (req, res) { return studentController.delete(req, res); });
// AI CHATBOT ROUTES
app.post('/chat', chatRateLimiter, authenticateToken, function (req, res) { return chatController.handleChat(req, res); });
app.get('/chat/history', authenticateToken, function (req, res) { return chatController.getHistory(req, res); });
// 404 HANDLER
app.use(function (req, res) {
    res.status(404).json({ error: "Route ".concat(req.originalUrl, " not found.") });
});
var PORT = process.env.PORT || 3000;
var server = app.listen(PORT, function () {
    console.log("\uD83D\uDE80 Server listening on http://localhost:".concat(PORT));
});
server.timeout = 15000;
