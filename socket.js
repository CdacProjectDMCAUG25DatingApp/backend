// socket.js
const jwt = require("jsonwebtoken");
const config = require("./utils/config");
const pool = require("./utils/db");

let socketUserMap = {}; // uid → socket.id

function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("NO_AUTH"));

    try {
      const decoded = jwt.verify(token, config.SECRET);
      socket.uid = decoded.uid;
      next();
    } catch {
      next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket) => {
    const uid = socket.uid;
    socketUserMap[uid] = socket.id;

    socket.on("private_message", ({ to_token, message }) => {
      let decoded;
      try {
        decoded = jwt.verify(to_token, config.SECRET);
      } catch {
        return socket.emit("error", { message: "Invalid receiver token" });
      }

      const receiver_uid = decoded.uid;

      const matchSQL = `
        SELECT 1 FROM matches
        WHERE (user_a = ? AND user_b = ?)
           OR (user_a = ? AND user_b = ?)
        LIMIT 1
      `;

      pool.query(matchSQL, [uid, receiver_uid, receiver_uid, uid], (err, rows) => {
        if (err || rows.length === 0)
          return socket.emit("error", { message: "Users not matched" });

        pool.query(
          `INSERT INTO messages (sender_id, receiver_id, message)
           VALUES (?, ?, ?)`,
          [uid, receiver_uid, message]
        );

        const payload = {
          from: uid,
          message,
          timestamp: new Date()
        };

        if (socketUserMap[receiver_uid]) {
          io.to(socketUserMap[receiver_uid]).emit("private_message", payload);
        }

        socket.emit("message_sent", payload);
      });
    });

    socket.on("disconnect", () => {
      delete socketUserMap[uid];
    });
  });
}

module.exports = setupSocket;