const express = require("express");
const pool = require("../utils/db");
const result = require("../utils/result");
const jwt = require("jsonwebtoken");
const config = require("../utils/config");

const router = express.Router();

// token builder
const signCandidateToken = (uid) =>
    jwt.sign({ uid }, config.SECRET, { expiresIn: "24h" });

router.get("/chat/list", (req, res) => {
    const uid = req.headers.uid;

    const sql = `
SELECT 
  u.uid,
  up.dob,
  u.user_name,

  -- return ONLY is_primary = 1 photo
  p.photo_url,

  lm.message AS last_message,
  lm.timestamp AS last_time
FROM matches m
JOIN users u
  ON (u.uid = m.user_a OR u.uid = m.user_b)

-- primary photo join
LEFT JOIN (
    SELECT uid, photo_url 
    FROM userphotos
    WHERE is_primary = 1
) AS p 
ON p.uid = u.uid

LEFT JOIN userprofile up 
 ON up.uid = u.uid

LEFT JOIN (
    SELECT 
        t.otherId,
        t.message,
        t.timestamp
    FROM (
        SELECT 
            IF(sender_id = ?, receiver_id, sender_id) AS otherId,
            message,
            timestamp,
            ROW_NUMBER() OVER(
                PARTITION BY IF(sender_id = ?, receiver_id, sender_id)
                ORDER BY timestamp DESC
            ) AS rn
        FROM messages
        WHERE sender_id = ? OR receiver_id = ?
    ) t
    WHERE t.rn = 1
) AS lm
ON lm.otherId = u.uid

WHERE u.uid != ?
AND (m.user_a = ? OR m.user_b = ?);
`;

    pool.query(sql, [uid, uid, uid, uid, uid, uid, uid], (err, rows) => {
        if (err) return res.send(result.createResult(err));

        const finalList = rows.map((r) => ({
            ...r,
            token: signCandidateToken(r.uid),
            uid: undefined,
        }));

        res.send(result.createResult(null, finalList));
    });
});


router.post("/history", (req, res) => {
    const myUid = req.headers.uid;
    const token = req.body.token;

    let otherUid;
    try {
        otherUid = jwt.verify(token, config.SECRET).uid;
    } catch {
        return res.send(result.createResult("Invalid token"));
    }

    const sql = `
    SELECT sender_id, receiver_id, message, timestamp
    FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY timestamp ASC
  `;

    pool.query(sql, [myUid, otherUid, otherUid, myUid], (err, rows) => {
        if (err) return res.send(result.createResult(err));

        const formatted = rows.map((msg) => ({
            incoming: msg.sender_id === otherUid,
            message: msg.message,
            timestamp: msg.timestamp,
        }));

        res.send(result.createResult(null, formatted));
    });
});

module.exports = router;
