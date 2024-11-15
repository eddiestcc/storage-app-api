const express = require('express');  // Import Express
const app = express();               // Create an Express app
const { Client } = require('pg');
const cors  = require('cors');
const bcrypt = require('bcrypt');


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

// Sign in Route
app.post('/signin', async (req,res) => {

    const { email , password } = req.body;

    try {
      // Returns promise of a user from database that matches the request email.
      const selectUser = await client.query(`SELECT * FROM users WHERE email = '${email}'`)
      // Promise is passed on to return a valid user 
      .then(response => {
        const validUser = response.rows[0];
        return validUser;
      })
      // Authentication here 
      // If there is no user in the database response 
      if(!selectUser) {
        selectUser = null;
        res.status(500).send('No user found.')
      }
      // Else verify the hash & provide a JWT 
      const hash = selectUser.hash;
      bcrypt.compare(password, hash).then(function(result) {
      //  Compare req.body to hash in DB, if true respond with JWT else send error 
        result === true 
        ? res.json(`JWT Token`)
        : null;
     });
    
       
    } catch (err) {
        res.status(500).send('Hmmm, something went wrong.')
    }
})

// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
