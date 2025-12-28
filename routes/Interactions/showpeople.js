const express = require('express')

const pool = require('../../utils/db')
const result = require('../../utils/result')
const config = require('../../utils/config')
const jwt = require('jsonwebtoken')

const router = express.Router()



router.get("/getcandidates", async (req, res) => {
  const uid = Number(req.headers.uid)
  const responseSql = `
  SELECT
  u.uid,
  u.user_name,

  -- profile
  up.gender,
  up.religion,
  up.mother_tongue,
  up.education,
  up.job_industry_id,
  up.bio,
  up.dob,
  up.height,
  up.weight,

  -- preferences
  pref.preferred_gender_id,
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
  ON up.uid = u.uid AND up.is_deleted = 0
LEFT JOIN userpreferences pref 
  ON pref.uid = u.uid AND pref.is_deleted = 0

WHERE u.uid IN (?)
`
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

-- Candidate profile may not exist
LEFT JOIN userprofile up
  ON up.uid = u.uid
  AND up.is_active = 1
  AND up.is_deleted = 0

-- Candidate preferences may not exist
LEFT JOIN userpreferences pref
  ON pref.uid = u.uid

-- Current user's preferences MUST exist logically
LEFT JOIN userpreferences pref_self
  ON pref_self.uid = ?

WHERE u.uid != ?
AND u.is_deleted = 0
AND u.is_banned = 0

-- Preferred gender must exist
AND pref_self.preferred_gender_id IS NOT NULL

-- Candidate must have gender
AND up.gender IS NOT NULL

-- STRICT preferred gender match
AND up.gender = pref_self.preferred_gender_id

AND NOT EXISTS (
  SELECT 1
  FROM swipes s
  WHERE s.swiper_user_id = ?
    AND s.swiped_user_id = u.uid
)

AND NOT EXISTS (
  SELECT 1
  FROM matches m
  WHERE (m.user_a = ? AND m.user_b = u.uid)
     OR (m.user_b = ? AND m.user_a = u.uid)
)

AND NOT EXISTS (
  SELECT 1
  FROM blockedusers b
  WHERE b.blocker_id = ?
    AND b.blocked_id = u.uid
    AND b.is_deleted = 0
)

AND NOT EXISTS (
  SELECT 1
  FROM blockedusers b2
  WHERE b2.blocker_id = u.uid
    AND b2.blocked_id = ?
    AND b2.is_deleted = 0
)
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
      .map(candidate => ({  //candidate is the each finalCandidate 
        uid: candidate.uid,
        score: calculateScore(self, candidate)     //calculated score of each candidate
      }))
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
    const response = calculatedCandidates.map(c => {     //map return array of candidate in response format
      const profileOfEachCandidate = responseSqlResult.find(p => p.uid === c.uid) || {} // taking profile from profile table that matches uid from calculatedProfile
      const { uid, ...safeProfileOfEachCandidate } = profileOfEachCandidate

      return {
        token: signCandidateToken(c.uid),
        score: c.score,
        candidateData: safeProfileOfEachCandidate || [],
        photos: photoMap[c.uid] || []
      }
    })

    res.send(result.createResult(null, response))
  } catch (err) {
    res.send(result.createResult(err))
  }
})

const signCandidateToken = (uid) => {     //uid in recommended candidate must not be passed as it is so converting it into token
  return jwt.sign(
    { uid },
    config.SECRET,
    { expiresIn: '24h' }   // candidates tokens should be short-lived
  )
}

function calculateScore(self, candidate) {   //Calculating the score according to which candidates are to be recommended
  let score = 0

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
    interests: 4,
    languages: 3
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
  return score
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

module.exports = router