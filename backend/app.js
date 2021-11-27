const express = require("express");
const admin = require("firebase-admin");
const serviceAccount = require("./ServiceAccountKey.json");
const session = require("express-session");
// const { response } = require("express");
const { Storage } = require("@google-cloud/storage");
const path = require("path");
const multer = require("multer");
var multerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "img/");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); //Appending extension
    },
});

var upload = multer({ storage: multerStorage });

require("dotenv").config({ path: "../config.env" });

const app = express();

// Initilising session object
app.use(
    session({
        secret: "Its a secret",
        saveUninitialized: true,
        resave: false,
        // cookie: { secure: true },
    })
);

// Initializing firebase object
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const bucketName = process.env.BUCKET_NAME;
const storage = new Storage();
const bucket = storage.bucket(bucketName);

const db = admin.firestore();
db.settings({ timestampsInSnapshots: true });

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

// Function to check for existing login credentials
function checkValidUser(users, userID, password) {
    return users
        .where("userID", "==", userID)
        .where("password", "==", password)
        .get();
}

// Function to check if the userID exists
function checkIdExists(users, userID) {
    return users.where("userID", "==", userID).get();
}

// Function to check if the username exists
function checkUsernameExists(users, username) {
    return users.where("username", "==", username).get();
}

// Uploading file to google cloud storage
async function uploadFile(absoluteFilePath, destFileName) {
    await bucket.upload(absoluteFilePath, {
        destination: destFileName,
    });
}

// redirecting to login page
// TODO: Make a landing page
app.get("/", (req, res) => {
    res.redirect("login");
});

app.get("/login", (req, res) => {
    res.render("login.ejs", { message: " " });
});

app.post("/login", async (req, res) => {
    const users = db.collection("users");

    // check for valid userID and password
    const validUser = await checkValidUser(
        users,
        req.body.userID,
        req.body.password
    );

    if (validUser.empty) {
        res.render("login.ejs", { message: "ID or Password does not exist" });
        return;
    }
    validUser.docs.forEach((doc) => {
        req.session.username = doc.data().username;
        req.session.profilePicture = doc.data().profilePicture;
    });
    return res.redirect("/userArea");
});

app.get("/register", (req, res) => {
    res.render("register.ejs", { message: " " });
});

app.post("/register", upload.single("img"), async (req, res) => {
    const users = db.collection("users");

    // check if userID exists
    const userIdResult = await checkIdExists(users, req.body.userID);
    // check if username exists
    const usernameResults = await checkUsernameExists(users, req.body.username);

    if (userIdResult.notEmpty) {
        res.render("register.ejs", { message: "ID already exists" });
    }
    if (usernameResults.notEmpty) {
        res.render("register.ejs", { message: "Username already exists" });
    }

    const absoluteFilePath = path.join(__dirname, "/" + req.file.path);
    const destFileName = req.file.filename;

    // Uploading file to google cloud storage
    uploadFile(absoluteFilePath, destFileName).catch(console.error);

    // Fetching public link to the file from google cloud storage
    var fileRef = bucket.file(destFileName);
    const publicUrl = fileRef.publicUrl();

    users.add({
        userID: req.body.userID,
        username: req.body.username,
        password: req.body.password,
        profilePicture: publicUrl,
    });

    // Redirecting to Login page
    res.redirect("/login");
});

app.get("/userArea", (req, res) => {
    db.collection("posts")
        .orderBy("timestamp", "desc")
        .limit(10)
        .get()
        .then((response) => {
            res.render("userArea.ejs", {
                username: req.session.username,
                profilePicture: req.session.profilePicture,
                response,
            });
        });
});

app.post("/userArea", upload.single("img"), (req, res) => {
    let publicUrl = null;
    // Store post to database
    const posts = db.collection("posts");
    if (req.file !== undefined) {
        const absoluteFilePath = path.join(__dirname, "/" + req.file.path);
        const destFileName = req.file.filename;

        // Uploading file to google cloud storage
        uploadFile(absoluteFilePath, destFileName).catch(console.error);

        // Fetching public link to the file from google cloud storage
        var fileRef = bucket.file(destFileName);
        publicUrl = fileRef.publicUrl();

        posts.add({
            subject: req.body.subject,
            message: req.body.message,
            username: req.session.username,
            postPicture: publicUrl,
            timestamp: new Date(),
        });
    }
    // Refresh page
    res.redirect("/userArea");
});

//-------------------------------------
//DONE TILL HERE
//-------------------------------------

app.get("/user", async (req, res) => {
    const posts = await db
        .collection("posts")
        .where("username", "==", req.session.username)
        .orderBy("timestamp")
        .get();

    if (posts != null)
        res.render("user.ejs", {
            message: `No posts by ${req.session.username}`,
        });
    res.render("user.ejs", { message: " ", response });
});

// called when user click change password from user page
app.post("/changePassword", (req, res) => {
    db.collection("users")
        .where("username", "==", req.session.username)
        .where("password", "==", req.body.oldPassword)
        .get()
        .then((response) => {
            if (response != null) {
                response.forEach((doc) => {
                    db.collection("users").doc(doc.id).update({
                        password: req.body.newPassword,
                    });
                });
                res.redirect("login");
            } else {
                res.render("user.ejs", {
                    message: "Old Password is incorrect",
                    response: null,
                });
            }
        });
});

app.get("/editPost/:id", (req, res) => {
    db.collection("posts")
        .doc(req.params.id)
        .get()
        .then((response) => {
            if (response != null) {
                res.render("editPost.ejs", { response, id: req.params.id });
            }
        });
});

app.post("/editPost/:id", (req, res) => {
    db.collection("posts")
        .doc(req.params.id)
        .update({
            subject: req.body.subject,
            message: req.body.message,
            timestamp: new Date(),
        })
        .then(() => {
            res.redirect("/userArea");
        });
});

app.use(express.static("public"));

app.listen(process.env.PORT, () => {
    console.log(`listening on http://localhost:${process.env.PORT}`);
});
