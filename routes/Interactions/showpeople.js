const express = require('express')

const pool = require('../../utils/db')
const result = require('../../utils/result')
const config = require('../../utils/config')
const jwt = require('jsonwebtoken')

const router = express.Router()



router.get("/getcandidates", async (req, res) => {
  const uid = Number(req.headers.uid);
  if (!uid) return res.send(result.createResult("UID required"));

  try {
    // 1️⃣ Get CURRENT USER'S preferred gender
    const [prefRows] = await pool.promise().query(
      `SELECT preferred_gender_id 
       FROM userpreferences 
       WHERE uid = ? AND is_deleted = 0`,
      [uid]
    );

    if (!prefRows.length || !prefRows[0].preferred_gender_id) {
      return res.send(result.createResult("Preferred gender not set"));
    }

    const preferredGenderId = prefRows[0].preferred_gender_id;

    // 2️⃣ Find candidates with that gender
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
        
        -- THE MAIN GENDER MATCH FILTER
        AND up.gender = ?

        -- Exclude users already swiped, matched, or blocked
        AND NOT EXISTS (
          SELECT 1 FROM swipes s
          WHERE s.swiper_user_id = ?
          AND s.swiped_user_id = u.uid
        )

        AND NOT EXISTS (
          SELECT 1 FROM matches m
          WHERE (m.user_a = ? AND m.user_b = u.uid)
             OR (m.user_b = ? AND m.user_a = u.uid)
        )

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

    const params = [
      uid,                    // u.uid != ?
      preferredGenderId,      // MATCH: up.gender = preferred_gender_id
      uid, uid, uid, uid, uid // exclusions
    ];

    const [candidates] = await pool.promise().query(candidateSql, params);

    if (!candidates.length) {
      return res.send(result.createResult(null, []));
    }

    // 3️⃣ rest of your logic unchanged
    const candidateIds = candidates.map(u => u.uid);

    const [interests] = await pool.promise().query(
      `SELECT uid, interest_id FROM userinterest WHERE active = 1 AND uid IN (?)`,
      [candidateIds]
    );

    const [languages] = await pool.promise().query(
      `SELECT uid, language_id FROM userlanguage WHERE active = 1 AND uid IN (?)`,
      [candidateIds]
    );

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

    const self = await getSelf(uid);
    if (!self) return res.send(result.createResult(null, []));

    const calculatedCandidates = finalCandidates
      .map(c => {
        const scoring = calculateScore(self, c);
        return {
          uid: c.uid,
          score: scoring.score,
          match_interests_count: scoring.match_interests_count
        };
      })
      .sort((a, b) => b.score - a.score);

    const sortedIds = calculatedCandidates.map(c => c.uid);

    const profileJoinSql = `
SELECT
  u.uid,
  u.user_name,

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

WHERE u.uid IN (?)
`;

const [profileRows] = await pool.promise().query(profileJoinSql, [sortedIds]);


    const [photos] = await pool.promise().query(
      `SELECT uid, photo_url, prompt FROM userphotos WHERE uid IN (?) ORDER BY is_primary DESC`,
      [sortedIds]
    );

    const photoMap = {};
    photos.forEach(p => {
      photoMap[p.uid] ??= [];
      photoMap[p.uid].push({ photo_url: p.photo_url, prompt: p.prompt });
    });

    const response = calculatedCandidates.map(c => {
      const profile = profileRows.find(p => p.uid === c.uid) || {};
      const { uid, ...safeProfile } = profile;

      return {
        token: signCandidateToken(c.uid),
        score: c.score,
        match_interests_count: c.match_interests_count,
        candidateData: safeProfile,
        photos: photoMap[c.uid] || []
      };
    });

    res.send(result.createResult(null, response));

  } catch (err) {
    console.error(err);
    res.send(result.createResult(err));
  }
});


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
  const uid = Number(req.headers.uid)
  const responseSql = `
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

WHERE u.uid IN (?);
`;

  const photosSql = `
SELECT uid, photo_url , prompt
FROM userphotos
WHERE uid IN (?)
ORDER BY is_primary DESC
`


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

  -- ⭐ Main gender match (NO need to pass preferred gender)
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

    if (!uid) return res.send(result.createResult("UID required"))

    // 2. Get candidates
    const params = [
      uid, // pref_self.uid
      uid, // u.uid != ?
      uid, // swipes
      uid, uid, // matches
      uid, // blocker
      uid  // blocked
    ]
    const [candidates] = await pool.promise().query(candidateSql, params)
    if (!candidates.length) {
      return res.send(result.createResult(null, []))
    }


    const candidateIds = candidates.map(u => u.uid)
    // 3. Interests
    const [interests] = await pool.promise().query(interestSql, [candidateIds])

    // 4. Languages
    const [languages] = await pool.promise().query(languageSql, [candidateIds])

    // 5. Map interests & languages
    // Interests table has intrest = {uid,intrest_id} 
    const interestMap = {}
    interests.forEach(i => {                       // interests is from the userinterests junction table not from interests look up table
      interestMap[i.uid] ??= []                   // The Map has data as {"7": [2, 5],"9": [1]} 
      interestMap[i.uid].push(i.interest_id)     // Like a dictionary 
    })

    const languageMap = {}                  // languages is from the userlanguage junction table not from language look up table
    languages.forEach(l => {               // The Map has data as {"7": [2, 5],"9": [1]} 
      languageMap[l.uid] ??= []           // Like a dictionary 
      languageMap[l.uid].push(l.language_id)
    })
    const finalCandidates = candidates.map(u => ({
      ...u,
      interests: interestMap[u.uid] || [],      //Key are uid and value has array of interests of that userid
      languages: languageMap[u.uid] || []
    }))
    const self = await getSelf(uid)
    if (!self) {
      return res.send(result.createResult(null, []))
    }
    const calculatedCandidates = finalCandidates  // final candidates are possible people that can be seen in the application
      .map(candidate => {  //candidate is the each finalCandidate 
        const scoreANDmatch_interests_count = calculateScore(self, candidate)
        return {
          uid: candidate.uid,
          score: scoreANDmatch_interests_count.score,  //calculated score of each candidate
          match_interests_count: scoreANDmatch_interests_count.match_interests_count
        }
      })
      .sort((a, b) => b.score - a.score)        // sorted based on that score descendingly 


    //sorted Ids are id taken out of calculatedCandidates( {uid: value , score : value} )  
    const sortedIds = calculatedCandidates.map(c => c.uid)  //calculatedCandidates( {uid: value , score : value} )  are uid and calculated score to final candidates
    const [responseSqlResult] = await pool.promise().query(responseSql, [sortedIds])
    const [photos] = await pool.promise().query(photosSql, [sortedIds])
    const photoMap = {}
    photos.forEach(p => {
      photoMap[p.uid] ??= []
      photoMap[p.uid].push({ photo_url: p.photo_url, prompt: p.prompt })
    })
    const response = calculatedCandidates.map(c => {     //Create the response as array of candidates(objects{token(string),score(int),candidateData{},photos[]})

      const profileOfEachCandidate = responseSqlResult.find(p => p.uid === c.uid) || {} // taking profile from profile table that matches uid from calculatedProfile
      const { uid, ...safeProfileOfEachCandidate } = profileOfEachCandidate
      return {
        token: signCandidateToken(c.uid),
        score: c.score,
        match_interests_count: c.match_interests_count,
        candidateData: safeProfileOfEachCandidate,
        photos: photoMap[c.uid] || []
      }

    })
    res.send(result.createResult(null, response))
  } catch (err) {
   
    res.send(result.createResult(err))
  }
})



module.exports = router