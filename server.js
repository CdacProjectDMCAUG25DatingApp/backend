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

// Initialize express + HTTP server
const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
    cors: { origin: "*" }
});
const setupSocket = require("./socket");
setupSocket(io);

// ========== CORS SETUP ==========
const allowedOrigins = [
    "https://flertecdacdmcproject.netlify.app",
    "http://localhost:5173"
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("CORS blocked"));
        }
    },
    credentials: true,
}));


app.use('/profilePhotos', express.static('profilePhotos'));
app.use(express.json());

app.use((req, res, next) => {
    // Allow all CORS preflight requests
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    // Allow signin + signup without token
    if (
        req.path === "/user/signin" ||
        req.path === "/user/signup"
    ) {
        return next();
    }
    authorizeUser(req, res, next);
});

// ========== ROUTES ==========
app.use('/user', userRouter);
app.use("/photos", photoRouter);
app.use('/api', lookUpRouter);
app.use('/interactions', showpeopleRouter);
app.use('/likeesandmatches', likeesandmatches);
app.use("/settings", settingsRoutes);
app.use("/chat", chatRoutes);
app.use("/swipe", swipeRouter);

// ========== START SERVER ==========
server.listen(4000, '0.0.0.0', () => {
    console.log("Server running on port 4000");
});
