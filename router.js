const express = require('express');
const { nanoid } = require('nanoid')
const router = express.Router();

// Ideal scenario
// Split this into more files, the should exist:
// - service file, containing the database-related methods

// This is mimicking a database row with format (hash, long, accesses)
// in an ideal scenario we'd have something like SQLite (or PostgreSQL if you're fancy)
// and then individual unique indexes on `hash` and `long`
//
// If we wanted to keep these in-memory inside a NodeJS process we should
// at least move these into an LRU cache to avoid us exploding our memory
const LONG_TO_SHORT = {}
const SHORT_TO_LONG = {}
const SHORT_TO_ACCESS = {}

// "DB" interface
const getFromLong = (string) => LONG_TO_SHORT[string]
const getFromShort = (string) => SHORT_TO_LONG[string]
const set = (long, short) => {
  LONG_TO_SHORT[long] = short
  SHORT_TO_LONG[short] = long
  SHORT_TO_ACCESS[short] = 0
}
const access = (short) => {
  SHORT_TO_ACCESS[short] ||= 0 // Just to be safe, make sure that the key exists
  SHORT_TO_ACCESS[short] += 1
}
const getAccesses = (short) => SHORT_TO_ACCESS[short] ?? 0

/* GET shorten */
// Long URL is a query parameter
router.get('/shorten', function (req, res) {
  const { url } = req.query

  // TODO: Add validation that the `url` passed in is an actual URL
  // Right now we're simply trusting it, and blindly redirecting to the passed URL inside `/r`
  if (!url) return res.json({ error: "No URL" })

  // If we haven't generated a short URL for the long URL, generate it
  // adding to both the "indexes" in our table
  if (!getFromLong(url)) {
    const hash = nanoid(8)
    set(url, hash)
  }

  // TODO: Abstract away the host and the port, Express can help us a lot with this
  return res.json({ url: `localhost:3000/r/${getFromLong(url)}` })
});

router.get('/r/:hash', function (req, res) {
  const { hash } = req.params

  if (!hash) return res.json({ error: "No URL" })

  const longURL = getFromShort(hash)
  if (!longURL) return res.json({ error: "Invalid hash, couldn't find equivalent long URL" })

  // NOTE: We're not checking for failures here, which is fine because in a real-world scenarion
  // we'd probably be using an Analytics database anyway, and they're known for not being strongly consistent
  try { access(hash) } catch { }

  return res.redirect(longURL)
})

router.get('/analytics/:hash', function (req, res) {
  const { hash } = req.params

  if (!hash) return res.json({ error: "No URL" })

  return res.json({ accesses: getAccesses(hash) })
})

module.exports = router;