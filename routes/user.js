const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const pool = require('../utils/db')
const result = require('../utils/result')
const config = require('../utils/config')

const router = express.Router()

router.post('/signin', (req, res) => {
    const { email, password } = req.body
    const sql = `SELECT * FROM users WHERE email = ?`
    pool.query(sql, [email], (err, data) => {
        if (err)
            res.send(result.createResult(err))
        else if (data.length == 0)
            res.send(result.createResult("Invalid Email"))
        else {
            // in this else block the data is present i.e 
            // the user is kept at 0th index in the data array
            // check for the pasword
            bcrypt.compare(password, data[0].password, (err, passwordStatus) => {
                if (passwordStatus) {
                    const payload = {
                        uid: data[0].uid,
                    }
                    const token = jwt.sign(payload, config.SECRET)
                    const user = {
                        token,
                        name: data[0].user_name,
                        email: data[0].email,
                        mobile: data[0].mobile
                    }
                    res.send(result.createResult(null, user))
                }
                else
                    res.send(result.createResult('Invalid Password'))
            })
        }

    })
})

router.post('/signup', (req, res) => {
    const { name, email, password, mobile } = req.body

    const sql = `INSERT INTO users(user_name,email,password,phone_number) VALUES (?,?,?,?)`
    // create the hashedpassword
    bcrypt.hash(password, config.SALT_ROUND, (err, hashedPassword) => {
        if (hashedPassword) {
            pool.query(sql, [name, email, hashedPassword, mobile], (err, data) => {
                res.send(result.createResult(err, data))
            })
        } else
            res.send(result.createResult(err))
    })
})

router.post('/userprofile', (req, res) => {
    const { gender, bio, religion, location, motherTongue, marital, dob, education, tagline, jobIndustry } = req.body
    const uid = req.headers.uid
    const sql = `INSERT INTO userprofile(uid,bio,gender,location,religion,mother_tongue,marital_status,dob,education,tagline,job_industry_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    pool.query(sql, [uid, bio, gender, location, religion, motherTongue, marital, dob, education, tagline, jobIndustry], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

router.get('/userprofile', (req, res) => {
    const uid = req.headers.uid
    const sql = `select * from userprofile where uid = ?`
    pool.query(sql, [uid], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

router.post('/userpreferences', (req, res) => {
    const uid = req.headers.uid
    const { lookingFor, openTo, zodiac, familyPlan, education, communicationStyle, lovestyle, drinking, smoking, workout
        , dietary, sleepingHabit, Religion, personalityType, pet, gender } = req.body
    const sql = `insert into userpreferences(uid, looking_for_id,preferred_gender_id, open_to_id, zodiac_id, family_plan_id, education_id, communication_style_id, love_style_id, drinking_id, smoking_id, workout_id, dietary_id, sleeping_habit_id, religion_id, personality_type_id, pet_id) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    pool.query(sql, [uid, lookingFor, gender, openTo, zodiac, familyPlan, education, communicationStyle, lovestyle, drinking, smoking, workout
        , dietary, sleepingHabit, Religion, personalityType, pet], (err, data) => {
            res.send(result.createResult(err, data))
        })
})

router.get('/userdetails', (req, res) => {
    const uid = req.headers.uid
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
LEFT JOIN workout wo ON pref.workout_id = wo.id
LEFT JOIN dietary di ON pref.dietary_id = di.id
LEFT JOIN sleepinghabit sh ON pref.sleeping_habit_id = sh.id
LEFT JOIN personalitytype pt ON pref.personality_type_id = pt.id
LEFT JOIN pet p ON pref.pet_id = p.id

WHERE u.uid IN (?);
`;
    pool.query(sql, [uid], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

router.get('/userpreferences', (req, res) => {
    const uid = req.headers.uid
    const sql = `select * from userpreferences where uid = ?`
    pool.query(sql, [uid], (err, data) => {
        res.send(result.createResult(err, data))
    })
})

router.patch('/userdetails', (req, res) => {
    const uid = req.headers.uid;
    const payload = req.body;
    console.log(payload)

    if (!uid) {
        return res.send(result.createResult("UID missing", null));
    }

    if (!payload || Object.keys(payload).length === 0) {
        return res.send(result.createResult("No fields to update", null));
    }

    const fieldMap = {
        looking_for: "looking_for_id",
        preferred_gender: "preferred_gender_id",
        open_to: "open_to_id",
        zodiac: "zodiac_id",
        family_plan: "family_plan_id",
        education: "education_id",
        communication_style: "communication_style_id",
        love_style: "love_style_id",
        drinking: "drinking_id",
        smoking: "smoking_id",
        workout: "workout_id",
        dietary: "dietary_id",
        sleeping_habit: "sleeping_habit_id",
        religion: "religion_id",
        personality_type: "personality_type_id",
        pet: "pet_id"
    };

    const setClauses = [];
    const values = [];

    // build SET clause dynamically
    Object.keys(payload).forEach(key => {
        if (fieldMap[key]) {
            setClauses.push(`${fieldMap[key]} = ?`);
            values.push(payload[key]);
        }
    });

    if (setClauses.length === 0) {
        return res.send(result.createResult("Invalid fields", null));
    }

    const sql = `
        UPDATE userpreferences
        SET ${setClauses.join(", ")}
        WHERE uid = ? AND is_deleted = 0
    `;

    values.push(uid);

    pool.query(sql, values, (err, data) => {
        if(data){
            console.log(data)
            res.send(result.createResult(err, data));
        }else{
        }
    });
});



module.exports = router