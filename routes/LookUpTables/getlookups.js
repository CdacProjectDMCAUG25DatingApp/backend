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


module.exports =  router;
