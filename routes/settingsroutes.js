const express = require("express");
const router = express.Router();

const pool = require("../utils/db");
const bcrypt = require("bcrypt");
const config = require("../utils/config");
const result = require("../utils/result");
const jwt = require("jsonwebtoken");

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

router.post("/report", (req, res) => {
  const reporter_id = req.headers.uid;  // middleware extracts from token
  const { reported_id, reason_id, reason_custom } = req.body;
  console.log(reported_id, reason_id, reporter_id)
  let reported_id_derived
  try {
    reported_id_derived = jwt.verify(reported_id, config.SECRET).uid;
  } catch (err) {
    console.log(err)
    return res.send(result.createResult("Invalid token"));
  }

  const sql = `
  INSERT INTO report (reporter_id, reported_id, reason_id, reason_custom)
  VALUES (?, ?, ?, ?)
  `;

  const params = [
    reporter_id,
    reported_id_derived,
    reason_id,
    reason_id === 99 ? reason_custom : null,
  ];

  pool.query(sql, params, (err, data) => {
    console.log(err)
    console.log(data)
    res.send(result.createResult(err, "Report Submitted Successfully"));
  });
});

router.post("/block", (req, res) => {
  const blocker_id = req.headers.uid; // decoded in middleware
  const { blocked_id } = req.body;

  if (!blocked_id)
    return res.send(result.createResult("blocked_id is required"));

  let blocked_uid;

  try {
    blocked_uid = jwt.verify(blocked_id, config.SECRET).uid;
  } catch (err) {
    return res.send(result.createResult("Invalid token"));
  }

  if (blocked_uid == blocker_id)
    return res.send(result.createResult("You cannot block yourself"));

  const checkSQL = `
    SELECT * FROM blockedusers WHERE blocker_id = ? AND blocked_id = ? AND is_deleted = 0
  `;

  pool.query(checkSQL, [blocker_id, blocked_uid], (err, rows) => {
    console.log(err)
    if (err) return res.send(result.createResult(err));

    if (rows.length > 0) {
      return res.send(result.createResult(null, "User already blocked"));
    }

    const insertSQL = `
      INSERT INTO blockedusers (blocker_id, blocked_id)
      VALUES (?, ?)
    `;

    pool.query(insertSQL, [blocker_id, blocked_uid], (err, data) => {

      return res.send(result.createResult(err, "User Blocked Successfully"));
    });
  });
});

router.get("/blocked-list", (req, res) => {
  const blocker_id = req.headers.uid;

  const sql = `
    SELECT 
    b.block_id,
    b.blocked_id,
    u.user_name,
    u.uid,
    b.blocked_at,
    p.photo_url
FROM blockedusers b
JOIN users u 
    ON b.blocked_id = u.uid
LEFT JOIN userphotos p 
    ON p.uid = u.uid 
    AND p.is_primary = 1 
    AND p.is_deleted = 0
WHERE b.blocker_id = ?
  AND b.is_deleted = 0
ORDER BY b.blocked_at DESC;

  `;

  pool.query(sql, [blocker_id], (err, data) => {
    return res.send(result.createResult(err, data));
  });
});

router.delete("/unblock/:id", (req, res) => {
  const blocker_id = req.headers.uid;
  const blocked_uid = req.params.id;

  const sql = `
    UPDATE blockedusers
    SET is_deleted = 1
    WHERE blocker_id = ? AND blocked_id = ?
  `;

  pool.query(sql, [blocker_id, blocked_uid], (err, data) => {
    if (err) return res.send(result.createResult(err));

    return res.send(result.createResult(null, "User Unblocked Successfully"));
  });
});




module.exports = router;
