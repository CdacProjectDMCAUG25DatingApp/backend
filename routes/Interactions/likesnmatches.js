const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const pool = require('../../utils/db')
const result = require('../../utils/result')
const config = require('../../utils/config')

const router = express.Router()

const signCandidateToken = (uid) => {     //uid in recommended candidate must not be passed as it is so converting it into token
    return jwt.sign(
        { uid },
        config.SECRET,
        { expiresIn: '24h' }   // candidates tokens should be short-lived
    )
}

router.get("/likes/liked-you", (req, res) => {
    const uid = req.headers.uid;

    const sql = `
        SELECT 
            u.uid,
            u.user_name,
            g.name AS gender,
            up.dob,
            up.tagline,
            p.photo_url
        FROM likes l
        JOIN users u ON u.uid = l.liker_user_id
        LEFT JOIN userprofile up ON up.uid = u.uid
        LEFT JOIN gender g ON g.id = up.gender
        LEFT JOIN userphotos p ON p.uid = u.uid AND p.is_primary = 1
        WHERE l.liked_user_id = ?
          AND l.is_match = 0
          AND u.is_deleted = 0
          AND l.liker_user_id NOT IN (
              SELECT liked_user_id 
              FROM likes 
              WHERE liker_user_id = ?
          )
    `;

    pool.query(sql, [uid, uid], (err, rows) => {
        if (err) {
            return res.send(result.createResult(err));
        }

        // convert uid → token and hide raw uid
        const updated = rows.map(row => ({
            ...row,
            token: signCandidateToken(row.uid),
            uid: undefined
        }));

        res.send(result.createResult(null, updated));
    });
});

router.get("/like/likeduserphotos", (req, res) => {
    const token = req.headers.token;

    if (!token) {
        return res.send(result.createResult("Token missing"));
    }

    let decoded;
    try {
        decoded = jwt.verify(token, config.SECRET);
    } catch (err) {
        return res.send(result.createResult("Invalid or expired token"));
    }

    const uid = decoded.uid;

    const sql = `
        SELECT photo_id, photo_url, prompt
        FROM userphotos
        WHERE uid = ? AND is_approved = 1 AND is_deleted = 0
    `;

    pool.query(sql, [uid], (err, data) => {
        res.send(result.createResult(err, data));
    });
});


router.get("/like/likeduserdetails", (req, res) => {
    const token = req.headers.token;

    if (!token) {
        return res.send(result.createResult("Token missing"));
    }

    let decoded;
    try {
        decoded = jwt.verify(token, config.SECRET);
    } catch (err) {
        return res.send(result.createResult("Invalid or expired token"));
    }

    const uid = decoded.uid;

    const sql = `
SELECT
  u.uid,
  u.user_name,

  -- profile
  g.name AS gender,
  r.name AS religion,
  lang.name AS mother_tongue,
  edu.name AS education,
  ji.name AS job_industry,
  up.bio,
  up.dob,
  up.height,
  up.weight,
  up.tagline,
  up.location,

  -- preferences
  pg.name AS preferred_gender,
  lf.name AS looking_for,
  ot.name AS open_to,
  z.name AS zodiac,
  fp.name AS family_plan,
  cs.name AS communication_style,
  ls.name AS love_style,
  dr.name AS drinking,
  sm.name AS smoking,
  wo.name AS workout,
  di.name AS dietary,
  sh.name AS sleeping_habit,
  pt.name AS personality_type,
  p.name AS pet
FROM users u
LEFT JOIN userprofile up ON up.uid = u.uid AND up.is_deleted = 0
LEFT JOIN userpreferences pref ON pref.uid = u.uid AND pref.is_deleted = 0

LEFT JOIN gender g ON up.gender = g.id
LEFT JOIN religion r ON up.religion = r.id
LEFT JOIN language lang ON up.mother_tongue = lang.id
LEFT JOIN education edu ON up.education = edu.id
LEFT JOIN jobindustry ji ON up.job_industry_id = ji.id

LEFT JOIN gender pg ON pref.preferred_gender_id = pg.id
LEFT JOIN lookingfor lf ON pref.looking_for_id = lf.id
LEFT JOIN opento ot ON pref.open_to_id = ot.id
LEFT JOIN zodiac z ON pref.zodiac_id = z.id
LEFT JOIN familyplans fp ON pref.family_plan_id = fp.id
LEFT JOIN communicationstyle cs ON pref.communication_style_id = cs.id
LEFT JOIN lovestyle ls ON pref.love_style_id = ls.id
LEFT JOIN drinking dr ON pref.drinking_id = dr.id
LEFT JOIN smoking sm ON pref.smoking_id = sm.id
LEFT JOIN workout wo ON pref.workout_id = wo.id
LEFT JOIN dietary di ON pref.dietary_id = di.id
LEFT JOIN sleepinghabit sh ON pref.sleeping_habit_id = sh.id
LEFT JOIN personalitytype pt ON pref.personality_type_id = pt.id
LEFT JOIN pet p ON pref.pet_id = p.id

WHERE u.uid = ?;
`;

    pool.query(sql, [uid], (err, data) => {
        res.send(result.createResult(err, data?.[0]));
    });
});




router.get("/likes/matches", (req, res) => {
    const uid = req.headers.uid;

    const sql = `
        SELECT 
            u.uid,
            u.user_name,
            up.dob,
            up.tagline,
            g.name AS gender,
            p.photo_url
        FROM matches m
        JOIN users u 
            ON (u.uid = m.user_a OR u.uid = m.user_b)
        LEFT JOIN userprofile up ON up.uid = u.uid
        LEFT JOIN gender g ON g.id = up.gender
        LEFT JOIN userphotos p ON p.uid = u.uid AND p.is_primary = 1
        WHERE (m.user_a = ? OR m.user_b = ?)
          AND u.uid != ?
          AND u.is_deleted = 0
    `;

    pool.query(sql, [uid, uid, uid], (err, rows) => {
        if (err) return res.send(result.createResult(err));

        // Convert uid → token and hide uid (same as liked-you)
        const updated = rows.map(row => ({
            ...row,
            token: signCandidateToken(row.uid),
            uid: undefined
        }));

        res.send(result.createResult(null, updated));
    });
});




router.post("/likes/like", (req, res) => {
    const liker_uid = req.headers.uid;
    const userToken = req.body.token;
    const { is_super_like } = req.body;

    if (!liker_uid || !userToken)
        return res.send(result.createResult("Invalid like data"));

    let decoded;
    try {
        decoded = jwt.verify(userToken, config.SECRET);
    } catch (err) {
        return res.send(result.createResult("Invalid candidate token"));
    }

    const liked_uid = decoded.uid;

    const userA = Math.min(liker_uid, liked_uid);
    const userB = Math.max(liker_uid, liked_uid);

    const checkReverse = `
        SELECT 1 FROM likes
        WHERE liker_user_id = ? AND liked_user_id = ?
        LIMIT 1
    `;

    const insertLike = `
        INSERT IGNORE INTO likes (liker_user_id, liked_user_id, is_super_like)
        VALUES (?, ?, ?)
    `;

    const markMatch = `
        UPDATE likes
        SET is_match = 1
        WHERE (liker_user_id = ? AND liked_user_id = ?)
           OR (liker_user_id = ? AND liked_user_id = ?)
    `;

    const insertMatch = `
        INSERT IGNORE INTO matches (user_a, user_b)
        VALUES (?, ?)
    `;

    pool.query(checkReverse, [liked_uid, liker_uid], (err, rev) => {
        if (err) return res.send(result.createResult(err));

        const matched = rev.length > 0;

        pool.query(insertLike, [liker_uid, liked_uid, is_super_like || 0], (err2) => {
            if (err2) return res.send(result.createResult(err2));

            if (!matched)
                return res.send(result.createResult(null, { match: false, liked_uid }));

            pool.query(markMatch,
                [liker_uid, liked_uid, liked_uid, liker_uid],
                (err3) => {

                    if (err3) return res.send(result.createResult(err3));

                    pool.query(insertMatch, [userA, userB], (err4) => {
                        return res.send(result.createResult(err4, { match: true, liked_uid }));
                    });
                });
        });
    });
});


router.delete("/likes/ignore", (req, res) => {
    const uid = req.headers.uid;
    const { user_to_ignore } = req.body;
    const sql = `
    DELETE FROM likes 
    WHERE liker_user_id = ? AND liked_user_id = ?
    `;

    let decoded;
    try {
        decoded = jwt.verify(user_to_ignore, config.SECRET);
    } catch (err) {
        return res.send(result.createResult("Invalid candidate token"));
    }

    const liker_user_id = decoded.uid;
    
    pool.query(sql, [liker_user_id, uid], (err, data) => {
        console.log(data)
        if (err) return res.send(result.createResult(err));

        // Return the ignored user's UID (important)
        return res.send(
            result.createResult(null, { uid: user_to_ignore })
        );
    });
});

router.get("/user/full-profile", (req, res) => {
    const target_uid = req.headers.target_uid;

    const sql = `
        SELECT 
            u.*, 
            up.*, 
            pref.*,
            ph.photo_id, ph.photo_url, ph.prompt, ph.is_primary
        FROM users u
        LEFT JOIN userprofile up ON up.uid = u.uid
        LEFT JOIN userpreferences pref ON pref.uid = u.uid
        LEFT JOIN userphotos ph ON ph.uid = u.uid
        WHERE u.uid = ? AND u.is_deleted = 0
    `;

    pool.query(sql, [target_uid], (err, data) => {
        res.send(result.createResult(err, data));
    });
});

router.delete("/matches/remove", (req, res) => {
    const mainToken = req.headers.token;     // logged in user token
    const candidateToken = req.body.token;   // candidate token (body)

    if (!mainToken) {
        return res.send(result.createResult("Missing main token"));
    }
    if (!candidateToken) {
        return res.send(result.createResult("Missing candidate token"));
    }

    let loggedUser;
    let otherUser;

    // Decode logged-in user
    try {
        loggedUser = jwt.verify(mainToken, config.SECRET).uid;
    } catch (err) {
        return res.send(result.createResult("Invalid main token"));
    }

    // Decode matched user's token
    try {
        otherUser = jwt.verify(candidateToken, config.SECRET).uid;
    } catch (err) {
        return res.send(result.createResult("Invalid candidate token"));
    }

    const cleanMatchSQL = `
        DELETE FROM matches
        WHERE (user_a = ? AND user_b = ?)
           OR (user_b = ? AND user_a = ?)
    `;

    const cleanLikeSQL = `
    DELETE FROM likes
    WHERE (liker_user_id = ? AND liked_user_id = ?)
       OR (liker_user_id = ? AND liked_user_id = ?)
    `;

    pool.query(cleanMatchSQL, [loggedUser, otherUser, loggedUser, otherUser], (err1) => {
        if (err1) return res.send(result.createResult(err1));

        pool.query(cleanLikeSQL, [loggedUser, otherUser, otherUser, loggedUser], (err2) => {
            return res.send(result.createResult(err2, { uid: otherUser }));
        });
    });
});




module.exports = router