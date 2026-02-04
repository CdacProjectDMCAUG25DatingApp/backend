const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");

const authorizeUser = require('./utils/authuser');
const userRouter = require("./routes/user");
const photoRouter = require("./routes/photos");
const lookUpRouter = require('./routes/LookUpTables/getlookups');
const showpeopleRouter = require("./routes/Interactions/showpeople");
const likeesandmatches = require("./routes/Interactions/likesnmatches");
const settingsRoutes = require("./routes/settingsroutes");
const chatRoutes = require("./routes/chat");
const swipeRouter = require("./routes/swipes");

const app = express();
const server = http.createServer(app);

// socket.io
const io = new Server(server, {
    cors: { origin: "*" }
});
require("./socket")(io);

// ========================
// 1. CORS (first middleware)
// ========================
const allowedOrigins = [
    "https://flertecdacdmcproject.netlify.app",
    "http://localhost:5173",
];

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // PRE-FLIGHT (OPTIONS) MUST RETURN 200
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    next();
});

// ========================
// 2. JSON + Static
// ========================
app.use(express.json());
app.use('/profilePhotos', express.static('profilePhotos'));

// ========================
// 3. AUTH (skip signin/signup)
// ========================
app.use((req, res, next) => {
    if (
        req.path === "/user/signin" ||
        req.path === "/user/signup"
    ) {
        return next();
    }

    authorizeUser(req, res, next);
});

// ========================
// 4. Routes
// ========================
app.use('/user', userRouter);
app.use("/photos", photoRouter);
app.use('/api', lookUpRouter);
app.use('/interactions', showpeopleRouter);
app.use('/likeesandmatches', likeesandmatches);
app.use("/settings", settingsRoutes);
app.use("/chat", chatRoutes);
app.use("/swipe", swipeRouter);

// ========================
// 5. Start Server
// ========================
server.listen(4000, '0.0.0.0', () => {
    console.log("✔ Server running on port 4000");
});
