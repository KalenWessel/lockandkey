var express = require("express"),
    http = require("http"),
    path = require("path"),
    mongoose = require("mongoose"),
    hash = require("./pass").hash;
var adminexpress = require("express")
var fs = require("fs");
require( "console-stamp" )( console, { pattern : "dd/mm/yyyy HH:MM:ss.l" } );

var app = express()
var admin = adminexpress()

// Read in key:values from config file
var data = fs.readFileSync("./lockandkeyconfig.json"),Config;
try {
  Config = JSON.parse(data);
} catch (err) {
  console.log("Error parsing config")
  console.log(err);
}

// Setup sendgrid
var sendgrid  = require("sendgrid")(Config.sendgridkey);

// Database and Model
mongoose.connect("mongodb://localhost/lockandkey");
var UserSchema = new mongoose.Schema({
    active: Boolean,
    username: String,
    password: String,
    salt: String,
    hash: String,
    lock: Boolean,
    start_date: Date,
    end_date: Date
});

var User = mongoose.model("users", UserSchema);

// Middlewares and configurations
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var session = require("express-session");
app.use(bodyParser());
app.use(session({secret: "1234567890QWERTY"}));
app.use("/", express.static(__dirname + "/public"));
app.set("views", __dirname + "/views");
app.set("view engine", "jade");

app.get("/", function (req, res) {
  res.redirect("/login");
});

app.use(function (req, res, next) {
  var err = req.session.error,
      msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = "";
  res.locals.session = req.session
  if (err) res.locals.message = err;
  if (msg) res.locals.message = msg;
  
  next();
});


// Helper Functions
function authenticate(name, pass, fn) {
  if (!module.parent) console.log("Attempting to authenticate %s", name);

  User.findOne({
    username: name, active: true
  },

  function (err, user) {
    if (user) {
      if (err) return fn(new Error("Cannot find user"));
	hash(pass, user.salt, function (err, hash) {
	  if (err) return fn(err);
	  if (hash == user.hash) return fn(null, user);
	    fn(new Error("Invalid password"));
	});
    } else {
      return fn(new Error("Cannot find user"));
    }
  });
}

function sendMail(subject, body) {

  sendgrid.send({
    to:       Config.emailto,
    from:     Config.emailfrom,
    subject:  subject,
    text:     body 
  }, function(err, json) {
    if (err) { return console.error(err); }
    console.log(json);
  });
}
function requiredAuthentication(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = "Access denied!";
    res.redirect('/login');
  }
}

function userExist(req, res, next) {
  User.count({
    username: req.body.username
  }, function (err, count) {
    if (count === 0) {
      next();
    } else {
      req.session.error = "That username already exists."
      res.redirect("/admin");
    }
  });
}

var bodyParser = require("body-parser")
// app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({extended: true}));  // to support URL-encoded bodies
admin.use(session({secret: "1234567890QWERTY"}));
admin.use(bodyParser.urlencoded({extended: true}));  // to support URL-encoded bodies


var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
var PickUpAndDialSix = false;

// use this to store port of desired modem
var modemport;
var modem;

serialport.list(function (err, ports) {
  ports.forEach(function(port) {
    if (!(port.manufacturer==undefined)) {
      if (port.manufacturer.search(Config.modem_id)>=0) {
	modemport=port.comName;
	console.log("Using modem on " + modemport);
      }
    }
  });

  if (modemport==undefined) {
    console.log("No modem found. Check that modem is connected and modem_id is set in lockandkeyconfig.json");
    process.exit(1);
  }

  modem = new SerialPort(modemport, {
    baudrate: 9600,
    parser: serialport.parsers.readline("\n")
  });

  function modemPickup(callback) {
    modem.write("ATH1\r", function () {
    });
  }

  //you would change this if your building took another number
  function modemDial6(callback) {
    modem.write("ATDT6\r", function () {
    });
  }

  function modemHangup(callback) {
    modem.write("ATH0\r", function () {
    });
  }

  modem.on("open", function () {
    console.log('open');
    // Increase dialtone length
    modem.write("ATS11=150\r", function(err, results) {
    });

    modem.on("data", function(data) {
      console.log(data);

      if ((data.substring(0,4) == "RING") && (PickUpAndDialSix == true)) {
	// Using delays worked better than reading an OK response from the modem and sending the next command. You may have to play with timeout values
	setTimeout(modemPickup, 200);
	setTimeout(modemDial6, 2000);
	setTimeout(modemHangup, 4000);
      }

      if ((data.substring(0,4) == "RING") && (PickUpAndDialSix == false)) {
	console.log("Ring detected, but don't pick up");
      }

      if (data.substring(0,2) == "OK") {
	console.log("Command Acknowledged");
      } else {
	console.log(data);
      }
    });
  });
});


var server = app.listen(Config.port, function () {

  var host = server.address().address
  var port = server.address().port

  console.log("Lock and Key - Public Interface Listening At http://%s:%s", host, port)
})

var adminserver = admin.listen(Config.adminport, function () {

  var host = adminserver.address().address
  var port = adminserver.address().port
  
  console.log("Lock and Key - Admin Interface Listening At http://%s:%s", host, port)
})


admin.use("/", express.static(__dirname + "/public"));
admin.use(function (req, res, next) {
  var err = req.session.error,
      msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = "";
  res.locals.session = req.session
  if (err) res.locals.message = err;
  if (msg) res.locals.message = msg;

  next();
});
admin.set("views", __dirname + "/views");
admin.set("view engine", "jade");
admin.get("/", function(req, res) {
  res.redirect("/admin");
});


//Run this periodically to see if we should re-lock the door (ie: set a flag to not answer and dial nine)
setInterval(function(){
  var setLock = function(){
    User.update({ "lock": false }, { $set: { "lock":true } }, {multi: true}, function(err, result){
      if ( err ) throw err;
      console.log("Setting lock and turning off auto-answers");
      PickUpAndDialSix = false;
    });
  }

  var queryAccess = function() {
    User.find(function(err, items) {
      if ( err ) throw err;
      items.forEach(function(item, index) {
        if ((Date.now() > item.end_date) && item.lock == false) {
	  setLock();
        }
      });
    });
  }
  queryAccess();
    
}, 10*1000);      

app.get("/login", function (req, res, next) {
  if (req.session.user) {
    res.redirect("/success")
  } else {
    res.render("login");
  }
});

app.get("/logout", function (req, res) {
  req.session.destroy(function () {
    res.redirect("/");
  });
});

app.get("/success", requiredAuthentication, function (req, res) {
  res.render("success", {
    username: req.session.user.username,
    endDate: req.session.enddate
  });
});

app.post("/login", function (req, res) {
  authenticate(req.body.username, req.body.password, function (err, user) {
    if (user) {
      req.session.regenerate(function () {
        var startDate = new Date();
        var endDate = new Date(startDate.getTime() + Config.unlocktimeout*60000);
        req.session.user = user;
        req.session.enddate = endDate
        req.session.success = "Authenticated as " + user.username + ", you have until: " + endDate + " to buzz up.";
        var setUser = function(){
	  User.update({username : user.username}, {$set:{start_date : startDate, end_date : new Date(endDate), lock : false}}, function(err, result){
	    if ( err ) throw err;
	    console.log("Updated: " + user.username);
	  });
	}
       
        // Send an email
        sendMail("Succesful Login", user.username + " has just logged in"); 
        // Turn On Auto Answer
        PickUpAndDialSix = true;
        setUser();
        res.render("success", {
          username: req.session.user.username,
          endDate: req.session.enddate
        });
      });
    } else {
      req.session.error = "Authentication failed, please check your username and password.";
      res.redirect("/login")
    }
  });
});

app.get("/ping", function(req, res) {
  res.render("ping");
});

admin.get('/admin', function(req, res) {
  User.find( {active: true}, function(err, userlist) {
    if (err) return console.error(err);
    res.render("admin", {
      "userlist" : userlist
    }); 
  });
});

admin.post("/disableuser", function (req, res) {
  User.update({ username: req.body.username, active: true}, {$set:{active: false}}, function(err) {
    if (err) throw err;
    res.redirect("admin");
  });
});

admin.post("/adduser", userExist, function (req, res) {
  var password = req.body.password;
  var username = req.body.username;

  hash(password, function (err, salt, hash) {
    if (err) throw err;
      var user = new User({
        active: true,
        username: username,
        salt: salt,
        hash: hash,
        lock: false,
        start_date: new Date(),
        end_date: new Date().getTime() + Config.unlocktimeout*60000
      }).save(function (err, newUser) {
        if (err) throw err;
        req.session.succcess = "User added";
        res.redirect('admin');
      });
  });
});
