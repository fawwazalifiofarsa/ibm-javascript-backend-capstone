const express = require('express')
const router = express.Router()
const connectToDatabase = require('../models/db')
const { validationResult } = require('express-validator')
const bcryptjs = require('bcryptjs')
const jwt = require('jsonwebtoken')
const logger = require('../logger')

const { JWT_SECRET } = process.env

router.post('/register', async (req, res) => {
  try {
    // Connect & collection
    const db = await connectToDatabase()
    const collection = db.collection('users')

    // Email exists?
    const existingEmail = await collection.findOne({ email: req.body.email })
    if (existingEmail) {
      logger.error('Email id already exists')
      return res.status(400).json({ error: 'Email id already exists' })
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10)
    const hash = await bcryptjs.hash(req.body.password, salt)

    // Insert
    const result = await collection.insertOne({
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      password: hash,
      createdAt: new Date()
    })

    // Token
    const payload = { user: { id: result.insertedId.toString() } }
    const authtoken = jwt.sign(payload, JWT_SECRET)

    logger.info('User registered successfully')

    // Respond
    res.json({ authtoken, email: req.body.email })
  } catch (e) {
    return res.status(500).send('Internal server error')
  }
})

router.post('/login', async (req, res) => {
  try {
    const db = await connectToDatabase()
    const collection = db.collection('users')

    const user = await collection.findOne({ email: req.body.email })

    if (!user) {
      logger.error('User not found')
      return res.status(404).json({ error: 'User not found' })
    }

    const ok = await bcryptjs.compare(req.body.password, user.password)
    if (!ok) {
      logger.error('Passwords do not match')
      return res.status(404).json({ error: 'Wrong password' })
    }

    const userName = user.firstName
    const userEmail = user.email

    const payload = { user: { id: user._id.toString() } }
    const authtoken = jwt.sign(payload, JWT_SECRET)

    return res.json({ authtoken, userName, userEmail })
  } catch (e) {
    return res.status(500).send('Internal server error')
  }
})

router.put('/update', async (req, res) => {
  // Validate input (you can add specific validators on the route if desired)
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    logger.error('Validation errors in update request', errors.array())
    return res.status(400).json({ errors: errors.array() })
  }

  try {
    // Email in headers
    const email = req.headers.email
    if (!email) {
      logger.error('Email not found in the request headers')
      return res.status(400).json({ error: 'Email not found in the request headers' })
    }

    const db = await connectToDatabase()
    const collection = db.collection('users')

    const existingUser = await collection.findOne({ email })
    if (!existingUser) {
      logger.error('User not found for update')
      return res.status(404).json({ error: 'User not found' })
    }

    existingUser.updatedAt = new Date()

    const updated = await collection.findOneAndUpdate(
      { email },
      { $set: existingUser },
      { returnDocument: 'after' }
    )

    const payload = { user: { id: updated.value._id.toString() } }
    const authtoken = jwt.sign(payload, JWT_SECRET)

    return res.json({ authtoken })
  } catch (e) {
    return res.status(500).send('Internal server error')
  }
})

module.exports = router
