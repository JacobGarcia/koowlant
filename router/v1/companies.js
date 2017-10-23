/* eslint-env node */
const express = require('express')
const path = require('path')
const winston = require('winston')
const router = new express.Router()

const Site = require(path.resolve('models/Site'))
const Zone = require(path.resolve('models/Zone'))
const Subzone = require(path.resolve('models/Subzone'))

// Save sites and stream change
router.route('/companies/:company/:zone/:subzone/sites')
.post((req, res) => {
    const { key, name, position, sensors, alarms } = req.body
    const { company, zone, subzone } = req.params
    // Create site using the information in the request body
    new Site({
      key,
      name,
      position,
      sensors,
      alarms,
      subzone,
      zone
    })
    .save((error, site) => {
      if (error) {
        winston.error({error})
        return res.status(500).json({ error })
      }
      // Add the new site to the specified subzone
      return Subzone.findOneAndUpdate({ '_id': subzone }, { $push: { sites: site } }, { new: true })
      .exec((error, subzone) => {
        if (error) {
          winston.error({error})
          return res.status(500).json({ error })
        }

        return res.status(200).json({ site })
      })
    })
})

//  Save subzone and stream change
router.route('/companies/:company/:zone/subzones')
.post((req, res) => {
    const { name, positions, sites } = req.body
    const { company, zone } = req.params
    // Create subzone using the information in the request body
    new Subzone({
      name,
      positions,
      parentZone: zone,
      sites
    })
    .save((error, subzone) => {
      if (error) {
        winston.error({error})
        return res.status(500).json({ error })
      }
      // Add the new site to the specified zone
      Zone.findOneAndUpdate({ '_id': zone }, { $push: { subzones: subzone } }, { new: true })
      .exec((error, zone) => {
        if (error) {
          winston.error({error})
          return res.status(500).json({ error })
        }
        if (!zone) return res.status(404).json({ message: 'No zone found'})

        return res.status(200).json({ subzone })
      })
    })
})

//  Save zone and stream change
router.route('/companies/:company/zones')
.post((req, res) => {
    const { name, positions, subzones } = req.body
    const { company } = req.params
    // Create subzone using the information in the request body
    new Zone({
      name,
      positions,
      subzones
    })
    .save((error, zone) => {
        if (error) {
          winston.error({error})
          return res.status(500).json({ error })
        }

        res.status(200).json({ zone })
    })
})

// Save sensors and alarms, add to history and stream change
router.route('/companies/:company/:site/reports')
.put((req, res) => {
    const { sensors, alarms } = req.body
    const { company, site } = req.params

    Site.findOne({ '_id': site })
    .exec((error, site) => {
      if (!site) return res.status(404).json({ message: 'No site found'})
      Site.findOneAndUpdate({ '_id': site }, { $push: { history: { sensors: site.sensors, alarms: site.alarms, timestamp: site.timestamp} } }, { new: true })
      .populate('zone', 'name')
      .populate('subzone', 'name')
      .exec((error, populatedSite) => {
        site.sensors = sensors
        site.alarms = alarms
        site.timestamp = Date.now()

        site.save((error, updatedSite) => {

          if (error) {
            winston.error({error})
            return res.status(500).json({ error })
          }

          let report = {
            site: {
              _id: updatedSite._id,
              key: updatedSite.key
            },
            zone: populatedSite.zone,
            subzone: populatedSite.subzone,
            timestamp: updatedSite.timestamp,
            sensors: updatedSite.sensors,
            alarms: updatedSite.alarms
          }

          global.io.to('0293j4ji').emit('report', report)
          return res.status(200).json(report)
        })
      })

    })
})

// Get zones. TODO: Retrieve only company zones
router.route('/companies/:company/zones')
.get((req, res) => {
  const company = req.params.company

  Zone.find({})
  .exec((error, zones) => {
    if (error) {
      winston.error({error})
      return res.status(500).json({ error })
    }
    if (!zones) return res.status(404).json({ message: 'No zones found'})
    else return res.status(200).json({ zones })
  })
})

// Get subzones. TODO: Retrieve only company subzones
router.route('/companies/:company/subzones')
.get((req, res) => {
  const company = req.params.company

  Subzone.find({})
  .exec((error, subzones) => {
    if (error) {
      winston.error({error})
      return res.status(500).json({ error })
    }
    if (!subzones) return res.status(404).json({ message: 'No subzones found'})
    else return res.status(200).json({ subzones })
  })
})

// Get sites. TODO: Retrieve only company sites
router.route('/companies/:company/sites')
.get((req, res) => {
  const company = req.params.company

  Site.find({})
  .exec((error, sites) => {
    if (error) {
      winston.error({error})
      return res.status(500).json({ error })
    }
    if (!sites) return res.status(404).json({ message: 'No sites found'})
    else return res.status(200).json({ sites })
  })
})

// Get last report for all sites
router.route('/companies/:company/reports')
.get((req, res) => {
  const company = req.params.company

  Site.find({})
  .populate('zone', 'name')
  .populate('subzone', 'name')
  .exec((error, sites) => {
    if (error) {
      winston.error({error})
      return res.status(500).json({ error })
    }

    let reports = []
    sites.forEach((site) => {
      let report = {
        site: {
          _id: site._id,
          key: site.key
        },
        zone: site.zone,
        subzone: site.subzone,
        timestamp: site.timestamp,
        sensors: site.sensors,
        alarms: site.alarms
      }
      reports.push(report)
    })

    return res.status(200).json({ reports })
  })
})

module.exports = router
