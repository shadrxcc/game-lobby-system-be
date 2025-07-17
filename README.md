# Game Lobby System Backend

A real-time game lobby system where users can join sessions, pick numbers, and compete to win. Built with Node.js, Express, TypeScript, and MongoDB.

## 🎮 Game Overview

- **Session Duration**: 20 seconds per game
- **Number Range**: Players pick numbers 1-10 with a random number selected at session end
- **Auto-restart**: Sessions automatically restart with 10 second breaks
- **Leaderboard**: Top 10 players are tracked by wins

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js + Express + TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens
- **Real-time**: 1 sec polling-based status updates

### Key Features
- ✅ User authentication (username-based)
- ✅ Real-time session management
- ✅ Automatic session cycling
- ✅ Leaderboard system

## 🔄 Game Flow

1. **User Registration/Login**
   - User provides username
   - Receives JWT token for authentication

2. **Session Joining**
   - User joins active session via `/session/join` if session time still running
   - No number picking at this stage


3. **Number Selection**
   - User navigates to game page on successfully joining the session
   - Picks number 1-10 with `/session/pick`
   - Waits for session to end to see result
   - Check for when user navigates to game page manually, if a session is active, they auto join, else get redirected back to the lobby.

4. **Results & Auto-restart**
   - Session ends after 20 seconds
   - Results are displayed during 10-second break
   - New session automatically starts
   - Users auto-rejoin new session 

## 🚀 API Endpoints

### Authentication
- `POST /register` - Register/login with username
- `POST /login` - Login existing user

### Session Management
- `GET /session` - Get current session status (public)
- `POST /session/join` - Join current session (requires JWT)
- `POST /session/pick` - Pick a number (requires JWT)
- `GET /session/status` - Get user's session status (requires JWT)
- `GET /session/results` - Get session results (requires JWT)

### Game Data
- `GET /session/leaderboard` - Top 10 players by wins

## ⚙️ Setup Instructions

### Prerequisites
- Node.js (v16+)
- MongoDB (local or Atlas)
- Yarn or npm

### Installation
```bash
# Install dependencies
yarn install

# Set environment variables
cp .env.example .env
# Add your MONGODB_URI and JWT_SECRET

# Start development server
yarn dev
```

### Environment Variables
```env
MONGODB_URI=mongodb://localhost:2717game-lobby
JWT_SECRET=your-secret-key
PORT=3000
```

## 📝 License

MIT License - feel free to use this project for learning and development. 