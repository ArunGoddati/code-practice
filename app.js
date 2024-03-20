const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const app = express()
app.use(express.json())
const jwt = require('jsonwebtoken')

let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error:${e.message}`)
  }
}
initializeDbAndServer()

const convertDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictObjectToResponseObject = districtObject => {
  return {
    districtId: districtObject.district_id,
    districName: districtObject.distric_name,
    stateId: districtObject.state_id,
    cases: districtObject.cases,
    cured: districtObject.cured,
    active: districtObject.active,
    deaths: districtObject.deaths,
  }
}

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRETE_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// API -- 1

app.post(`/login/`, async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `
  SELECT * FROM user WHERE username = '${username}';
  `
  const dbUser = await db.get(selectUserQuery)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRETE_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// API -- 2
app.get(`/states/`, authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const {stateName, population} = request.body
  const getStatesQuery = `
  SELECT * FROM state;
  `
  const statesArray = await db.all(getStatesQuery)
  response.send(
    statesArray.map(eachState => convertDbObjectToResponseObject(eachState)),
  )
})

// API --3
app.get(`/states/:stateId/`, authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const {stateName, population} = request.body
  const getsingleStateQuery = `
  SELECT * FROM state WHERE state_id = ${stateId};
  `
  const singleState = await db.get(getsingleStateQuery)
  response.send(convertDbObjectToResponseObject(singleState))
})

// API -- 4

app.post(`/districts/`, authenticateToken, async (request, response) => {
  const {districName, stateId, cases, cured, active, deaths} = request.body
  const postDistricQuery = `
  INSERT INTO
  district (district_name, state_id, cases, cured, active, deaths)
  VALUES ('${districName}', '${stateId}', '${cases}', '${cured}', '${active}', ${deaths});
  `
  const postDistrict = await db.run(postDistricQuery)
  response.send('District Successfully Added')
})

// API -- 5

app.get(
  `/districts/:districtId/`,
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districName, stateId, cases, cured, active, deaths} = request.body
    const getSingleDistrict = `
  SELECT * FROM district WHERE district_id = '${districtId}';
  `
    const singleDistrict = await db.get(getSingleDistrict)
    response.send(convertDistrictObjectToResponseObject(singleDistrict))
  },
)

// API -- 6

app.delete(
  `/districts/:districtId/`,
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
  DELETE FROM district WHERE district_id = ${districtId};
  `
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

// API -- 7

app.put(
  `/districts/:districtId/`,
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districName, stateId, cases, cured, active, deaths} = request.body
    updateDistrictQuery = `
  UPDATE district 
  SET
  district_name = '${districName}',
  state_id = '${stateId}',
  cases = '${cases}',
  cured = '${cured}',
  active = '${active}',
  deaths = '${deaths}' 
  WHERE district_id = ${districtId};
  `
    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

// API -- 8

app.get(
  `/states/:stateId/stats/`,
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatesDetailesQuery = `
  SELECT 
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths)
  FROM district
  WHERE state_id = ${stateId};
  `
    const stats = await db.get(getStatesDetailesQuery)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)
module.exports = app
