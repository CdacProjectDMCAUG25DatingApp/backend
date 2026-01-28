const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../utils/db");
const result = require("../utils/result");
const config = require("../utils/config");

const router = express.Router();

/* ============================================================
   SQL: FULL USER DETAILS JOIN
============================================================ */
const FULL_USER_DETAILS_SQL = `
SELECT
  u.uid,
  u.user_name,
  u.email,
  u.phone_number,

  -- Profile table
  up.bio,
  up.dob,
  up.height,
  up.weight,
  up.tagline,
  up.location,
  up.gender,
  up.religion,
  up.mother_tongue,
  up.marital_status,
  up.education,
  up.job_industry_id,

  -- Preferences table
  pref.preferred_gender_id,
  pref.looking_for_id,
  pref.open_to_id,
  pref.zodiac_id,
  pref.family_plan_id,
  pref.education_id,
  pref.communication_style_id,
  pref.love_style_id,
  pref.drinking_id,
  pref.smoking_id,
  pref.workout_id,
  pref.dietary_id,
  pref.sleeping_habit_id,
  pref.religion_id,
  pref.personality_type_id,
  pref.pet_id

FROM users u
LEFT JOIN userprofile up 
    ON up.uid = u.uid AND up.is_deleted = 0

LEFT JOIN userpreferences pref 
    ON pref.uid = u.uid AND pref.is_deleted = 0

WHERE u.uid = ?;
`;

/* ============================================================
   📌 SIGNUP
============================================================ */
router.post("/signup", (req, res) => {
    const { name, email, password, mobile } = req.body;

    if (!name || !email || !password || !mobile)
        return res.send(result.createResult("All fields required"));

    bcrypt.hash(password, config.SALT_ROUND, (err, hashed) => {
        if (err) return res.send(result.createResult(err));

        const sql = `
            INSERT INTO users (user_name, email, password, mobile)
            VALUES (?, ?, ?, ?)
        `;

        pool.query(sql, [name, email, hashed, mobile], (err, data) => {
            res.send(result.createResult(err, data));
        });
    });
});

/* ============================================================
   🔥 SIGNIN → RETURN token + user's full details + photos
============================================================ */
router.post("/signin", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.send(result.createResult("Email and password required"));

    const sql = `SELECT * FROM users WHERE email = ?`;

    pool.query(sql, [email], (err, users) => {
        if (err) return res.send(result.createResult(err));
        if (users.length === 0)
            return res.send(result.createResult("Invalid Email"));

        const user = users[0];

        bcrypt.compare(password, user.password, (err, ok) => {
            if (!ok) return res.send(result.createResult("Invalid Password"));

            const uid = user.uid;

            // JWT contains uid — secure
            const token = jwt.sign({ uid }, config.SECRET, { expiresIn: "30d" });

            // Basic user (NO UID exposed)
            const publicUser = {
                token,
                name: user.user_name,
                email: user.email,
                mobile: user.mobile,
            };

            /* -----------------------------------------------------
               FETCH FULL USER DETAILS + PHOTOS + ONBOARD FLAGS
            ------------------------------------------------------ */
            const photosSQL = `
                SELECT photo_id, photo_url, prompt, is_primary
                FROM userphotos
                WHERE uid = ? AND is_approved = 1
                ORDER BY 
                    CASE WHEN is_primary = 1 THEN 0
                         WHEN is_primary = 2 THEN 1
                         ELSE 2 END,
                    uploaded_at ASC;
            `;

            const profileCheckSQL = `
                SELECT COUNT(*) AS count
                FROM userprofile
                WHERE uid = ? AND is_deleted = 0
            `;

            const prefCheckSQL = `
                SELECT COUNT(*) AS count
                FROM userpreferences
                WHERE uid = ? AND is_deleted = 0
            `;

            const photosCountSQL = `
                SELECT COUNT(*) AS total
                FROM userphotos 
                WHERE uid = ? AND is_approved = 1
            `;

            // Run queries
            pool.query(FULL_USER_DETAILS_SQL, [uid], (err1, userDetailsRows) => {
                pool.query(photosSQL, [uid], (err2, photosRows) => {
                    pool.query(profileCheckSQL, [uid], (err3, p1) => {
                        pool.query(prefCheckSQL, [uid], (err4, p2) => {
                            pool.query(photosCountSQL, [uid], (err5, p3) => {

                                const fullDetails = userDetailsRows[0] || {};
                                const photos = photosRows || [];

                                const hasProfile = p1[0].count > 0;
                                const hasPreferences = p2[0].count > 0;
                                const hasPhotos = p3[0].total === 6;

                                return res.send(
                                    result.createResult(null, {
                                        ...publicUser,      // token, name, etc.
                                        userdetails: fullDetails,  // full joined data
                                        photos: photos,             // photo array
                                        onboarding: {
                                            needs_profile: !hasProfile,
                                            needs_photos: !hasPhotos,
                                            needs_preferences: !hasPreferences
                                        }
                                    })
                                );
                            });
                        });
                    });
                });
            });
        });
    });
});
module.exports = router;


/* ============================================================
   📌 GET full userdetails (JOINED)
============================================================ */
router.get("/userdetails", (req, res) => {
    const uid = req.headers.uid;

    pool.query(FULL_USER_DETAILS_SQL, [uid], (err, data) => {
        return res.send(result.createResult(err, data?.[0]));
    });
});

/* ============================================================
   📌 PUT userdetails → UPDATE PROFILE & PREFERENCES TOGETHER
============================================================ */
router.put("/userdetails", (req, res) => {
    const uid = req.headers.uid;
    const payload = req.body;

    if (!uid) return res.send(result.createResult("UID missing"));
    if (!Object.keys(payload).length)
        return res.send(result.createResult("No fields to update"));

    // Maps frontend fields → database column names
    const PROFILE_MAP = {
        bio: "bio",
        dob: "dob",
        height: "height",
        weight: "weight",
        tagline: "tagline",
        location: "location",
        gender: "gender",
        religion: "religion",
        mother_tongue: "mother_tongue",
        marital_status: "marital_status",
        education: "education",
        job_industry_id: "job_industry_id",
    };

    const PREF_MAP = {
        preferred_gender_id: "preferred_gender_id",
        looking_for_id: "looking_for_id",
        open_to_id: "open_to_id",
        zodiac_id: "zodiac_id",
        family_plan_id: "family_plan_id",
        education_id: "education_id",
        communication_style_id: "communication_style_id",
        love_style_id: "love_style_id",
        drinking_id: "drinking_id",
        smoking_id: "smoking_id",
        workout_id: "workout_id",
        dietary_id: "dietary_id",
        sleeping_habit_id: "sleeping_habit_id",
        religion_id: "religion_id",
        personality_type_id: "personality_type_id",
        pet_id: "pet_id",
    };

    const profileUpdates = [];
    const profileValues = [];

    const prefUpdates = [];
    const prefValues = [];

    // Split fields into correct table
    for (const [key, value] of Object.entries(payload)) {
        if (PROFILE_MAP[key]) {
            profileUpdates.push(`${PROFILE_MAP[key]} = ?`);
            profileValues.push(value);
        }
        if (PREF_MAP[key]) {
            prefUpdates.push(`${PREF_MAP[key]} = ?`);
            prefValues.push(value);
        }
    }

    const tasks = [];

    if (profileUpdates.length) {
        tasks.push(
            new Promise((resolve) => {
                const sql = `
          UPDATE userprofile
          SET ${profileUpdates.join(", ")}
          WHERE uid = ? AND is_deleted = 0
        `;
                pool.query(sql, [...profileValues, uid], () => resolve());
            })
        );
    }

    if (prefUpdates.length) {
        tasks.push(
            new Promise((resolve) => {
                const sql = `
          UPDATE userpreferences
          SET ${prefUpdates.join(", ")}
          WHERE uid = ? AND is_deleted = 0
        `;
                pool.query(sql, [...prefValues, uid], () => resolve());
            })
        );
    }

    // Return updated userdetails
    Promise.all(tasks).then(() => {
        pool.query(FULL_USER_DETAILS_SQL, [uid], (err, data) => {
            return res.send(result.createResult(err, data?.[0]));
        });
    });
});

/* ============================================================
   📌 PATCH: Update Photo Prompt
============================================================ */
router.patch("/photo/prompt", (req, res) => {
    const uid = req.headers.uid;
    const { photo_id, prompt } = req.body;

    if (!uid || !photo_id)
        return res.send(result.createResult("Missing uid or photo_id"));

    const sql = `
        UPDATE userphotos
        SET prompt = ?
        WHERE photo_id = ? AND uid = ? AND is_deleted = 0
    `;

    pool.query(sql, [prompt, photo_id, uid], (err, data) => {
        return res.send(result.createResult(err, data));
    });
});

module.exports = router;
