const express = require('express')
const router = express.Router()
const connectToDatabase = require('../models/db')

// Search for gifts
router.get('/', async (req, res, next) => {
  try {
    // Connect
    const db = await connectToDatabase()
    const collection = db.collection('gifts')

    // Build query
    const query = {}

    // Name filter (partial, case-insensitive)
    if (req.query.name && req.query.name.trim() !== '') {
      query.name = { $regex: req.query.name, $options: 'i' }
    }

    // Other filters
    if (req.query.category) {
      query.category = req.query.category
    }
    if (req.query.condition) {
      query.condition = req.query.condition
    }
    if (req.query.age_years) {
      query.age_years = { $lte: parseInt(req.query.age_years) }
    }

    // Fetch
    const gifts = await collection.find(query).toArray()

    res.json(gifts)
  } catch (e) {
    next(e)
  }
})

module.exports = router
