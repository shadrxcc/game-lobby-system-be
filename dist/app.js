"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const db_1 = __importDefault(require("./config/db"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
(0, db_1.default)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "*",
}));
let currentSession = {
    isActive: false,
    startedAt: null,
    endsAt: null,
    players: [],
    winningNumber: null,
};
const userSchema = new mongoose_1.default.Schema({
    username: { type: String, required: true, unique: true },
    wins: { type: Number, default: 0 },
});
const User = mongoose_1.default.model("User", userSchema);
app.use(body_parser_1.default.json());
function generateToken(username) {
    return jsonwebtoken_1.default.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
}
function authenticateJWT(req, res, next) {
    const token = req.headers.authorization;
    if (!token)
        return res.status(401).json({ error: "Unauthorized" });
    const decoded = token.split(" ")[1];
    jsonwebtoken_1.default.verify(decoded, JWT_SECRET, (err, user) => {
        if (err)
            return res.status(401).json({ error: "Unauthorized" });
        req.user = user;
        next();
    });
}
function startSession(durationSeconds = 20) {
    const now = Date.now();
    currentSession = {
        isActive: true,
        startedAt: now,
        endsAt: now + durationSeconds * 1000,
        players: [],
        winningNumber: null,
    };
    setTimeout(async () => {
        currentSession.isActive = false;
        const winner = Math.floor(Math.random() * 10) + 1;
        currentSession.winningNumber = winner;
        const winners = currentSession.players.filter((player) => player.pick === winner);
        for (const winner of winners) {
            await User.updateOne({ username: winner.username }, { $inc: { wins: 1 } });
        }
        setTimeout(() => {
            startSession();
        }, 10000);
    }, durationSeconds * 1000);
}
if (!currentSession.isActive) {
    startSession();
}
app.post("/register", async (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== "string") {
        return res.status(400).json({ error: "Username is required" });
    }
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ error: "Username already in use" });
        }
        const newUser = new User({ username, wins: 0 });
        await newUser.save();
        const token = generateToken(username);
        res.json({
            token,
            username,
            message: "Registration successful!",
        });
    }
    catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ error: "Registration failed" });
    }
});
app.post("/login", async (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== "string") {
        return res.status(400).json({ error: "Username is required" });
    }
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const token = generateToken(username);
        res.json({ token, username, message: "Login successful!" });
    }
    catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Login failed" });
    }
});
app.get("/session", authenticateJWT, (_req, res) => {
    res.json({
        isActive: currentSession.isActive,
        timeLeft: currentSession.isActive
            ? Math.max(0, Math.floor((currentSession.endsAt - Date.now()) / 1000))
            : 0,
        playersCount: currentSession.players.length,
    });
});
app.post("/session/join", authenticateJWT, (req, res) => {
    if (!currentSession.isActive) {
        return res.status(400).json({ error: "No active session buddy!" });
    }
    const username = req.user.username;
    if (currentSession.players.some((player) => player.username === username)) {
        return res.status(400).json({ error: "You've already joined the session buddy!" });
    }
    currentSession.players.push({ username, pick: null });
    res.json({ message: "You've joined the session buddy!" });
});
app.post("/session/pick", authenticateJWT, (req, res) => {
    if (!currentSession.isActive) {
        return res.status(400).json({ error: "No active session buddy!" });
    }
    const { pick } = req.body;
    const username = req.user.username;
    if (typeof pick !== "number" || pick < 1 || pick > 10) {
        return res.status(400).json({
            error: "Invalid pick buddy! Pick must be a number between 1 and 10!",
        });
    }
    const player = currentSession.players.find(p => p.username === username);
    if (!player) {
        return res.status(400).json({ error: "You haven't joined this session!" });
    }
    if (player.pick !== null) {
        return res.status(400).json({ error: "You've already picked a number!" });
    }
    player.pick = pick;
    res.json({ message: "Number picked successfully!" });
});
app.get("/session/status", authenticateJWT, (req, res) => {
    const username = req.user.username;
    const player = currentSession.players.find(p => p.username === username);
    const nextSessionStart = currentSession.isActive
        ? null
        : (currentSession.endsAt || 0) + 10000;
    res.json({
        isActive: currentSession.isActive,
        timeLeft: currentSession.isActive
            ? Math.max(0, Math.floor((currentSession.endsAt - Date.now()) / 1000))
            : 0,
        hasJoined: !!player,
        players: currentSession.players.length,
        hasPicked: player?.pick !== null,
        pick: player?.pick || null,
        nextSessionStart: nextSessionStart ? Math.max(0, Math.floor((nextSessionStart - Date.now()) / 1000)) : null,
    });
});
app.get("/session/results", authenticateJWT, (req, res) => {
    if (!currentSession.isActive) {
        return res.status(400).json({ error: "No active session buddy!" });
    }
    res.json({
        winningNumber: currentSession.winningNumber,
        players: currentSession.players,
        winners: currentSession.players.filter((player) => player.pick === currentSession.winningNumber),
    });
});
app.get("/session/completed-results", authenticateJWT, (req, res) => {
    if (currentSession.winningNumber === null) {
        return res.status(400).json({ error: "No completed session results available!" });
    }
    res.json({
        winningNumber: currentSession.winningNumber,
        players: currentSession.players,
        winners: currentSession.players.filter((player) => player.pick === currentSession.winningNumber),
    });
});
app.get("/session/leaderboard", authenticateJWT, async (_req, res) => {
    try {
        const users = await User.find().sort({ wins: -1 }).limit(10);
        res.json({ leaderboard: users });
    }
    catch (error) {
        console.error("Error fetching leaderboard:", error);
        res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
});
app.get("/", (req, res) => {
    res.send("Game Lobby Backend Running!");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
module.exports = app;
//# sourceMappingURL=app.js.map