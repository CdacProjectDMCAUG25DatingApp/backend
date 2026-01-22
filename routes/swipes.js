const express = require("express");
const router = express.Router();
const pool = require("../utils/db");
const result = require("../utils/result");
const jwt = require("jsonwebtoken");
const config = require("../utils/config");

router.post("/left", (req, res) => {
    const { swiped_token } = req.body;
    let swiped_id
    try {
        swiped_id = jwt.verify(swiped_token, config.SECRET).uid;
    } catch{
        return res.send(result.createResult("Invalid token"));
    }
    const swiper_id = req.headers.uid;
    const sql = `
    INSERT INTO swipes (swiper_user_id, swiped_user_id, swipe_direction)
    VALUES (?, ?, 0)
  `;

    pool.query(sql, [swiper_id, swiped_id], (err, data) => {
        res.send(result.createResult(err, data));
    });
});

router.post("/right", (req, res) => {
    const { swiped_token } = req.body;
    let swiped_id
    try {
        swiped_id = jwt.verify(swiped_token, config.SECRET).uid;

    } catch {
        return res.send(result.createResult("Invalid token"));
    }
    const swiper_id = req.headers.uid;
    // Step 1 — Insert swipe
    const swipeSQL = `
    INSERT INTO swipes (swiper_user_id, swiped_user_id, swipe_direction)
    VALUES (?, ?, 1)
  `;

    pool.query(swipeSQL, [swiper_id, swiped_id], (err) => {
        if (err) return res.send(result.createResult(err));

        // Step 2 — Check if the other user liked this user before
        const matchCheckSQL = `
      SELECT * FROM likes
      WHERE liker_user_id = ? AND liked_user_id = ?
    `;

        pool.query(matchCheckSQL, [swiped_id, swiper_id], (err, rows) => {
            if (err) return res.send(result.createResult(err));

            let isMatch = rows.length > 0 ? 1 : 0;

            // Step 3 — Insert like
            const likeSQL = `
        INSERT INTO likes (liker_user_id, liked_user_id, is_match)
        VALUES (?, ?, ?)
      `;

            pool.query(likeSQL, [swiper_id, swiped_id, isMatch], (err, data) => {
                if (err) return res.send(result.createResult(err));

                res.send(
                    result.createResult(null, {
                        liked: true,
                        isMatch
                    })
                );
            });
        });
    });
});

module.exports = router;
