const jwt = require('jsonwebtoken')
const result = require('./result')
const config = require('./config')

function authorizeUser(req, res, next) {
    // For checking the incoming request and the token
    const url = req.url
    if (url == '/user/signin' || url == '/user/signup') // for these 2 routes no token is required
        next()
    else {
        const token = req.headers.token
        if (token) {
            try {
                const payload = jwt.verify(token, config.SECRET)
                req.headers.uid = payload.uid
                next()
            } catch (ex) {
                res.send(result.createResult('Invalid Token'))
            }
        } else
            res.send(result.createResult('Token is Missing'))
    }
}

module.exports = authorizeUser