const mysql2 = require('mysql2')

const pool = mysql2.createPool({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'dating_app',
    connectionLimit: 10,
})

module.exports = pool