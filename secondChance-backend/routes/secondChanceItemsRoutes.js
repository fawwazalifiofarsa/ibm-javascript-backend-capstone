const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const router = express.Router()
const connectToDatabase = require('../models/db')
const logger = require('../logger')

const directoryPath = 'public/images'

// Ensure upload directory exists
if (!fs.existsSync(directoryPath)) {
  fs.mkdirSync(directoryPath, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, directoryPath)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({ storage })

// Get all secondChanceItems
router.get('/', async (req, res, next) => {
  logger.info('/ called')
  try {
    const db = await connectToDatabase()
    const collection = db.collection('secondChanceItems')
    const secondChanceItems = await collection.find({}).toArray()
    res.json(secondChanceItems)
  } catch (e) {
    logger.error('oops something went wrong', e)
    next(e)
  }
})

// Add a new item
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const db = await connectToDatabase()
    const collection = db.collection('secondChanceItems')

    const secondChanceItem = { ...req.body }

    // Next incremental id (stored as string, like existing data)
    const lastItem = await collection.find().sort({ id: -1 }).limit(1).toArray()
    if (lastItem.length) {
      secondChanceItem.id = (parseInt(lastItem[0].id) + 1).toString()
    } else {
      secondChanceItem.id = '1'
    }

    const dateAdded = Math.floor(Date.now() / 1000)
    secondChanceItem.date_added = dateAdded

    // If a file is uploaded, save its relative path
    if (req.file) {
      secondChanceItem.imagePath = path.join(directoryPath, req.file.originalname)
    }

    const result = await collection.insertOne(secondChanceItem)

    return res.status(201).json({
      ...secondChanceItem,
      _id: result.insertedId
    })
  } catch (e) {
    next(e)
  }
})

// Get a single secondChanceItem by ID
router.get('/:id', async (req, res, next) => {
  try {
    const db = await connectToDatabase()
    const collection = db.collection('secondChanceItems')
    const { id } = req.params

    const secondChanceItem = await collection.findOne({ id })
    if (!secondChanceItem) {
      return res.status(404).send('secondChanceItem not found')
    }

    res.json(secondChanceItem)
  } catch (e) {
    next(e)
  }
})

// Update an existing item
router.put('/:id', async (req, res, next) => {
  try {
    const db = await connectToDatabase()
    const collection = db.collection('secondChanceItems')
    const { id } = req.params

    const existing = await collection.findOne({ id })
    if (!existing) {
      logger.error('secondChanceItem not found')
      return res.status(404).json({ error: 'secondChanceItem not found' })
    }

    existing.category = req.body.category
    existing.condition = req.body.condition
    existing.age_days = req.body.age_days
    existing.description = req.body.description
    existing.age_years = Number((existing.age_days / 365).toFixed(1))
    existing.updatedAt = new Date()

    const updated = await collection.findOneAndUpdate(
      { id },
      { $set: existing },
      { returnDocument: 'after' }
    )

    if (updated && updated.value) {
      res.json({ uploaded: 'success' })
    } else {
      res.json({ uploaded: 'failed' })
    }
  } catch (e) {
    next(e)
  }
})

// Delete an existing item
router.delete('/:id', async (req, res, next) => {
  try {
    const db = await connectToDatabase()
    const collection = db.collection('secondChanceItems')
    const { id } = req.params

    const secondChanceItem = await collection.findOne({ id })
    if (!secondChanceItem) {
      logger.error('secondChanceItem not found')
      return res.status(404).json({ error: 'secondChanceItem not found' })
    }

    await collection.deleteOne({ id })
    res.json({ deleted: 'success' })
  } catch (e) {
    next(e)
  }
})

module.exports = router
