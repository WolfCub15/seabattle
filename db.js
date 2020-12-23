const { Pool } = require('pg')
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'base_seabattle',
  password: 'lolo',
  port: 3333,
})

module.exports = pool;