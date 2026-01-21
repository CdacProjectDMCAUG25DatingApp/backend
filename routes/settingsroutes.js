const express = require("express");
const router = express.Router();

const pool = require("../utils/db");
const bcrypt = require("bcrypt");
const config = require("../utils/config");
const result = require("../utils/result");

// ==========================
// CHANGE PASSWORD
// ==========================
router.put("/change-password", (req, res) => {
  const uid = req.headers.uid;  // UID is already decoded in middleware
  const { oldPassword, newPassword } = req.body;

  const sql = "SELECT password FROM users WHERE uid = ?";
  pool.query(sql, [uid], (err, data) => {
      if (err) return res.send(result.createResult(err));
      
      if (data.length === 0)
        return res.send(result.createResult("User not found"));
    
    // Compare old password
    bcrypt.compare(oldPassword, data[0].password, (err, match) => {
        if (err) return res.send(result.createResult(err));
        
        if (!match)
            return res.send(result.createResult("Old password incorrect"));
        
        // Hash new password
        bcrypt.hash(newPassword, config.SALT_ROUND, (err, hashed) => {
            if (err) return res.send(result.createResult(err));
            
            const updateSQL = "UPDATE users SET password = ? WHERE uid = ?";
            pool.query(updateSQL, [hashed, uid], (err, data) => {
            console.log(data)
          return res.send(result.createResult(err, "Password updated successfully"));
        });
      });
    });
  });
});

// ==========================
// SEND FEEDBACK
// ==========================
router.post("/send-feedback", (req, res) => {
  const uid = req.headers.uid;
  const { subject, details } = req.body;

  const sql = `
    INSERT INTO feedback (user_id, subject, details)
    VALUES (?, ?, ?)
  `;

  pool.query(sql, [uid, subject, details], (err, data) => {
    return res.send(result.createResult(err, "Feedback submitted"));
  });
});

module.exports = router;
