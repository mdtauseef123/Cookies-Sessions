require('dotenv').config();
const express=require("express");
const bodyParser=require("body-parser");
const ejs=require("ejs");

//For Adding Cookies And Sessions
const session=require("express-session");
const passport=require("passport");
//We don't need to require passport-local because it's one of those dependencies that will be needed by passport-local-mongoose
//So we don't need to explicitly require in our app.js.
const passportLocalMongoose=require("passport-local-mongoose");



/*
In total we require 4 packages for this cookies and sessions to work.
1).express-session it is session not sessions
2).passport
3).passport-local
4).passport-local-mongoose

Order of writing code matters a lot.
*/



//Setting up the express server
const app=express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.listen(3000, function(){
    console.log("Server started on port 3000");
});


//Setting up the Sessions from the express-session package
app.use(session({
    secret: "secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {}
}));

 
//Initializing the passport
app.use(passport.initialize());
//This line will tell our app to use passport and set up the sessions.
app.use(passport.session());
//Everything above written are taken from passport.js Documentation

//Adding GET request for the different pages
app.get("/",function(req,res){
    res.render("home");
});


app.get("/login",function(req,res){
    res.render("login");
});


app.get("/register",function(req,res){
    res.render("register");
});


// Now if user try to access the secrets page then it will check if the user
// is already authenticated and if it is then it will redirect to login page.


/*
If we login, then logout (it redirects to the home page), if you press the previous page button (<--), 
it redirects to the secrets page, like if the session wasn't close.
In order to avoid this problem we use the following line in secrets page.
res.set('Cache-Control','no-cache, private, no-store, must-revalidate, max-stal e=0, post-check=0, pre-check=0');
it's fairly common behavior, which is why many sites tell you to close your browser after logging out.
Passport doesn't destroy the session, it only removes the user from the session.
Paging back, without closing the browser, the session is still there.
The res.set() line will clear the cookies AND fully destroy the session on logout without a browser close.
*/
app.get("/secrets", function(req, res) {
  res.set('Cache-Control','no-cache, private, no-store, must-revalidate, max-stal e=0, post-check=0, pre-check=0');
    if (req.isAuthenticated()) {
      res.render("secrets");//If they directly finding for the secrets page and the user is authenticated.
    } else {
      res.redirect("/login");//If the user is not authenticated then go for login page.
    }
});


//De-Authenticate the user and end that user session.
app.get("/logout", function(req, res){
    //logout() comes from passport
    req.logout(function(err) {
      if(err){
        console.log(err);
      }
    });
    res.redirect("/");
});



//Setting up the mongoose
const mongoose=require("mongoose");
let db = "";
async function main(){
    try{
        db = mongoose.connect("mongodb://127.0.0.1:27017/userDB", {useNewUrlParser: true});
        console.log("Successfully Connected to the Database");
    } catch(err) {
        console.log(err);
    }
}
main();
const user_schema = new mongoose.Schema({
    email: String,
    password: String
});

//Setting up the schema for for hash and salting our password and to save our user's data in MongoDB.
user_schema.plugin(passportLocalMongoose);


//Creating the Model
const User=mongoose.model("users",user_schema);

//Passport/Passport-Local Configuration i.e passport-local-mongoose
passport.use(User.createStrategy()); //->To create a local log-in strategy.
//Serializing means creating the cookies and storing the user data.
passport.serializeUser(User.serializeUser());
//Deserializing means getting the information from the cookies.
passport.deserializeUser(User.deserializeUser());


//User.register() comes from passport-local-mongoose package
//It will create the user,save the user and interact with Mongoose Directly. 
app.post("/register", function(req, res){
    User.register({username: req.body.username}, req.body.password, function(err, user) {
      if(err){
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function() {
          // The authentication will only be successful only if we manage to 
          // successfully setup a cookie that saved their current log-in session.
          // Only then we will redirect the user to secrets page.
          res.redirect("/secrets");//We can res.render but the best practice is to use redirect() the reason is explained
        });
      }
    });  
});


/*

It will store users data in the following format:-
{
    "_id" : ObjectId("object-id"),
    "username" : "checking1@gmail.com",
    "salt" : "random-generated-characters",
    "hash" : "hash-generated-from-salt-and-password-using-hash-function",
    "__v" : NumberInt(0)
}


*/

/*


**********Why redirecting not rendering the secrets in login and register page??**************


Now notice that previously we never had a secrets route because we always relied on res.rendering
the secrets page either through register or through login.
But in this case because we're authenticating our user and setting up a logged in session for them then
even if they just go directly to the secret page, they should automatically be able to view it if they
are in fact still logged in.So that's why we need to create our secrets route.

res.redirect(someURL) is for you want to return a 30x status code (often 302) 
to the browser and tell the browser to go to a new URL. 
This is often done on the server as part of a login process and occasionally when 
the user finds themselves at an old URL that has been changed to something different.
res.redirect() should only be used for these types of forced navigation to a different URL 
and should never be part of any standard rendering process.

res.render(filename, data) is how one would typically use EJS 
(or any other template engine plugged into Express) to fill in a template with some data 
and return the "rendered" HTML page back to the requesting browser so the browser can render it.


*/

// This is the login route, which authenticates first and THEN
// does the login (which is required to create the session)
// A failed login (wrong password) will not create the session and route us to the root route(We can send it to any route).
app.post("/login",passport.authenticate("local", {failureRedirect: "/"}), function(req,res){
  const user = new User({
      username: req.body.username,
      password: req.body.password
  });
  //login() comes from passport
  req.login(user, function(err){
      if(err){
          console.log(err);
          res.redirect("/register");
      }else{
          res.redirect("/secrets");
      }
  });
});

/*
So both when they've successfully registered and when they've successfully logged in using the right
credentials, we're going to send a cookie and tell the browser to hold onto that cookie because the cookie
has a few pieces of information that tells our server about the user, namely that they are authorized
to view any of the pages that require authentication in our case it is secrets page.
*/




//Restarting the server or closing the browser will delete the cookies and your session gets restarted.
