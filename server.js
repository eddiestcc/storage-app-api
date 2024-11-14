const express = require('express');  // Import Express
const app = express();               // Create an Express app
const { Client } = require('pg');
const cors  = require('cors'); 


// Middleware
app.use(cors()); // Enable CORS to allow requests from the client
app.use(express.json()); // For parsing JSON bodies

// Create a connection to PostgreSQL
const client = new Client({
  user: '',
  host: 'localhost',
  database: 'storage',
  password: '',
  port: 5432,
});

client.connect();

const PORT = 3001;  // Set the port for the server

// Get unit information from database
app.get('/units', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM units'); 
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Server error');
  }    
});

// Get users information from database
app.get('/users', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM users'); 
    const json = res.json(result.rows);
    console.log(json)
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Server error');
  }    
});

// Sign .in Route
app.post('/signin', async (req,res) => {
    const { email , password } = req.body;
    // Look up database users 
    const users = await (await client.query('SELECT * FROM users')).rows;
    // authentication here 
    if(email === users[0].email && password === users[0].password) {
      // Upon authenticating, provide client with token
      res.json('923r82tjrfd')
    } else {
      res.status(500).json("bad attempt");
    }
})

// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
