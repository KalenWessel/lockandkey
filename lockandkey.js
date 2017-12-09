var express = require("express"),
    http = require("http"),
    path = require("path")
var fs = require("fs");
require( "console-stamp" )( console, { pattern : "dd/mm/yyyy HH:MM:ss.l" } );

var app = express()

// Read in key:values from config file
var data = fs.readFileSync("./lockandkeyconfig.json"),Config;
try {
  Config = JSON.parse(data);
} catch (err) {
  console.log("Error parsing config")
  console.log(err);
}

// Middlewares and configurations
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var session = require("express-session");
app.use(bodyParser());
app.use(session({secret: "1234567890QWERTY"}));
app.use("/", express.static(__dirname + "/public"));
app.set("views", __dirname + "/views");
app.set("view engine", "jade");

app.get("/login", function (req, res) {
  if (req.query.token == Config.secret_token) {
    PickUpAndDialSix = true;
    res.send('Accepted');
    setTimeout(function() {
      PickUpAndDialSix = false; 
    }, 20000); //force delay of 20 seconds.
  } else {
    res.send('Denied');
  }
});

var bodyParser = require("body-parser")
// app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({extended: true}));  // to support URL-encoded bodies


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

app.get("/ping", function(req, res) {
  res.render("ping");
});

