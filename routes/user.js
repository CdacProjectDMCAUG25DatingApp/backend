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
    const { gender, bio, religion, location, motherTongue, marital, dob, education, jobTitle, jobIndustry } = req.body
    const uid = req.headers.uid
    const sql = `INSERT INTO userprofile(uid,bio,gender,location,religion,mother_tongue,marital_status,dob,education,job_title,job_industry_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    pool.query(sql, [uid, bio, gender, location, religion, motherTongue, marital, dob, education, jobTitle, jobIndustry], (err, data) => {
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
        , dietary, sleepingHabit, Religion, personalityType, pet } = req.body
    const sql = `insert into userpreferences(uid, looking_for_id, open_to_id, zodiac_id, family_plan_id, education_id, communication_style_id, love_style_id, drinking_id, smoking_id, workout_id, dietary_id, sleeping_habit_id, religion_id, personality_type_id, pet_id) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    pool.query(sql, [uid, lookingFor, openTo, zodiac, familyPlan, education, communicationStyle, lovestyle, drinking, smoking, workout
        , dietary, sleepingHabit, Religion, personalityType, pet], (err, data) => {
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

module.exports = router