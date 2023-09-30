// Basics
const crypto = require("node:crypto");
const path = require("node:path");
const { exec } = require('node:child_process');
const fs = require("node:fs");

// Web
const http = require('http');
const express = require('express');
const multer = require('multer');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');

// Ours
const { Logger } = require("./LogMan.js");
const NeptuneCrypto = require('./NeptuneCrypto.js');


const isWin = process.platform === "win32"; // Can change notification handling behavior

/**
 * Time to wait before ending HTTP requests (if the server never did it itself)
 * @type {number}
 */
const autoKillRequestTimeout = (global.__TESTING !== undefined && global.__TESTING === true)? 5000 : 30000;

/**
 * Web log
 * @type {Logger}
 */
global.Focus.webLog = global.Focus.logMan.getLogger("Web");



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


const app = express();
app.use(cookieParser(NeptuneCrypto.randomString(1024)));
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.json());
var upload = multer({
	dest: path.join(global.dataDirectory, 'uploads'),
	limits: {
		fileSize: 40000000, // 40MB
	},
	fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname);
        if(ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') { // Only allow JPG's
            return callback(new Error('Only images are allowed'));
        }
        callback(null, true);
    },
}); // For uploads

app.use((req, res, next)=> {
  Focus.webLog.debug(`${req.method}: ${req.url}. IP(s): "${req.ip || req.ips.join(",")}". Body:`);
  Focus.webLog.debug(req.body);
  next();
})


const httpServer = http.createServer(app);


// Routes
const userAPI = require('./API/v1/User.js');
const shootAPI = require('./API/v1/Shoot.js');



app.use('/api/v1/user', userAPI);
app.use('/api/v1/shoot', shootAPI);



// Main web


// Heartbeat
var sounds = ["Thoomp-thoomp", "Bump-bump", "Thump-bump"];
app.get("/heartbeat", (req, res) => {
	let sound = sounds[Math.floor(Math.random()*sounds.length)];
	Focus.webLog.verbose(sound + " (heartbeat)");
	res.status(200).end('{ "status": "okay" }');
});


// Web page
app.get("/", (req, res) => {
	res.redirect('dashboard');
});
app.get("/index.html", (req, res) => {
	res.redirect('dashboard')
})


app.get('/dashboard', (req, res) => {
	console.log("[Web] Page hit: /dashboard");
	res.sendFile(__dirname + '/Web/dashboard.html');
});


app.get("/myaccount", (req, res) => {
	res.sendFile(__dirname + '/Web/myaccount.html');
});
app.get("/login", (req, res) => {
	res.sendFile(__dirname + '/Web/login.html');
});
app.get("/logout", (req, res) => {
		res.sendFile(__dirname + '/Web/logout.html');
});
app.get("/register", (req, res) => {
	res.sendFile(__dirname + '/Web/register.html');
});

app.get('/images/image-not-found.jpg', (req, res) => {
	res.sendFile(__dirname + '/image-not-found.jpg');
});
app.get('/image-not-found.jpg', (req, res) => {
	res.sendFile(__dirname + '/image-not-found.jpg');
});
app.get('/images/loader.gif', (req, res) => {
	res.sendFile(__dirname + '/Web/images/loader.gif');
});

app.get('/css/style.css', (req, res) => {
	res.sendFile(__dirname + '/Web/css/style.css');
});
app.get('/css/login-style.css', (req, res) => {
	res.sendFile(__dirname + '/Web/css/login-style.css');
});

app.get('/js/focus.js', (req, res) => {
	res.sendFile(__dirname + '/Web/js/focus.js');
});
app.get('/js/Shoot.js', (req, res) => {
	res.sendFile(__dirname + '/Web/js/Shoot.js');
});
app.get('/js/jquery-3.3.1.min.js', (req, res) => {
	res.sendFile(__dirname + '/Web/js/jquery-3.3.1.min.js');
});
app.get('/js/random-image.js', (req, res) => {
	res.sendFile(__dirname + '/Web/js/random-image.js');
});




module.exports = { 
	app: app,
	httpServer: httpServer,
};