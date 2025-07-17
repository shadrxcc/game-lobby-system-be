import express from "express";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import cors from "cors";
import connectDB from "./config/db";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

connectDB();

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const app = express();

app.use(cors({
  origin: "*",
}));

let currentSession = {
  isActive: false,
  startedAt: null as null | number,
  endsAt: null as null | number,
  players: [] as Array<{ username: string; pick: number | null }>,
  winningNumber: null as null | number,
};

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  wins: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);

app.use(bodyParser.json());

function generateToken(username: string) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
}

function authenticateJWT(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const decoded = token.split(" ")[1];
  jwt.verify(decoded, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: "Unauthorized" });
    req.user = user;
    next();
  });
}

function startSession(durationSeconds: number = 20) {
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

    const winners = currentSession.players.filter(
      (player) => player.pick === winner
    );

    for (const winner of winners) {
      await User.updateOne(
        { username: winner.username },
        { $inc: { wins: 1 } }
      );
    }

    setTimeout(() => {
      startSession();
    }, 5000);
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
  } catch (err) {
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
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/session", authenticateJWT, (_req, res) => {
  res.json({
    isActive: currentSession.isActive,
    timeLeft: currentSession.isActive
      ? Math.max(0, Math.floor((currentSession.endsAt! - Date.now()) / 1000))
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
  
  res.json({
    isActive: currentSession.isActive,
    timeLeft: currentSession.isActive
      ? Math.max(0, Math.floor((currentSession.endsAt! - Date.now()) / 1000))
      : 0,
    hasJoined: !!player,
    players: currentSession.players.length,
    hasPicked: player?.pick !== null,
    pick: player?.pick || null,
  });
});

app.get("/session/results", authenticateJWT, (req, res) => {
  if (!currentSession.isActive) {
    return res.status(400).json({ error: "No active session buddy!" });
  }

  res.json({
    winningNumber: currentSession.winningNumber,
    players: currentSession.players,
    winners: currentSession.players.filter(
      (player) => player.pick === currentSession.winningNumber
    ),
  });
});

app.get("/session/leaderboard", authenticateJWT, async (_req, res) => {
  try {
    const users = await User.find().sort({ wins: -1 }).limit(10);
    res.json({ leaderboard: users });
  } catch (error) {
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