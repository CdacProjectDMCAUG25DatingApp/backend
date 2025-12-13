// builtin modules
const express = require('express')
const cors = require('cors')

//userdefined modules
const authorizeUser = require('./utils/authuser')
const userRouter = require("./routes/user")
const photoRouter = require("./routes/photos")
const lookUpRouter = require('./routes/LookUpTables/getlookups')

const app = express()

// Middlewares
app.use(cors()) // to allow the requests from different origin
app.use('/profilePhotos', express.static('profilePhotos'))
app.use(express.json())
app.use(authorizeUser) // this is our middleware used for user authorization
app.use('/user', userRouter)
app.use("/photos",photoRouter)
app.use('/api',lookUpRouter)

app.listen(4000, 'localhost', () => {
    console.log('Server started at port 4000')
})