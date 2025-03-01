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

// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Routes

// Units route GET
app.get('/units', async (req, res) => {
  // Get request that sends all the units to client 
  try {
    const units = await client.query(
      `SELECT * FROM accounts
      RIGHT OUTER JOIN units ON units.unit_number = accounts.unit_number 
      WHERE units.status = 'Available'
      OR accounts.status = 'Active' 
      ORDER BY units.unit_number ASC;`);
    res.json(units.rows);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Server error');
  }    
});

// Users route GET
app.get('/users', async (req, res) => {
  // Get users information from database
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

// Accout Route delete
app.get('/accounts/:userID', async (req, res) => {
  try {
      const userID = req.params.userID;
      // Find the account that was requested
      const requestedAccount = await client.query(
        `SELECT * FROM accounts 
        WHERE id = ${userID};`)
      .then(response => {
        const validAccount = response.rows[0];
        return validAccount;
      }); 


      if (!requestedAccount) {
        res.status(400).json('no account found')
      } else {
        // Get all notes on the account
        const allAccoutNotes = (
          await client.query(
          ` SELECT * FROM notes 
          WHERE account_number = ${requestedAccount.id} 
          ORDER BY timestamp DESC;`)).rows;

        // Get ledger
        const allLedgerDetails = (
          await client.query(
            ` SELECT * FROM ledger 
            WHERE account_number = ${requestedAccount.id} 
            ORDER BY timestamp DESC;`)).rows;

        // Get moveout notice
        const moveOut = (
          await client.query(
            ` SELECT * FROM notices 
            WHERE account_id = ${requestedAccount.id} 
            ORDER BY timestamp ASC;`)).rows;

        // Get rent
        const rent = (
          await client.query(
          ` SELECT * FROM accounts
          RIGHT OUTER JOIN units ON units.unit_number = accounts.unit_number
          WHERE accounts.id = ${requestedAccount.id};`)).rows;

        // Get Documents
        // Dynamic path to users folder with their uploads.
        const path = `uploads/${requestedAccount.id}`;

        // Check path and returns array of files within the specified folder
        const returnFolder = () => {
          const pathExist = fs.existsSync(path);
          const readFolder = () => { return fs.readdirSync(path) };
          return pathExist ? readFolder() : null
        }

        const folder = returnFolder();
        const documents = [];

        // Only execute if a valid folder is found.
        if (folder) {
          // Loops through each file and performs an action on them.
          folder.forEach(file => {
          // Creates empty object and feeds it the file name and birthtime
            const stats = fs.statSync(path + '/' + file)
            const obj = {};
            obj.filename = file;
            obj.createdDate = stats.birthtime;
            documents.push(obj)
          })
        }
        
       res.send({
          "account": requestedAccount, 
          "accountNotes": allAccoutNotes, 
          "ledger": allLedgerDetails, 
          "documents": documents,
          "moveOut": moveOut,
          "rent": rent
        });
      }
      
    } catch (error) {
      console.log(error)
      res.status(500).json('We think you broke something... it was not us...');
    }
});

// Delete Accout Route
app.post('/account/moveout', async (req, res) => {
  try {
     const {id , moveOutDate } = req.body
    
    // Dates
     const today = Date.now()
     const timestamp = new Date(today).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
     })
     const formatToday = new Date(today).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
     })
     
      // Find the account that was requested
      const requestedAccount = await client.query(
        `SELECT * FROM accounts
        RIGHT OUTER JOIN units ON units.unit_number = accounts.unit_number
        WHERE accounts.id = ${id};`)
      .then(response => {
        const validAccount = response.rows[0];
        return validAccount;
      }); 
      if (!requestedAccount) {
        res.status(400).json('no account found')
      } else {
        let msg = '';

        if (moveOutDate < formatToday) {
          // Respond with a backdated move out
          const closeAccount = await client.query(
            `DELETE FROM accounts
            WHERE id = ${requestedAccount.id};
            UPDATE units
            SET status = 'Available'
            WHERE unit_number = ${requestedAccount.unit_number};`)
          msg = `Customer's move out has been successfully backdated to ${moveOutDate}.`
          res.send({msg: msg})
        } else if (moveOutDate === formatToday) {
          // Close account
          const closeAccount = await client.query(
            `DELETE FROM accounts
            WHERE id = ${requestedAccount.id};
            UPDATE units
            SET status = 'Available'
            WHERE unit_number = ${requestedAccount.unit_number};`)

          msg = `Customer account has been successfully closed. Please exit page.`;

          res.send({
            msg: msg,
            closedAcct: closeAccount,
            reqAcct: requestedAccount
          })
        } else if (moveOutDate > formatToday) {
          // Set move notice for the future
          msg = `A move out date has been scheduled for ${moveOutDate}.`

          const notice = await client.query(
            `INSERT INTO notices(
              account_id,
              notice,
              timestamp
              )
            VALUES(
              '${requestedAccount.id}',
              '${msg}',
              '${timestamp}'
            );`)
          
          res.send({msg: msg})
        }
      }
      
    } catch (error) {
      console.log(error)
      res.status(500).json('We think you broke something... it was not us...');
    }
});

// New Rental Route GET
app.get('/rental', async (req, res) => {
  // Get request that sends all available units to client 
  try {
    const units = await client.query(
      `SELECT * FROM units 
      WHERE status = 'Available' 
      ORDER BY unit_number ASC;`);
    res.json(units.rows);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Server error');
  }    
});

// New Rental Route Post
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
      total,
      timestamp
    } = body;

    const fullName = `${firstName} ${lastName}`;

    const tax = Number(total.tax);

    const grandTotal = Number(total.grandTotal);
    
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
      paid_thru_date,
      status)
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
      '${paidThruDate}',
      'Active');
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
          timestamp,
          amount)
        VALUES(  
          '${unit}',
          '${account_number}',
          '${details}',
          '${timestamp}',
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
      const requestedTransaction = await client.query(
        `SELECT * FROM ledger 
        WHERE transaction_id = ${transaction_id};`)
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

// Upload Route
app.post('/upload', (req, res) => {

  upload(req, res, (err) => {
    if (err) {
      res.send({ msg: err })
    } else {
      if (req.file == undefined) {
        res.send({ msg: 'No file selected!' });
      } else {

        const { userID } = req.body;

         // Dynamic path to users folder with their uploads.
         const path = `uploads/${userID}`
         const documents = [];
 
         // Only execute if a valid path is found.
         if (path) {
           // Returns array of files within the specified folder
           const folder = fs.readdirSync(path);
 
           // Loops through each file and performs an action on them.
           folder.forEach(file => {
           // Creates empty object and feeds it the file name and birthtime
             const stats = fs.statSync(path + '/' + file)
             const obj = {};
             obj.filename = file;
             obj.createdDate = stats.birthtime;
             documents.push(obj)
           })
         }

        res.send({
          msg: 'File uploaded!',
          file: req.file,
          documents: documents
        });
      }
    }
  });
  
});

// Download Route
app.post('/download', (req, res) => {

  const {filename, userID} = req.body;

  console.log(req.body)

  const pathRoute = `uploads/${userID}/${filename}`

  res.sendFile(
    path.join(__dirname, pathRoute)
  )
  
});

// Document route
app.get('/documents/:document_id', async (req, res) => {
  try {
      const document_id = req.params.document_id;
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


// Multer variables
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
  const filetypes = /jpeg|jpg|png|gif|pdf/;
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