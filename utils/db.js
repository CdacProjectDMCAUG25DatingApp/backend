// db.js
require('dotenv').config(); // Ensure dotenv is configured if running locally

const mysql = require('mysql2/promise'); // Use the 'promise' interface

// Validate necessary environment variables are set
if (!process.env.DB_HOST || !process.env.DB_SSL_CA_PATH) {
    console.error("Missing critical environment variables: DB_HOST or DB_SSL_CA_PATH");
    process.exit(1); // Exit if configuration is incomplete
}

const pool = mysql.createPool({
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    connectionLimit: 10,
    ssl: {
        // Use synchronous read as this runs only once when the app starts
        ca: require('fs').readFileSync(process.env.DB_SSL_CA_PATH),
        rejectUnauthorized: true // Always verify the server certificate
    }
});

module.exports = pool;
