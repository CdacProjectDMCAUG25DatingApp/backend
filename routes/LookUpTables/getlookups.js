const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const pool = require('../../utils/db')
const result = require('../../utils/result')
const config = require('../../utils/config')

const router = express.Router()
// Get Job Industry List
router.get("/gender", (req, res) => {
    
    pool.query(
        "SELECT gender_id, name FROM gender WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/religion", (req, res) => {
    pool.query(
        "SELECT religion_id, name FROM religion WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/mother-tongue", (req, res) => {
    pool.query(
        "SELECT language_id, name FROM language WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/education", (req, res) => {
    pool.query(
        "SELECT education_id, name FROM education WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/job-Industry", (req, res) => {
    pool.query(
        "SELECT industry_id, name FROM JobIndustry WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/lookingfor", (req, res) => {
    pool.query(
        "SELECT looking_for_id, name FROM lookingfor WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/opento", (req, res) => {
    pool.query(
        "SELECT open_to_id, name FROM opento WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/zodiac", (req, res) => {
    pool.query(
        "SELECT zodiac_id, name FROM zodiac WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/familyplan", (req, res) => {
    pool.query(
        "SELECT family_plan_id, name FROM familyplans WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/communicationstyle", (req, res) => {
    pool.query(
        "SELECT communication_style_id, name FROM communicationstyle WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/lovestyle", (req, res) => {
    pool.query(
        "SELECT love_style_id, name FROM lovestyle WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/drinking", (req, res) => {
    pool.query(
        "SELECT drinking_id, name FROM drinking WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/smoking", (req, res) => {
    pool.query(
        "SELECT smoking_id, name FROM smoking WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/workout", (req, res) => {
    pool.query(
        "SELECT workout_id, name FROM workout WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/dietary", (req, res) => {
    pool.query(
        "SELECT dietary_id, name FROM dietary WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/sleepingHabit", (req, res) => {
    pool.query(
        "SELECT sleeping_habit_id, name FROM sleepingHabit WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/religion", (req, res) => {
    pool.query(
        "SELECT religion_id, name FROM religion WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/personalitytype", (req, res) => {
    pool.query(
        "SELECT personality_type_id, name FROM personalitytype WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/pet", (req, res) => {
    pool.query(
        "SELECT pet_id, name FROM pet WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});


module.exports =  router;
