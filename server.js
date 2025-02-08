const express = require('express');  // Import Express
const app = express();               // Create an Express app
const { Client } = require('pg');
const cors  = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require ('path');
const fs = require('fs');

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

// // Set up storage engine
// const storage = multer.diskStorage({
//   destination: './uploads/',
//   filename: function(req, file, cb) {
//     cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
//   }
// });

// // Init upload
// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 1000000 }, // Limit file size to 1MB
//   fileFilter: function(req, file, cb) {
//     checkFileType(file, cb);
//   }
// }).single('myImage');

// // Check file type
// function checkFileType(file, cb) {
//   // Allowed file extensions
//   const filetypes = /jpeg|jpg|png|pdf|gif/;
//   // Check extension
//   const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
//   // Check mime type
//   const mimetype = filetypes.test(file.mimetype);

//   if (mimetype && extname) {
//     return cb(null, true);
//   } else {
//     cb('Error: Images Only!');
//   }
// }


// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Get unit information from database
app.get('/units', async (req, res) => {
  // Get request that sends all the units to client 
  try {
    const units = await client.query('SELECT * FROM accounts RIGHT OUTER JOIN units ON units.unit_number = accounts.unit_number ORDER BY units.unit_number ASC;');
    res.json(units.rows);
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
    try {
      const { email , password } = req.body;
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
      bcrypt.compare(password, hash).then(function(result, err) {
      //  Compare req.body to hash in DB, if true respond with JWT else send error 
        result === true 
        ? res.json(selectUser)
        : res.status(400).send('wrong credentials')
     });
    
       
    } catch (err) {
        res.status(500).send('Hmmm, something went wrong.')
    }
});

// ACCOUNT ROUTE
app.get('/accounts/:userID', async (req, res) => {
  try {
      const userID = req.params.userID;
      // Find the account that was requested
      const requestedAccount = await client.query(`SELECT * FROM accounts WHERE id = ${userID} ;`)
      .then(response => {
        const validAccount = response.rows[0];
        return validAccount;
      }); 


      if (!requestedAccount) {
        res.status(400).json('no account found')
      } else {
        // Get all notes on the account
        const allAccoutNotes = (await client.query(` SELECT * FROM notes WHERE account_number = ${requestedAccount.id} ORDER BY timestamp DESC;`)).rows;

        // Get ledger
        const allLedgerDetails = (await client.query(` SELECT * FROM ledger WHERE account_number = ${requestedAccount.id} ORDER BY date DESC;`)).rows;

        // Get Documents
        const path = `uploads/${userID}`

        
  
        fs.readFile(`uploads/${userID}/myFile-1739030017610.jpg`, function(err,data){
          if (err) {
            console.log(err, 'err')
            return;
          } else {
            console.log(data)
            return;
          }
        })
        
        allAccoutNotes.length === 0 ? res.send({"account" : requestedAccount,"accountNotes" : "", "ledger": allLedgerDetails})
        : res.send({
          "account" : requestedAccount, 
          "accountNotes" : allAccoutNotes, 
          "ledger": allLedgerDetails, 
          "documents": path,
        });
      }
      
    } catch (error) {
      res.status(500).json('We think you broke something... it was not us...');
    }
});

// Get empty unit information from database
app.get('/rental', async (req, res) => {
  // Get request that sends all available units to client 
  try {
    const units = await client.query("SELECT * FROM units WHERE status = 'Available' ORDER BY unit_number ASC;");
    res.json(units.rows);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Server error');
  }    
});

// New Rental Route
app.post('/rental', async (req, res) => {
  // Get request that sends all the units to client 
  try {
    const body = req.body;
    const  
    {   
      firstName,
      lastName,
      dateOfBirth,
      primaryPhone,
      secondaryPhone,
      email,
      licenseNumber,
      licenseExpiration,
      licenseState,
      street,
      apartment,
      city,
      state,
      zip,
      unit,
      price,
      rentalStartDate,
      paidThruDate,
      status,
      total
    } = body;

    const fullName = `${firstName} ${lastName}`;

    const tax = Number(total.tax);

    const grandTotal = Number(total.grandTotal);

    const today = new Date();
    
    const date = today.toLocaleDateString()

    const details = 'Payment was made';

    const insertRow = await client.query(
    `
    SELECT * FROM accounts 
    RIGHT OUTER JOIN units ON units.unit_number = accounts.unit_number;
    INSERT INTO accounts(
      account_name,
      date_of_birth,
      phone_number,
      second_phone_number,
      email,
      license_number,
      license_expiration,
      license_state,
      street_one,
      street_two,
      city,
      state,
      zip_code,
      unit_number,
      rental_start_date,
      paid_thru_date)
    VALUES(  
      '${fullName}',
      '${dateOfBirth}',
      '${primaryPhone}',
      '${secondaryPhone}',
      '${email}',
      '${licenseNumber}',
      '${licenseExpiration}',
      '${licenseState}',
      '${street}',
      '${apartment}',
      '${city}',
      '${state}',
      '${zip}',
      '${unit}',
      '${rentalStartDate}',
      '${paidThruDate}');
      UPDATE units
      SET status = 'Rented'
      WHERE unit_number = ${unit};`);

      const id = await client.query(`SELECT id FROM accounts WHERE unit_number = ${unit};`)

      const account_number = id.rows[0].id

      const insertLedger = await client.query(
        `
        INSERT INTO ledger(
          unit,
          account_number,
          details,
          date,
          amount)
        VALUES(  
          '${unit}',
          '${account_number}',
          '${details}',
          '${date}',
          '${grandTotal}');
          `);

    res.status(200).send({status: 'success', id: id});
  } catch (err) {
    console.error('Error detected:', err);
    res.status(500).send('Server error');
  }    
});

// Post note to account
app.post('/notes', async (req, res) => {

  const {unit, title, textarea, category, timestamp, account_number} = req.body;

  const failedMessage = {"status": "failed"}

  try {
    if (!category || !unit || !title || !textarea || !timestamp ) {
      console.error('req has missing parts')
      res.send(failedMessage);
    } else {


      const insertNote = await client.query(
        `
          INSERT INTO notes(
              unit,
              title,
              textarea,
              category,
              timestamp,
              account_number
          )
          VALUES(  
            '${unit}',
            '${title}',
            '${textarea}',
            '${category}',
            '${timestamp}',
            '${account_number}'
          );
      `
      );

      const allAccoutNotes = (await client.query(` 
        SELECT * FROM notes WHERE account_number = ${account_number} 
        ORDER BY timestamp DESC;`)).rows;
      
      res.send({ "status": "success", "updatedNotes" : allAccoutNotes});
    }
  } catch (err) {
    console.error('Error detected:', err);
    res.status(500).send('Server error');
  }
})

// Receipt Route
app.get('/receipt/:transaction_id', async (req, res) => {
  try {
      const transaction_id = req.params.transaction_id;
      // Find the transaction that was requested
      const requestedTransaction = await client.query(`SELECT * FROM ledger WHERE transaction_id = ${transaction_id};`)
      .then(response => {
        const transaction = response.rows[0];
        return transaction;
      })
      .then(transaction => res.send(transaction))
    } catch (error) {
      res.status(500).json('We think you broke something... it was not us...');
    }
});

 // Set up storage engine
 const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { userID } = req.body
    const path = `./uploads/${userID}`
    fs.mkdirSync(path, { recursive: true })
    return cb(null, path)
  },
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// Init upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 }, // Limit file size to 1MB
  fileFilter: function(req, file, cb) {
    checkFileType(file, cb);
  }
}).single('myFile');

// Check file type
function checkFileType(file, cb) {
  // Allowed file extensions
  const filetypes = /jpeg|jpg|png|gif/;
  // Check extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime type
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
}

// Document Route
app.post('/upload', (req, res) => {

  upload(req, res, (err) => {
    if (err) {
      res.send({ msg: err })
    } else {
      if (req.file == undefined) {
        res.send({ msg: 'No file selected!' });
      } else {
        res.send({
          msg: 'File uploaded!',
          file: req.file,
        });
      }
    }
  });
  
});
