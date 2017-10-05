/* eslint-env node */
const express = require('express')
const winston = require('winston')
const router = new express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const path = require('path')

const User = require(path.resolve('models/User'))
const Guest = require(path.resolve('models/Guest'))
const config = require(path.resolve('config/config'))

router.post('/signup/:token', (req, res) => {
  const token = req.params.token

  Guest.findOne({ token })
  .exec((error, guest) => {
    if (error) {
      winston.error({error})
      return res.status(500).json({ error })
    }
    else if (!guest) return res.status(401).json({ message: 'Invalid invitation. Please ask your administrator to send your invitation again'})
  })
})
router.post('/authenticate', (req, res) => {
  const { email } = req.body

  User.findOne({ email })
  .then(user => {
    if (user === null) {
      winston.info('Failed to authenticate user email')
      return res.status(401).json({ message: 'Authentication failed. Wrong user or password.' })
    }

    return bcrypt.compare(req.body.password + config.secret, user.password)
    .then(success => {
      if (success === false) {
        winston.info('Failed to authenticate user password')
        return res.status(401).json({ message: 'Authentication failed. Wrong user or password' })
      }

      const token = jwt.sign({
        _id: user._id,
        acc: user.accessLevel,
        cmp: user.company
      }, config.secret)

      user = user.toObject()

      return res.status(200).json({
        token,
        user: {
          _id: user._id,
          name: user.name || 'User',
          surname: user.surname,
          accessLevel: user.accessLevel
        }
      })
    })
  })
  .catch(error => {
    winston.error({error})
    return res.status(500).json({ error }) // Causes an error for cannot set headers after sent
  })
})

router.use((req, res, next) => {
  const bearer = req.headers.authorization || 'Bearer '
  const token = bearer.split(' ')[1]

  if (!token) {
    return res.status(401).send({ error: { message: 'No token provided' } })
  }

  return jwt.verify(token, config.secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: { message: 'Failed to authenticate token' }})
    }
    req._user = decoded
    return next()
  })
})

module.exports = router
