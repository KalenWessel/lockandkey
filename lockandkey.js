var express = require('express')
var adminexpress = require('express')
var sqlite3 = require('sqlite3').verbose();
var bcrypt = require('bcrypt-nodejs');
var validator = require('node-validator');
var fs = require('fs');
require( "console-stamp" )( console, { pattern : "dd/mm/yyyy HH:MM:ss.l" } );

/* A note on security
 * 
 * I find that no one remembers passwords, let alone infrequently used URLs.  So, I haven't setup an admin login.
 * 
 * To facilitate administration, I run two webservers
 * One on an internal "admin only" port, presumably hidden behind a firewall
 * The app one should be externally accessible
 * 
 * This is probably the biggest security issue, and I'm aware of it.  If you're reading this, and identify other issues, I'd like to know them.
 * 
 * I chose bcrypt because faults are widely known in other algorithms, but given the other gaps in this application, this is likely
 * the smallest concern.
 * 
 * Because I haven't setup login names, it has to manually compute the supplied passphrase hash against hashes in the DB line by line.
 * If you have more than a couple passphrases setup, this will take forever.  Given enough, and client browsers will time out.
 * 
 * 
 */

var app = express()
var admin = adminexpress()


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
var PickUpAndDialNine = false;
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

      if ((data.substring(0,4) == "RING")&&(PickUpAndDialNine == true)) {
	// Using delays worked better than reading an OK response from the modem and sending the next command. You may have to play with timeout values
	setTimeout(modemPickup, 200);
	setTimeout(modemDial6, 2000);
	setTimeout(modemHangup, 4000);
      }

      if ((data.substring(0,4) == "RING")&&(PickUpAndDialNine == false)) {
	console.log("Ring Detected, but don't pick up");
      }

      if (data.substring(0,2) == "OK") {
	console.log("Command Acknowledged");
      } else {
	console.log(data);
      }
    });
  });
});


var db = new sqlite3.Database('lockandkey.db');
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


app.use('/', express.static(__dirname + '/public'));
admin.use('/', express.static(__dirname + '/admin'));
admin.get('/', function(req, res) {
  res.sendFile('admin.html', { root: __dirname  + '/admin'}); 
});

admin.get('/admin', function(req, res) {
  res.sendFile('admin.html', { root: __dirname  + '/admin'}); 
});

admin.get('/access', function(req, res) {
  db.all("select * from access;", function(err, rows) {
  res.send(JSON.stringify(rows));
  });
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
      query = "INSERT INTO access (password, note, startdate, stopdate, admin) VALUES ('"+password+"','"+note+"','"+startdate+"','"+stopdate+"','"+admin+"');";
      console.log(query);
      db.run(query);
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

  db.serialize(function() {
    console.info("Checking locks");
    db.all("SELECT * FROM lock WHERE locked = 'TRUE' and current_timestamp > datetime(timestamp, '+"+Config.unlocktimeout+" Minute');", function(err, row) {
      if (row.length > 0){
	//turn off auto-answer
	PickUpAndDialSix = false;
		    
	// clear lock
	console.log("Clear Lock");
		    
	db.run("UPDATE lock SET locked = 'FALSE' where id =1;");
      }
    });
  });
}, 10*1000);      

app.post('/authorize', function (request, response) {
  var match = false;

  db.each("SELECT password FROM access WHERE startdate<=current_timestamp and date(stopdate, \'+1 day\')>=current_timestamp", function(err, row) {
    if (match==false) {
      console.log("web:"+request.body.pwd);
      dbpassword = row.password;
      console.log("db:"+dbpassword)
      match = bcrypt.compareSync(request.body.pwd,row.password);
      console.log("match:" + match );
      if (match) {
        console.log("Log in succesful, setting lock, turn on auto answer");
        db.run("UPDATE lock SET timestamp= current_timestamp, locked= 'TRUE' WHERE id = 1;");
        // Turn On Auto Answer
        PickUpAndDialSix = true;
        //response.sendFile('success.html', { root: __dirname  + '/public'}); 	
        response.redirect('success.html?unlocktimeout='+Config.unlocktimeout);
      }
    }
  }, function(err, rows) {
    if (match == false) {
      response.redirect('/?error');
    }
  });
});

