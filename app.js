//jshint esversion:6
require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const exp = require("constants");
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
// const md5 = require("md5");
// // const bcrypt = require("bcrypt");
// // const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const { nextTick } = require('process');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.use(session({
    secret: "This is our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret : String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// userSchema.plugin(encrypt , {secret : process.env.SECRET , encryptedFields : ["password"]});
const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, {
            id: user.id,
            username: user.username,
            picture: user.picture
        });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ facebookId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/", (req, res) => {
    res.render("home");
})

app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
)

app.get("/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    (req, res) => {
        res.redirect("/secrets");
    }
)

app.get("/auth/facebook",
    passport.authenticate("facebook")
);

app.get("/auth/facebook/secrets",
    passport.authenticate("facebook", { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect("/secrets");
    })

app.get("/login", (req, res) => {
    res.render("login");
})

app.get("/register", (req, res) => {
    res.render("register");
})

app.get("/secrets", (req, res) => {
    User.find({"secret" : {$ne : null}}, (err, foundUsers)=>{
        if(err){
            console.log(err);
        } else {
            if(foundUsers){
                res.render("secrets", {usersWithSecrets : foundUsers});
            }
        }
    })
})

app.get("/submit", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
})

app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (!err) {
            res.redirect("/");
        }
    });
})

app.post("/register", (req, res) => {

    User.register({ username: req.body.username }, req.body.password, (err, user) => {
        if (err) {
            console.log(err);
            res.redirect("/register");
            alert("An error occured. Please register again.");
        }
        else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            })
        }
    })
})

app.post("/login", (req, res) => {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, (err) => {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            })
        }
    })
});

app.post("/submit", (req, res)=>{
    const submittedSecret = req.body.secret;

    console.log(req.user);

    User.findById(req.user.id, (err, foundUser)=>{
        if(err){
            console.log(err);
        }else {
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save(()=>{
                    res.redirect("/secrets");
                })
            }
        }
    })
})

// // app.post("/register", (req,res)=>{

// //     bcrypt.hash(req.body.password, saltRounds, (e, hash)=>{  
// //         const newUser = new User({
// //             email : req.body.username,
// //             // password : md5(req.body.password)
// //             password : hash
// //         });

// //         newUser.save((err)=>{
// //             if(!err){
// //                 res.render("secrets");
// //             }else {
// //                 console.log(err);
// //             }
// //         });
// //     });

// // })

// // app.post("/login", (req, res)=>{
// //     const username = req.body.username;
// //     const password = req.body.password;

// //     User.findOne({email : username}, (err, foundUser)=>{
// //         if(!err){
// //             if(foundUser){
// //                 bcrypt.compare(password, foundUser.password, (e, result)=>{
// //                     if(result === true){
// //                         res.render("secrets");
// //                     }
// //                     else{
// //                         res.send("<h1>Wrong password entered!</h1>");
// //                     }
// //                 })
// //             }
// //             else{
// //                 res.send("user not found");
// //             }
// //         }
// //     })
// // })

app.listen(3000, () => {
    console.log("Server started on port 3000");
})
