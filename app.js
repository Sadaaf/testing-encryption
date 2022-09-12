require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const bcrypt = require("bcryptjs")
// const md5 = require("md5");
//Encrypts the required data using a key in DB
// const encrypt = require('mongoose-encryption');
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// var FacebookStrategy = require('passport-facebook');
const findOrCreate = require('mongoose-findorcreate')
// const saltNumbers = 10;

const app = express()

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended:true}))

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB")

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: []
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate)
// userSchema.plugin(encrypt, { secret: process.env.key, encryptedFields: ['password'] })

const User = mongoose.model("User",userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture
    });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

// PassportJS Google OAuth2.0
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile)
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

// PassportJS Facebook OAuth 
// passport.use(new FacebookStrategy({
//     clientID: process.env['FACEBOOK_APP_ID'],
//     clientSecret: process.env['FACEBOOK_APP_SECRET'],
//     callbackURL: 'https://localhost:3000/oauth2/redirect/secrets'
//   },
//   function(accessToken, refreshToken, profile, cb) {
//     db.get('SELECT * FROM federated_credentials WHERE provider = ? AND subject = ?'), [
//       'https://www.facebook.com',
//       profile.id
//     ], function(err, cred) {
//       if (err) { return cb(err); }
//       if (!cred) {
//         // The Facebook account has not logged in to this app before.  Create a
//         // new user record and link it to the Facebook account.
//         db.run('INSERT INTO users (name) VALUES (?)', [
//           profile.displayName
//         ], function(err) {
//           if (err) { return cb(err); }

//           var id = this.lastID;
//           db.run('INSERT INTO federated_credentials (user_id, provider, subject) VALUES (?, ?, ?)', [
//             id,
//             'https://www.facebook.com',
//             profile.id
//           ], function(err) {
//             if (err) { return cb(err); }
//             var user = {
//               id: id.toString(),
//               name: profile.displayName
//             };
//             return cb(null, user);
//           });
//         });
//       } else {
//         // The Facebook account has previously logged in to the app.  Get the
//         // user record linked to the Facebook account and log the user in.
//         db.get('SELECT * FROM users WHERE id = ?', [ cred.user_id ], function(err, user) {
//           if (err) { return cb(err); }
//           if (!user) { return cb(null, false); }
//           return cb(null, user);
//         });
//       }
//     }
//   }
// ));

app.get("/",  function (req, res) {
    res.render("home");
})

app.get("/auth/google", passport.authenticate("google", {scope: ["profile"]})
)

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

// app.get('/login/facebook', passport.authenticate('facebook'));

// app.get('/oauth2/redirect/secrets',
//   passport.authenticate('facebook', { failureRedirect: '/login', failureMessage: true }),
//   function(req, res) {
//     res.redirect('/secrets');
//   }
// );


app.get("/login", function (req, res) {
    res.render("login");
})

app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    })
    req.login(user, function (err) {
        if(err){
            console.log(err)
            res.redirect("/login")
        }
        else{
            passport.authenticate("local")(req,res, function () {
                res.redirect("/secrets");
            })
        }
    })
})

app.get("/register", function (req, res) {
    res.render("register");
})

app.get("/secrets", function (req,res) {
    User.find({secret:{$ne: null}}, function (err, foundUsers) {
        if(err){
            console.log(er)
        }else{
            if(foundUsers){
                res.render("secrets", {usersWithSecrets: foundUsers})
            }
        }
    })
})

app.get("/logout", function (req, res) {
    req.logOut(function (err) {
        if(err){
            console.log(err)
        }
    })
    res.redirect("/")
})

app.post("/register", function (req, res) {
    User.register({username: req.body.username}, req.body.password, function (err, user) {
        if(err){
            console.log(err)
            res.redirect("/register");
        }else{
            passport.authenticate("local")(req,res, function () {
                res.redirect("/secrets")
            })
        }
    })
});

app.get("/submit", function (req, res) {
    if(req.isAuthenticated()){
        res.render("submit")
    }
    else{
        res.redirect("/login")
    }
})

app.post("/submit", function (req, res) {
    User.findById(req.user.id, function (err, foundUser) {
        if(err){
            console.log(err)
        }else{
            if(foundUser){
                foundUser.secret.push(req.body.secret)
                foundUser.save(function (error) {
                    if(error){
                        console.log(error)
                    }
                    else{
                        res.redirect("/secrets")
                    }
                })
            }
        }
    })
})

app.listen(3000, function () {
    console.log("Server started on port 3000")
})