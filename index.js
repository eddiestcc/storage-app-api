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
  database: 'units',
  password: '',
  port: 5432,
});

client.connect();

const PORT = 3001;  // Set the port for the server

// Get request that database information
app.get('/', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM units'); 
    res.json(result.rows);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Server error');
  }    
});
-
// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
