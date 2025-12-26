const express = require('express')

const pool = require('../../utils/db')
const result = require('../../utils/result')

const router = express.Router()


const WEIGHTS = {
    looking_for_id: 6,
    open_to_id: 4,
    zodiac_id: 4,
    education: 4,
    family_plan_id: 2,
    communication_style_id: 5,
    love_style_id: 5,
    drinking_id: 4,
    workout_id: 4,
    dietary_id: 4,
    sleeping_habit_id: 2,
    religion: 10,
    personality_type_id: 4,
    pet_id: 2,
    mother_tongue: 4,
    job_industry_id: 6,
    interests: 7,
    languages: 7
};
router.get("/getcandidates", async (req, res) => {
    const candidateSql = `
SELECT
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
JOIN userprofile up 
  ON up.uid = u.uid

LEFT JOIN userpreferences pref 
  ON pref.uid = u.uid          

JOIN userpreferences pref_self
  ON pref_self.uid = ?          

WHERE u.uid != ?
AND u.is_deleted = 0
AND u.is_banned = 0
AND up.is_active = 1
AND up.is_deleted = 0

AND (
  pref_self.preferred_gender_id = 3
  OR up.gender = pref_self.preferred_gender_id
)

AND u.uid NOT IN (
  SELECT swiped_user_id
  FROM swipes
  WHERE swiper_user_id = ?
)

AND u.uid NOT IN (
  SELECT IF(user_a = ?, user_b, user_a)
  FROM matches
  WHERE user_a = ? OR user_b = ?
)

AND u.uid NOT IN (
  SELECT blocked_id
  FROM blockedusers
  WHERE blocker_id = ? AND is_deleted = 0
)
AND u.uid NOT IN (
  SELECT blocker_id
  FROM blockedusers
  WHERE blocked_id = ? AND is_deleted = 0
)`

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
        const uid = Number(req.headers.uid)

        if (!uid) return res.send(result.createResult("UID required"));

        // 1. Get preferred gender
        const [[prefRow]] = await pool.promise().query(
            `SELECT gender FROM userprofile WHERE uid = ?`,
            [uid]
        );

        const preferredGender = prefRow.gender;

        // 2. Get candidates
        const params = [
            uid,   // pref_self.uid
            uid,   // u.uid != ?
            uid,   // swiper_user_id
            uid, uid, uid, // matches
            uid,   // blocker_id
            uid    // blocked_id
        ];


        const [candidates] = await pool.promise().query(candidateSql, params);

        if (!candidates.length) {
            return res.send(result.createSuccess(null, []));
        }

        const candidateIds = candidates.map(u => u.uid);

        // 3. Interests
        const [interests] = await pool.promise().query(interestSql, [candidateIds]);

        // 4. Languages
        const [languages] = await pool.promise().query(languageSql, [candidateIds]);

        // 5. Map interests & languages
        const interestMap = {};
        interests.forEach(i => {
            interestMap[i.uid] ??= [];
            interestMap[i.uid].push(i.interest_id);
        });

        const languageMap = {};
        languages.forEach(l => {
            languageMap[l.uid] ??= [];
            languageMap[l.uid].push(l.language_id);
        });

        const finalCandidates = candidates.map(u => ({
            ...u,
            interests: interestMap[u.uid] || [],
            languages: languageMap[u.uid] || []
        }));

        res.send(result.createResult(null, finalCandidates));
    } catch (err) {
        res.send(result.createResult(err));
    }
})

module.exports = router