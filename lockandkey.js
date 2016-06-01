var express = require('express'),
    http = require('http'),
    path = require('path'),
    mongoose = require('mongoose'),
    hash = require('./pass').hash;
var adminexpress = require('express')
var validator = require('node-validator');
var fs = require('fs');
require( "console-stamp" )( console, { pattern : "dd/mm/yyyy HH:MM:ss.l" } );


var app = express()
var admin = adminexpress()

/*
Database and Models
*/
mongoose.connect("mongodb://localhost/myapp");
var UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    salt: String,
    hash: String,
    lock: Boolean,
    start_date: Date,
    end_date: Date
});

var User = mongoose.model('users', UserSchema);
/*
Middlewares and configurations
*/

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
app.use(bodyParser());
app.use(cookieParser('Authentication Tutorial '));
app.use(session({secret: '1234567890QWERTY'}));
app.use('/', express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.get("/", function (req, res) {
  res.redirect("/login");
});

app.use(function (req, res, next) {
  var err = req.session.error,
      msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  res.locals.session = req.session
  if (err) res.locals.message = err;
  if (msg) res.locals.message = msg;
  
  next();
});


/*
Helper Functions
*/
function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s', name);

  User.findOne({
    username: name
  },

  function (err, user) {
    if (user) {
      if (err) return fn(new Error('cannot find user'));
	hash(pass, user.salt, function (err, hash) {
	  if (err) return fn(err);
	  if (hash == user.hash) return fn(null, user);
	    fn(new Error('invalid password'));
	});
    } else {
      return fn(new Error('cannot find user'));
    }
  });
}

function requiredAuthentication(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
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
      req.session.error = "User Exist"
      res.redirect("/signup");
    }
  });
}

var bodyParser = require('body-parser')
// app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({       extended: true}));  // to support URL-encoded bodies
admin.use(bodyParser.urlencoded({       extended: true}));  // to support URL-encoded bodies


// Config
var data = fs.readFileSync('./lockandkeyconfig.json'),Config;
try {
  Config = JSON.parse(data);
} catch (err) {
  console.log('Error parsing config')
  console.log(err);
}

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
    console.log("No modem found.  Check that modem is connected and modem_id is set in lockandkeyconfig.json");
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

    modem.on('data', function(data) {
      console.log(data);

      if ((data.substring(0,4) == "RING")&&(PickUpAndDialSix == true)) {
	// Using delays worked better than reading an OK response from the modem and sending the next command. You may have to play with timeout values
	setTimeout(modemPickup, 200);
	setTimeout(modemDial6, 2000);
	setTimeout(modemHangup, 4000);
      }

      if ((data.substring(0,4) == "RING")&&(PickUpAndDialSix == false)) {
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

  console.log('Lock and Key - Public Interface Listening At http://%s:%s', host, port)
})

var adminserver = admin.listen(Config.adminport, function () {

  var host = adminserver.address().address
  var port = adminserver.address().port
  
  console.log('Lock and Key - Admin Interface Listening At http://%s:%s', host, port)
})


//app.use('/', express.static(__dirname + '/public'));
admin.use('/', express.static(__dirname + '/admin'));
admin.get('/', function(req, res) {
  res.sendFile('admin.html', { root: __dirname  + '/admin'}); 
});

admin.get('/admin', function(req, res) {
  res.sendFile('admin.html', { root: __dirname  + '/admin'}); 
});


admin.post('/addaccess', function (request, response) {

  console.log(request.body);
  //this is where we can do the post
  errmsg = "";
			
  if (!validator.isIsoDate(request.body.startdate)) {errmsg=errmsg +"Bad start date. ";}
  if (!validator.isIsoDate(request.body.stopdate)) {errmsg=errmsg +"Bad stop date. ";}
  if (request.body.password.length<10) {errmsg=errmsg +"Password must be at least 10 characters. ";}
  if (request.body.note.length<1) {errmsg=errmsg +"Please enter a note. ";}
		
  if (errmsg.length>0) {
    response.redirect('/admin?error='+encodeURIComponent(errmsg));
  }
		
  password = bcrypt.hashSync(request.body.password);
  startdate = request.body.startdate;
  stopdate = request.body.stopdate;
  note = request.body.note;
			
  if (typeof request.body.admin !== 'undefined') { admin = 'TRUE'; } else { admin = 'FALSE';} 
    try {
      console.log(query);
      response.redirect('/admin?success');
    } catch (exception) {
      response.redirect('/admin?error');
    }
});	


admin.post('/delete', function (request, response){
  // this is where we can do the post
  errmsg = "";
			
  if (!validator.isInteger(request.body.id)) {errmsg=errmsg +"Invalid record ";}
  if (errmsg.length>0) {
    response.redirect('/admin?recordbad='+encodeURIComponent(errmsg));
  }
		
  try {
    query = "DELETE FROM access WHERE id="+request.body.id+";";
    console.log(query);
    db.run(query);
    response.redirect('/admin?recordgood');
  } catch (exception) {
    response.redirect('/admin?recordbad');
  }
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

app.get("/login", function (req, res) {
  res.render("login");
});

app.get('/logout', function (req, res) {
  req.session.destroy(function () {
    res.redirect('/');
  });
});

app.get("/success", requiredAuthentication, function (req, res) {
  res.render('success', {
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
        req.session.success = 'Authenticated as ' + user.username + ', you have until: ' + endDate + ' to buzz up.';
        var setUser = function(){
	  User.update({username : user.username}, {$set:{start_date : startDate, end_date : new Date(endDate), lock : false}}, function(err, result){
	    if ( err ) throw err;
	    console.log("Updated: " + result);
	  });
	}
        
        // Turn On Auto Answer
        PickUpAndDialSix = true;
        setUser();
        res.render('success', {
          username: req.session.user.username,
          endDate: req.session.enddate
        });
      });
    } else {
      req.session.error = 'Authentication failed, please check your ' + ' username and password.';
      res.redirect('/login');
    }
  });
});

app.get("/signup", function (req, res) {
  if (req.session.user) {
    res.redirect("/");
  } else {
    res.render("signup");
  }
});

app.post("/signup", userExist, function (req, res) {
  var password = req.body.password;
  var username = req.body.username;

  hash(password, function (err, salt, hash) {
    if (err) throw err;
      var user = new User({
        username: username,
        salt: salt,
        hash: hash,
        lock: false,
        start_date: new Date(),
        end_date: new Date()
      }).save(function (err, newUser) {
        if (err) throw err;
          authenticate(newUser.username, password, function(err, user){
            if (user){
              req.session.regenerate(function(){
                req.session.user = user;
                req.session.success = 'Authenticated as ' + user.username + ' click to <a href="/logout">logout</a>. ' + ' You may now access <a href="/restricted">/restricted</a>.';
                res.redirect('/');
              });
            }
          });
      });
  });
});
