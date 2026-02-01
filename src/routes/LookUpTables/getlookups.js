const express = require('express')

const pool = require('../../utils/db')
const result = require('../../utils/result')


const router = express.Router()
// Get Job Industry List
router.get("/gender", (req, res) => {
    
    pool.query(
        "SELECT id, name FROM gender WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/religion", (req, res) => {
    pool.query(
        "SELECT id, name FROM religion WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/mother-tongue", (req, res) => {
    pool.query(
        "SELECT id, name FROM language WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/education", (req, res) => {
    pool.query(
        "SELECT id, name FROM education WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/job-Industry", (req, res) => {
    pool.query(
        "SELECT id, name FROM JobIndustry WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/lookingfor", (req, res) => {
    pool.query(
        "SELECT id, name FROM lookingfor WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/opento", (req, res) => {
    pool.query(
        "SELECT id, name FROM opento WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/zodiac", (req, res) => {
    pool.query(
        "SELECT id, name FROM zodiac WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/familyplan", (req, res) => {
    pool.query(
        "SELECT id, name FROM familyplans WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/communicationstyle", (req, res) => {
    pool.query(
        "SELECT id, name FROM communicationstyle WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/lovestyle", (req, res) => {
    pool.query(
        "SELECT id, name FROM lovestyle WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/drinking", (req, res) => {
    pool.query(
        "SELECT id, name FROM drinking WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/smoking", (req, res) => {
    pool.query(
        "SELECT id, name FROM smoking WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/workout", (req, res) => {
    pool.query(
        "SELECT id, name FROM workout WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/dietary", (req, res) => {
    pool.query(
        "SELECT id, name FROM dietary WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/sleepingHabit", (req, res) => {
    pool.query(
        "SELECT id, name FROM sleepingHabit WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/religion", (req, res) => {
    pool.query(
        "SELECT id, name FROM religion WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/personalitytype", (req, res) => {
    pool.query(
        "SELECT id, name FROM personalitytype WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});
router.get("/pet", (req, res) => {
    pool.query(
        "SELECT id, name FROM pet WHERE active = 1;",(err, data) => {
            res.send(result.createResult(err,data));
        }
    );
});

router.get("/report-reasons", (req, res) => {
  const sql = `
    SELECT reason_id, name, description 
    FROM reportreason 
    WHERE active = 1 
    ORDER BY reason_id ASC
  `;

  pool.query(sql, (err, data) => {
    res.send(result.createResult(err, data));
  });
});



module.exports =  router;
