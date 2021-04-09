const express = require("express");
const dotenv = require("dotenv");
const admin = require("firebase-admin");
const serviceAccount = require("./ServiceAccountKey.json");
const session = require('express-session');
const { response } = require("express");
const { render } = require("ejs");
const {Storage} = require('@google-cloud/storage')
const path = require('path')

const app = express();

app.use(session({ secret: 'secret', saveUninitialized: true, resave: false }));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const bucketName = 'online-forum-bucket';

const projectId = 'project-alpha-101'
const keyFilename = 'project-alpha-101-428f47dd974a.json'
const storage = new Storage({projectId, keyFilename});


async function uploadFile(filePath, destFileName) {
  await storage.bucket(bucketName).upload(filePath, {
    destination: destFileName,
  });
}


const db = admin.firestore();
db.settings({ timestampsInSnapshots: true});

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.redirect('login');
});

app.get("/login", (req, res) => {
  res.render("login.ejs", { message: " " });
});

app.post("/login", (req, res) => {
  const users = db.collection("users");

  // check for valid userID
  const check_id_exists = async () => {
    const id_results = await users.where('userID', '==', req.body.userID).where('password', '==', req.body.password).get();
    
    if (id_results.empty && id_results.docs.length == 0) {
      return null;
    } else {
      return id_results.docs;
    }
  };

  const id_results = check_id_exists();

  id_results.then((response) => {

    if (response == null) {
      res.render('login.ejs', { message: 'ID or Password does not exist'});
      return;
    }else{
      response.forEach(doc => {
        req.session.username = doc.data().username;
        req.session.imgURL = doc.data().imgURL;
      })
    }
    
    // TODO:: Redirect to forum page
    res.redirect('/userArea');
  })
});

app.get("/register", (req, res) => {
  res.render("register.ejs", { message: " " });
});

app.post("/register", (req, res) => {
  const users = db.collection("users");

  // check if userID exists
  const check_id_exists = async () => {
    var id_results = await users.where("userID", "==", req.body.userID).get();

    if (id_results.empty && id_results.docs.length == 0) {
      return null;
    } else {
      return id_results.docs;
    }
  };

  // check of username exists
  const check_username_exists = async () => {
    var name_results = await users.where("username", "==", req.body.username).get();

    if (name_results.empty && name_results.docs.length == 0) {
      return null;
    } else {
      return name_results.docs;
    }
  };

  var id_results = check_id_exists();

  id_results.then((response) => {
    if (response != null) {
      res.render('register.ejs', { message: 'ID already exists' });
      return;
    }

    var username_results = check_username_exists();

    username_results.then((response) => {
      if (response != null) {
        res.render('register.ejs', { message: 'Username already exists'});
        return;
      }
      const filePath = path.join(__dirname, './img/', req.body.img)
      console.log(filePath);
      const destFileName = req.body.img;

      uploadFile(filePath, destFileName).catch(console.error);

      // Create a reference to the file to generate link
      var fileRef = storage.bucket(bucketName).file(destFileName);
      const public_url = fileRef.publicUrl();

      users.add({
        userID: req.body.userID,
        username: req.body.username,
        password: req.body.password,
        imgURL: public_url
      });
      // Redirecting to Login page
      res.redirect("/login");
    });

  });
});

app.get('/userArea', (req, res) => {
  db.collection('posts').orderBy('timestamp', 'desc').limit(10).get().then((response) => {
    res.render('userArea.ejs', { username: req.session.username, imgURL: req.session.imgURL, response });
  })
});

app.post('/userArea', (req, res) => {
  // Store post to database
  const postRef = db.collection('posts');

  const filePath = path.join(__dirname, './img/', req.body.img)
  console.log(filePath);
  const destFileName = req.body.img;

  uploadFile(filePath, destFileName).catch(console.error);

  // Create a reference to the file to generate link
  var fileRef = storage.bucket(bucketName).file(destFileName);
  const imgURL = fileRef.publicUrl();

  postRef.add({
    subject: req.body.subject,
    message: req.body.message,
    username: req.session.username,
    imgURL: imgURL,
    timestamp: new Date()
  });
  
  // Refresh page
  res.redirect('/userArea');
})

app.get('/user', (req, res) => {
  db.collection('posts').where( 'username', '==', req.session.username).orderBy('timestamp').get().then((response) => {
    if (response != null) {
      res.render('user.ejs', { message: " ", response });
    }
  });
});

app.post('/user', (req, res) => {

});

// called when user click change password from user page
app.post('/changePassword', (req, res) => {
  db.collection('users').where('username', '==', req.session.username).where('password', '==', req.body.oldPassword).get().then((response) => {
    if (response != null) {
      response.forEach(doc => {
        db.collection('users').doc(doc.id).update({
          password: req.body.newPassword
        })
      })
      res.redirect('login');
    } else {
      res.render('user.ejs', { message: "Old Password is incorrect", response: null })
    }
  });
});

app.get('/editPost/:id', (req, res) => {

  db.collection('posts').doc(req.params.id).get().then((response) => {
    if (response != null) {
      res.render('editPost.ejs', { response , id: req.params.id })
    }
  })
});

app.post('/editPost/:id', (req, res) => {
  db.collection('posts').doc(req.params.id).update({
    subject: req.body.subject,
    message: req.body.message,
    timestamp: new Date()
  }).then(() => {
    res.redirect('/userArea')
  })
})

app.use(express.static("public"));

app.listen(5000);