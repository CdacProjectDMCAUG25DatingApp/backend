// builtin modules
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");

// userdefined modules
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

// SOCKET IO
const io = new Server(server, {
    cors: { origin: "*" }
});
require("./socket")(io);


// ===============================
//  **GLOBAL CORS HEADERS** (first middleware)
// ===============================
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

    // Preflight bypass
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});


// ===============================
//  Static + JSON body parser
// ===============================
app.use('/profilePhotos', express.static('profilePhotos'));
app.use(express.json());


// ===============================
//  AUTH (bypass signin/signup)
// ===============================
app.use((req, res, next) => {
    // login/register allowed
    if (req.path === "/user/signin" || req.path === "/user/signup") {
        return next();
    }

    authorizeUser(req, res, next);
});


// ===============================
// ROUTES
// ===============================
app.use('/user', userRouter);
app.use("/photos", photoRouter);
app.use('/api', lookUpRouter);
app.use('/interactions', showpeopleRouter);
app.use('/likeesandmatches', likeesandmatches);
app.use("/settings", settingsRoutes);
app.use("/chat", chatRoutes);
app.use("/swipe", swipeRouter);


// ===============================
//  START SERVER
// ===============================
server.listen(4000, '0.0.0.0', () => {
    console.log("✔ Server running on port 4000");
});
