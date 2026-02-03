const express = require('express')

const pool = require('../../utils/db')
const result = require('../../utils/result')
const config = require('../../utils/config')
const jwt = require('jsonwebtoken')

const router = express.Router()

const FULL_USER_DETAILS_SQL = `
SELECT
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

router.get("/getcandidates", async (req, res) => {
  const uid = Number(req.headers.uid);
  if (!uid) return res.send(result.createResult("UID required"));

  try {
    // 1. Fetch current user’s preferred gender
    const [[selfPref]] = await pool.promise().query(
      `SELECT preferred_gender_id 
       FROM userpreferences 
       WHERE uid = ? AND is_deleted = 0`,
      [uid]
    );

    if (!selfPref || !selfPref.preferred_gender_id)
      return res.send(result.createResult("Preferred gender not set"));

    const preferredGender = selfPref.preferred_gender_id;

    // 2. Fetch candidates (ONLY required fields)
    const candidateSql = `
      SELECT 
        u.uid,
        u.user_name AS name,
        up.tagline,
        up.dob,
        up.location,
        up.gender,
        g.name AS gender_name,

        pref.looking_for_id,
        pref.open_to_id,
        pref.zodiac_id,
        pref.family_plan_id,
        pref.communication_style_id,
        pref.love_style_id,
        pref.drinking_id,
        pref.workout_id,
        pref.dietary_id,
        pref.sleeping_habit_id,
        pref.personality_type_id,
        pref.pet_id,
        up.education,
        up.religion,
        up.mother_tongue,
        up.job_industry_id

      FROM users u
      LEFT JOIN userprofile up ON up.uid = u.uid AND up.is_deleted = 0
      LEFT JOIN userpreferences pref ON pref.uid = u.uid AND pref.is_deleted = 0
      LEFT JOIN gender g ON up.gender = g.id

      WHERE u.uid != ?
        AND up.gender = ?
        AND u.is_deleted = 0
        AND u.is_banned = 0

        -- exclude swiped
        AND NOT EXISTS (
          SELECT 1 FROM swipes s 
          WHERE s.swiper_user_id = ? 
            AND s.swiped_user_id = u.uid
        )

        -- exclude matches
        AND NOT EXISTS (
          SELECT 1 FROM matches m
           WHERE (m.user_a = ? AND m.user_b = u.uid)
              OR (m.user_b = ? AND m.user_a = u.uid)
        )

        -- exclude blocked
        AND NOT EXISTS (
          SELECT 1 FROM blockedusers b
          WHERE b.blocker_id = ? 
            AND b.blocked_id = u.uid 
            AND b.is_deleted = 0
        )

        AND NOT EXISTS (
          SELECT 1 FROM blockedusers b2
          WHERE b2.blocker_id = u.uid
            AND b2.blocked_id = ?
            AND b2.is_deleted = 0
        )
    `;

    const params = [uid, preferredGender, uid, uid, uid, uid, uid];
    const [candidates] = await pool.promise().query(candidateSql, params);

    if (!candidates.length)
      return res.send(result.createResult(null, []));

    const candidateIds = candidates.map(c => c.uid);

    // 3. Fetch one photo (primary)
    const [photos] = await pool.promise().query(
      `SELECT uid, photo_url 
       FROM userphotos 
       WHERE uid IN (?) AND is_primary = 2`,
      [candidateIds]
    );

    const photoMap = {};
    photos.forEach(p => photoMap[p.uid] = p.photo_url);

    // 4. Fetch current user preferences for scoring
    const self = await getSelf(uid);

    // 5. Build final response
    const scoredCandidates = candidates.map(c => {
      const { score, match_interests_count } = calculateScore(self, c);

      return {
        user_name: c.name,
        tagline: c.tagline,
        gender: c.gender_name,
        location: c.location,
        age: c.dob ? getAge(c.dob) : null,

        score,
        match_interests_count,
        photo: photoMap[c.uid] || null,
        token: signCandidateToken(c.uid)
      };
    }).sort((a, b) => b.score - a.score);

    res.send(result.createResult(null, scoredCandidates));

  } catch (err) {
    console.error(err);
    res.send(result.createResult(err));
  }
});

function getAge(d) {
  const dob = new Date(d);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}



const signCandidateToken = (uid) => {     //uid in recommended candidate must not be passed as it is so converting it into token
  return jwt.sign(
    { uid },
    config.SECRET,
    { expiresIn: '24h' }   // candidates tokens should be short-lived
  )
}

function calculateScore(self, candidate) {   //Calculating the score according to which candidates are to be recommended
  let score = 0
  let match_interests_count = 0

  const WEIGHTS = {
    looking_for_id: 8,
    open_to_id: 5,
    zodiac_id: 5,
    education: 5,
    family_plan_id: 3,
    communication_style_id: 7,
    love_style_id: 7,
    drinking_id: 5,
    workout_id: 5,
    dietary_id: 5,
    sleeping_habit_id: 3,
    religion: 14,
    personality_type_id: 5,
    pet_id: 3,
    mother_tongue: 5,
    job_industry_id: 8,
    interests: 5,
    languages: 4
  }

  const directFields = [
    "looking_for_id",
    "open_to_id",
    "zodiac_id",
    "family_plan_id",
    "communication_style_id",
    "love_style_id",
    "drinking_id",
    "workout_id",
    "dietary_id",
    "sleeping_habit_id",
    "personality_type_id",
    "pet_id",
    "education",
    "religion",
    "mother_tongue",
    "job_industry_id"
  ]

  for (const field of directFields) {
    if (
      self[field] !== null &&
      self[field] !== undefined &&
      candidate[field] !== null &&
      candidate[field] !== undefined &&
      self[field] === candidate[field]
    ) {
      match_interests_count += 1
      score += WEIGHTS[field] || 0
    }
  }

  // Interests (array intersection)
  if (
    Array.isArray(self.interests) &&
    Array.isArray(candidate.interests)
  ) {
    const commonInterests = self.interests.filter(i =>
      candidate.interests.includes(i)
    )
    match_interests_count += 1
    score += commonInterests.length * WEIGHTS.interests
  }

  if (
    Array.isArray(self.languages) &&
    Array.isArray(candidate.languages)
  ) {
    const commonLanguages = self.languages.filter(l =>
      candidate.languages.includes(l)
    )

    score += commonLanguages.length * WEIGHTS.languages
  }
  const scoreANDmatch_interests = { score, match_interests_count }
  return scoreANDmatch_interests
}

const getSelf = async (uid) => {            // Creating Object of Our Profile and Fields
  const [[self]] = await pool.promise().query(`
  SELECT
    up.gender,
    up.religion,
    up.mother_tongue,
    up.education,
    up.job_industry_id,

    pref.looking_for_id,
    pref.open_to_id,
    pref.zodiac_id,
    pref.family_plan_id,
    pref.communication_style_id,
    pref.love_style_id,
    pref.drinking_id,
    pref.workout_id,
    pref.dietary_id,
    pref.sleeping_habit_id,
    pref.personality_type_id,
    pref.pet_id
  FROM userprofile up
  LEFT JOIN userpreferences pref ON pref.uid = up.uid
  WHERE up.uid = ?
`, [uid])
  if (!self) return null

  const [selfInterests] = await pool.promise().query(
    `SELECT interest_id FROM userinterest WHERE uid = ? AND active = 1`,
    [uid]
  )

  const [selfLanguages] = await pool.promise().query(
    `SELECT language_id FROM userlanguage WHERE uid = ? AND active = 1`,
    [uid]
  )
  self.interests = selfInterests?.map(i => i.interest_id)
  self.languages = selfLanguages?.map(l => l.language_id)
  return self
}


router.get("/getcandidates_again", async (req, res) => {
  const uid = Number(req.headers.uid);
  if (!uid) return res.send(result.createResult("UID required"));

  const candidateSql = `SELECT
    u.uid,
    up.gender,
    up.religion,
    up.mother_tongue,
    up.education,
    up.job_industry_id,

    pref.looking_for_id,
    pref.open_to_id,
    pref.zodiac_id,
    pref.family_plan_id,
    pref.communication_style_id,
    pref.love_style_id,
    pref.drinking_id,
    pref.workout_id,
    pref.dietary_id,
    pref.sleeping_habit_id,
    pref.personality_type_id,
    pref.pet_id

FROM users u

JOIN userpreferences pref_self
  ON pref_self.uid = ? 
 AND pref_self.is_deleted = 0

LEFT JOIN userprofile up
  ON up.uid = u.uid
 AND up.is_active = 1
 AND up.is_deleted = 0

LEFT JOIN userpreferences pref
  ON pref.uid = u.uid
 AND pref.is_deleted = 0

WHERE u.uid != ?
  AND u.is_deleted = 0
  AND u.is_banned = 0

  -- Main gender match (NO need to pass preferred gender)
  AND up.gender = pref_self.preferred_gender_id

  -- Exclude matches
  AND NOT EXISTS (
    SELECT 1 FROM matches m
    WHERE (m.user_a = ? AND m.user_b = u.uid)
       OR (m.user_b = ? AND m.user_a = u.uid)
  )

  -- Exclude users you blocked
  AND NOT EXISTS (
    SELECT 1 FROM blockedusers b
    WHERE b.blocker_id = ?
      AND b.blocked_id = u.uid
      AND b.is_deleted = 0
  )

  AND NOT EXISTS (
        SELECT 1 FROM likes l
        WHERE l.liker_user_id = ?
          AND l.liked_user_id = u.uid
    )

    AND NOT EXISTS (
        SELECT 1 FROM likes lm
        WHERE (
                lm.liker_user_id = ?
            AND lm.liked_user_id = u.uid
            AND lm.is_match = 1
        ) OR (
                lm.liker_user_id = u.uid
            AND lm.liked_user_id = ?
            AND lm.is_match = 1
        )
    )

  -- Exclude users who blocked you
  AND NOT EXISTS (
    SELECT 1 FROM blockedusers b2
    WHERE b2.blocker_id = u.uid
      AND b2.blocked_id = ?
      AND b2.is_deleted = 0
  );

`

  const interestSql = `
SELECT uid, interest_id
FROM userinterest
WHERE active = 1 AND uid IN (?)
`

  const languageSql = `
SELECT uid, language_id
FROM userlanguage
WHERE active = 1 AND uid IN (?)
`


  try {
    // 1. Get all possible candidates (reusing your logic)
    const params = [
      uid, uid, uid, uid, uid,
      uid, uid, uid, uid
    ];

    const [candidates] = await pool.promise().query(candidateSql, params);
    if (!candidates.length)
      return res.send(result.createResult(null, []));

    const candidateIds = candidates.map(u => u.uid);

    // 2. Interests
    const [interests] = await pool.promise().query(interestSql, [candidateIds]);
    const interestMap = {};
    interests.forEach(i => {
      interestMap[i.uid] ??= [];
      interestMap[i.uid].push(i.interest_id);
    });

    // 3. Languages
    const [languages] = await pool.promise().query(languageSql, [candidateIds]);
    const languageMap = {};
    languages.forEach(l => {
      languageMap[l.uid] ??= [];
      languageMap[l.uid].push(l.language_id);
    });

    // 4. Add interests + languages
    const finalCandidates = candidates.map(u => ({
      ...u,
      interests: interestMap[u.uid] || [],
      languages: languageMap[u.uid] || []
    }));

    // 5. Scoring
    const self = await getSelf(uid);
    if (!self) return res.send(result.createResult(null, []));

    const calculatedCandidates = finalCandidates
      .map(c => {
        const { score, match_interests_count } = calculateScore(self, c);
        return {
          uid: c.uid,
          score,
          match_interests_count
        };
      })
      .sort((a, b) => b.score - a.score);

    const sortedIds = calculatedCandidates.map(c => c.uid);

    // 6. Profile fetch (with gender name)
    const [profileRows] = await pool.promise().query(
      `
      SELECT 
        u.uid,
        u.user_name AS name,
        up.tagline,
        up.dob,
        up.location,
        g.name AS gender_name
      FROM users u
      LEFT JOIN userprofile up ON up.uid = u.uid AND up.is_deleted = 0
      LEFT JOIN gender g ON up.gender = g.id
      WHERE u.uid IN (?)
      `,
      [sortedIds]
    );

    // 7. Photos
    const [photos] = await pool.promise().query(
      `
      SELECT uid, photo_url 
      FROM userphotos
      WHERE uid IN (?) 
      ORDER BY is_primary DESC
      `,
      [sortedIds]
    );

    const photoMap = {};
    photos.forEach(p => {
      if (!photoMap[p.uid]) photoMap[p.uid] = [];
      photoMap[p.uid].push(p.photo_url);
    });

    // 8. Final mapping (same as first API)
    const response = calculatedCandidates.map(c => {
      const p = profileRows.find(x => x.uid === c.uid) || {};

      return {
        user_name: p.name || "",
        tagline: p.tagline || "",
        gender: p.gender_name || null,
        location: p.location || "",
        age: p.dob ? getAge(p.dob) : null,
        score: c.score,
        match_interests_count: c.match_interests_count,
        photo: photoMap[c.uid]?.[0] || null,
        token: signCandidateToken(c.uid)
      };
    });

    res.send(result.createResult(null, response));

  } catch (err) {
    console.error(err);
    res.send(result.createResult(err));
  }
});


router.get("/getcandidate_full", async (req, res) => {
  try {
    const token = req.headers.candidate_token;
    if (!token) return res.send(result.createResult("Candidate token missing"));

    // decode the candidate token
    let decoded;
    try {
      decoded = jwt.verify(token, config.SECRET);
    } catch (err) {
      return res.send(result.createResult("Invalid token"));
    }

    const candidateUid = decoded.uid;

    // 1. fetch full user details
    const [profileRows] = await pool
      .promise()
      .query(FULL_USER_DETAILS_SQL, [candidateUid]);

    if (!profileRows.length) {
      return res.send(result.createResult("User not found"));
    }

    const profileData = {...profileRows[0],token};

    // 2. fetch photos
    const [photoRows] = await pool.promise().query(
      `SELECT photo_id, photo_url, prompt, is_primary
       FROM userphotos
       WHERE uid = ?
       ORDER BY is_primary DESC`,
      [candidateUid]
    );

    return res.send(
      result.createResult(null, {
        profileData,
        photos: photoRows,
      })
    );
  } catch (err) {
    console.log(err);
    return res.send(result.createResult(err));
  }
});


module.exports = router;

