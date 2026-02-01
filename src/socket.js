// socket.js
const jwt = require("jsonwebtoken");
const config = require("./utils/config");
const pool = require("./utils/db");

let socketUserMap = {}; // uid → socket.id

function setupSocket(io) {
  // Authorize socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("NO_AUTH"));

    try {
      const decoded = jwt.verify(token, config.SECRET);
      socket.uid = decoded.uid;
      next();
    } catch (err) {
      next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket) => {
    const uid = socket.uid;
    socketUserMap[uid] = socket.id;

    console.log("User connected:", uid);

    // Receive → Validate → Store → Deliver
    socket.on("private_message", ({ to_token, message }) => {
      try {
        const decoded = jwt.verify(to_token, config.SECRET);
        const receiver_uid = decoded.uid;

        // Ensure they are matched
        const matchSQL = `
          SELECT 1 FROM matches
          WHERE (user_a = ? AND user_b = ?)
             OR (user_a = ? AND user_b = ?)
          LIMIT 1
        `;

        pool.query(matchSQL, [uid, receiver_uid, receiver_uid, uid], (err, rows) => {
          if (err || rows.length === 0) {
            return socket.emit("error", { message: "Users not matched" });
          }

          // Store message
          pool.query(
            `INSERT INTO messages (sender_id, receiver_id, message)
             VALUES (?, ?, ?)`,
            [uid, receiver_uid, message]
          );

          const msgPayload = {
            from: uid,
            message,
            timestamp: new Date(),
          };

          // Send to receiver if online
          const receiverSocket = socketUserMap[receiver_uid];
          if (receiverSocket) {
            io.to(receiverSocket).emit("private_message", msgPayload);
          }

          // Confirm sender
          socket.emit("message_sent", msgPayload);
        });
      } catch (err) {
        socket.emit("error", { message: "Invalid receiver token" });
      }
    });

    socket.on("disconnect", () => {
      delete socketUserMap[uid];
      console.log("User disconnected:", uid);
    });
  });
}

module.exports = setupSocket;
