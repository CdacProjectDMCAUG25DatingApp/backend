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

// Initialize express + HTTP server
const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
    cors: { origin: "*" }
});

// Initialize socket handlers
const setupSocket = require("./socket");
setupSocket(io);

// Middlewares
app.use(cors());
app.use('/profilePhotos', express.static('profilePhotos'))
app.use(express.json());

// Auth middleware ONLY for API routes (NOT for socket.io)
app.use(authorizeUser);

// Routers
app.use('/user', userRouter);
app.use("/photos", photoRouter);
app.use('/api', lookUpRouter);
app.use('/interactions', showpeopleRouter);
app.use('/likeesandmatches', likeesandmatches);
app.use("/settings", settingsRoutes);
app.use("/chat", chatRoutes);

server.listen(4000, 'localhost', () => {
    console.log("Server running on port 4000");
});
