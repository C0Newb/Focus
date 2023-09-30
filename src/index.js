'use strict';
/*

	 _____           _         _       ___                    
	|  _  |___ ___  |_|___ ___| |_    / __\__   ___ _   _ ___ 
	|   __|  _| . | | | -_|  _|  _|  / _\/ _ \ / __| | | / __|
	|__|  |_| |___|_| |___|___|_|   / / | (_) | (__| |_| \__ \
	              |___|             \/   \___/ \___|\__,_|___/

	Photo Showcase Site

*/
// Which came first? Chicken or the egg?
const Version = require('./Version.js');
const isWin = process.platform === "win32";


const path = require('node:path');
global.dataDirectory = path.join(__dirname, "..", "Data");
global.webDirectory = path.join(__dirname, "Web");




// Global behavioral changes (static stuff)
/**
 * Debug mode - special stuff
 * @type {boolean}
 */
const debug = true; // change this later idk

/**
 * output the silly log level to console (it goes	every other level > silly, silly is the lowest priority, literal spam)
 * @type {boolean}
 */
const displaySilly = true; // 
Error.stackTraceLimit = (debug)? 8 : 4;
global.consoleVisible = true;


/** @namespace Focus */
const Focus = {};
/** @type {Focus} */
global.Focus = Focus; // Anywhere down the chain you can use process.Focus. Allows us to get around providing `Focus` to everything

/**
 * Focus version
 * @type {Version}
 */
Focus.version = new Version(1, 1, 0, ((debug)?"debug":"release"), "rd1");


// Type definitions
/**
 * True if running on Windows
 * @type {boolean}
 */
Focus.isWindows = isWin;

/**
 * True if in debug mode
 * @type {boolean}
 */
Focus.debugMode = debug;


Focus.Shoots = new Map();
Focus.Users = new Map();



/*
 * Pull in externals here, imports, libraries
 * 
 */
// Basic
const fs = require("node:fs")
const EventEmitter = require('node:events');
const util = require('node:util');

// Crypto
const keytar = require("keytar");

// Interaction
const readline = require("readline");


// Classes
const ConfigurationManager = require('./ConfigurationManager.js');
const FocusConfig = require('./FocusConfig.js');
const { LogMan, Logger } = require('./LogMan.js');
const NeptuneCrypto = require('./NeptuneCrypto.js');
const Shoot = require('./Shoot.js');
const User = require('./User.js');
const SessionProvider = require('./SessionManager.js');



/** @type {ConfigurationManager} */
Focus.configurationManager;
/** @type {FocusConfig} */
Focus.config;



if (!fs.existsSync(global.dataDirectory))
	fs.mkdirSync(global.dataDirectory);


// Logging
/** @type {LogMan.ConstructorOptions} */
let logOptions = {
	fileWriteLevel: {
		debug: debug,
		silly: debug
	},
	consoleDisplayLevel: {
		debug: debug,
		silly: displaySilly
	},
	cleanLog: true,
	consoleMessageCharacterLimit: (debug? 1250 : 750),
	fileMessageCharacterLimit: (debug? 7500 : 4000),
}
/**
 * Focus Log creator
 * @type {LogMan}
 */
Focus.logMan = new LogMan("Focus", path.join(global.dataDirectory, "./logs"), logOptions);
// Log name: Focus, in the logs folder, do not display silly messages (event fired!)

/**
 * Focus main logger
 * @type {Logger}
 */
Focus.log = Focus.logMan.getLogger("Focus"); // You can call this (log) to log as info

Focus.logMan.on('close', () => { // Reopen log file if closed (and not shutting down)
	if (!global.shuttingDown && !Focus.shuttingDown) {
		console.warn("..log file unexpectedly closed..\nReopening ...");
		Focus.logMan.reopen();
	}
});


// For debugging, allows you to output a nasty object into console. Neat
var utilLog = function(obj, depth) {
	Focus.log.debug(util.inspect(obj, {depth: (depth!=undefined)? depth : 3}));
}

// This is our "error" handler. seeeesh
process.on('unhandledRejection', (error) => {
	try {
		Focus.log.error('Unhandled rejection: ' + error.message + "\n" + error.stack, debug);
		Focus.log.error(error, false);
		// Should close now..
	} catch {
		console.error(error);
	}
});
process.on('uncaughtException', (error) => {
	try {
		Focus.log.error('Unhandled exception: ' + error.message + "\n" + error.stack, debug);
		Focus.log.error(error, false);
	} catch {
		console.error(error);
	}
});


// Events
// would like the below to be "cleaner" but eh
class EmitterLogger extends require('events') {
	#name;
	constructor(name) { super(); this.#name = name; }
	emit(type, ...args) {
		Focus.log.debug("Event Focus.events." + this.#name + "@" + type + " fired | " + util.inspect(arguments, {depth: 1}), false);
		super.emit(type, ...args);
	}
}

/**
 * Focus events
 * @namespace
 */
Focus.events = {
	/**
	 * Application events (UI related)
	 * @type {EventEmitter}
	 */
	application: new EmitterLogger("application"),

	/**
	 * Server events (new device connected, device paired)
	 * @type {EventEmitter}
	 */
	server: new EmitterLogger("server")
}

// Shutdown handling
/**
 * Call this function to initiate a clean shutdown
 * @param {number} [shutdownTimeout=1500] - Time to wait before closing the process
 */
async function Shutdown(shutdownTimeout) {
	if (typeof shutdownTimeout !== "number") {
		shutdownTimeout = 250;
	}

	global.shuttingDown = true; // For when we kill the logger
	Focus.events.application.emit('shutdown', shutdownTimeout)
}
process.Shutdown = Shutdown;

/**
 * Whether Focus is currently shutting down or not.
 * @type {boolean}
 */
Focus.shuttingDown = false;

/**
 * @event Focus.events.application#shutdown
 * @type {object}
 * @property {number} shutdownTimeout - Amount of time to wait before shutting down completely.
 */
Focus.events.application.on('shutdown', (shutdownTimeout) => {
	if (Focus.shuttingDown)
		return;

	Focus.saveShoots();
	Focus.saveUsers();

	Focus.log.info("Shutdown signal received, shutting down in " + (shutdownTimeout/1000) + " seconds.");
	Focus.shuttingDown = true;


	setTimeout(()=>{
		Focus.config.saveSync();
		Focus.log.info("Goodbye world!");
		process.exit(0);
	}, shutdownTimeout);
});
process.on('beforeExit', code => {
	global.shuttingDown = true;
	// Focus.log("Exit code: " + code);
	Focus.logMan.close();
});
process.on('SIGTERM', signal => {
	Focus.log.warn(`Process ${process.pid} received a SIGTERM signal`);
	Shutdown(500);
})

// User console input
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
if (process.stdin !== undefined) {
	rl.on("close", function () { // to-do: realize, hey, there's no console.
		Shutdown(); // Capture CTRL+C
	});
}




/**
 * Loads the users from the disk and puts them into `Focus.Users`
 * @return {void}
 */
Focus.loadUsers = function() {
	Focus.log("Loading users");
	Focus.config.loadSync();
	Focus.Users.clear();
	let loadedUsers = 0;
	Focus.config.users.forEach((username) => {
		if (path.join(global.userData, username + ".json")) {
			Focus.Users.set(username, Focus.configurationManager.loadConfig(username, User));
			loadedUsers += 1;
		} else
			Focus.log.warn("Attmept to load a user that does not exist: " + username);
	});
	Focus.log(`Loaded ${loadedUsers} users`);
}
/**
 * Saves the users from `Focus.Users` into the `user.json` file.
 * @param {boolean} [saveUserConfigs = true] - Whether to call `.save()` on each user.
 * @return {void}
 */
Focus.saveUsers = function(saveUserConfigs) {
	saveUserConfigs = saveUserConfigs !== false;
	Focus.log("Saving users.");

	Focus.config.users = [];
	Focus.Users.forEach((user, username) => {
		if (saveUserConfigs)
			user.save();
		Focus.config.users.push(username);
	});
	
	Focus.config.saveSync();
	Focus.log(`Saved ${Focus.config.users.length} users.`);
}


/**
 * Loads all tracked shoots in the FocusConfig in.
 * @return {void}
 */
Focus.loadShoots = function() {
	Focus.log("Loading shoots");
	let loadedShoots = 0;
	Focus.config.shoots.forEach((shootId) => {
		let shootConfigPath = path.join(global.shootsData, shootId + ".json");
		if (fs.existsSync(shootConfigPath)) {
			loadedShoots += 1;
			let shoot = Focus.configurationManager.loadConfig(shootId, Shoot, true);
			Focus.Shoots.set(shootId, shoot);
		} else
			Focus.log.warn("Attempt to load a shoot that does not exist: " + shootId);
	});
	Focus.log(`Loaded ${loadedShoots} shoots`);
}
/**
 * This only saves the shoots to the FocusConfig.
 * @return {void}
 */
Focus.saveShoots = function() {
	Focus.config.shoots = [];
	Focus.Shoots.forEach((shoot, shootId) => {
		shoot.save();
		Focus.config.shoots.push(shootId);
	});
	Focus.config.saveSync();
}





// Begin

const endTerminalCode = "\x1b[0m"; // Reset font color
if (!debug) {
	process.stdout.write("\x1B[0m\x1B[2;J\x1B[1;1H"); // Clear the terminal
	console.clear();
	console.log(endTerminalCode + "--== Focus ==--");
} else {
	console.log(endTerminalCode);
}

Focus.log.info("Hello world!"); // :wave:

if (!debug) {
	Focus.log("\x1b[1m\x1b[47m\x1b[34mProduction" + endTerminalCode + ", version: " + Focus.version.toString()); // Production mode
}
else
	Focus.log("\x1b[1m\x1b[41m\x1b[33m**DEV MODE**" + endTerminalCode + ", version: " + Focus.version.toString()); // Developer (debug) mode

Focus.log("Running on \x1b[1m\x1b[34m" + process.platform);





// Is this ugly? Yes.
// Does it work? Yes.
// Do I like it? No.

async function main() {
	global.configurationPath = "FocusConfig";
	global.shootsData = path.join(global.dataDirectory, "shoots");
	global.imageData = path.join(global.dataDirectory, "shoot-images");
	global.userData = path.join(global.dataDirectory, "users");
	global.tempData = path.join(global.dataDirectory, "temp");
	global.uploadsData = path.join(global.dataDirectory, "uploads");

	if (!fs.existsSync(global.shootsData))
		fs.mkdirSync(global.shootsData);
	if (!fs.existsSync(global.imageData))
		fs.mkdirSync(global.imageData);
	if (!fs.existsSync(global.userData))
		fs.mkdirSync(global.userData);

	// clean
	if (fs.existsSync(global.uploadsData))
		fs.rmSync(global.uploadsData, {
			recursive: true,
			retryDelay: 250,
			maxRetries: 3,
			force: true
		});
	fs.mkdirSync(global.uploadsData);

	if (fs.existsSync(global.tempData))
		fs.rmSync(global.tempData, {
			recursive: true,
			retryDelay: 250,
			maxRetries: 3,
			force: true
		});
	fs.mkdirSync(global.tempData);



	var firstRun = (fs.existsSync(path.join(global.dataDirectory, global.configurationPath + ".json")) === false);

	// stored in the credential manager
	let encryptionKey = await keytar.getPassword("Focus","ConfigKey");
	let keyFound = (encryptionKey !== null && encryptionKey !== "");
	if (encryptionKey == null)
		encryptionKey = undefined;


	try {
		Focus.configurationManager = new ConfigurationManager(global.dataDirectory, (keyFound)? encryptionKey : undefined);
		Focus.config = Focus.configurationManager.loadConfig(global.configurationPath, FocusConfig);

		// For whatever reason, this try block just does not work! Very cool!
		// manually check the encryption:
		let encryptionCheck = fs.readFileSync(path.join(global.dataDirectory, global.configurationPath + ".json"));
		if (NeptuneCrypto.isEncrypted(encryptionCheck)) { // if there's actual encryption.
			encryptionCheck = NeptuneCrypto.decrypt(encryptionCheck, encryptionKey);
			// eh probably worked.
			encryptionCheck = JSON.parse(encryptionCheck);
			encryptionCheck = {}; // good enough
		}
	} catch (err) {
		if (err instanceof NeptuneCrypto.Errors.InvalidDecryptionKey) {
			Focus.log.error("Encryption key is invalid! Data is in a limbo state, possibly corrupted.");
			Focus.log.warn("Focus will halt. To load Focus, please fix this error by deleting/moving the config files, fixing the encryption key, or fixing the configs.");
		} else if (err instanceof NeptuneCrypto.Errors.MissingDecryptionKey) {
			Focus.log.error("Encryption key is missing! Data is still there, but good luck decrypting it !");
			Focus.log.warn("Focus will halt. To load Focus, please fix this error by deleting/moving the config files, fixing the encryption key, or fixing the configs.");
		} else {
			Focus.log.error("Config is completely broken!");
		}

		Focus.log.debug("Encryption KEY: " + encryptionKey);

		console.log("")
		Focus.log.critical(" === ::error on read Focus config:: === ");
		Focus.log.critical(err);

		console.log("");
		Focus.log.error("Stack: ");
		Focus.log.error(err.stack);

		process.exitCode = -1;
		process.exit();
	}

	let data = Focus.config.readSync();
	if (data == "" || data == "{}") {
		firstRun = true;
		Focus.log.verbose("Config is completely empty, setting as first run...");
	} else {
		if (Focus.config.firstRun === true) {
			firstRun = true;
			Focus.log.verbose("Config has firstRun set to true. Either a reset or a new config.");
		}
	}
	if (firstRun) {
		Focus.log.verbose("First run! Generated default config file.");
	
		Focus.config = new FocusConfig(Focus.configurationManager, global.configurationPath);
		Focus.config.encryption.enabled = !debug || true;
		Focus.config.firstRun = false;
		Focus.config.saveSync();

		if (!keyFound && Focus.config.encryption.enabled) {
			// Set a new key
			Math.random(); // .. seed the machine later (roll own RNG ? Probably a bad idea.)
			encryptionKey = NeptuneCrypto.randomString(Focus.config.encryption.newKeyLength, 33, 220);
			Focus.log.verbose("Generated encryption key of length " + Focus.config.encryption.newKeyLength);
			keytar.setPassword("Focus","ConfigKey",encryptionKey);
			Focus.configurationManager.setEncryptionKey(encryptionKey);
			Focus.log.verbose("Encryption key loaded");
			Focus.config.saveSync();
		} else if (keyFound && Focus.config.encryption.enabled) {
			Focus.log.verbose("Encryption key loaded from OS keychain");
		}
	}

	if (keyFound && Focus.config.encryption.enabled === false) {
		Focus.log.verbose("Key found, yet encryption is disabled. Odd. Running re-key to completely disable.")
		Focus.configurationManager.rekey(); // Encryption is set to off, but the key is there? Make sure to decrypt everything and remove key
	}


	if (Focus.config.encryption.enabled && (encryptionKey !== undefined && encryptionKey !== ""))
		Focus.log("File encryption \x1b[1m\x1b[32mACTIVE" + endTerminalCode + ", file security enabled");
	else {
		Focus.log("File encryption \x1b[1m\x1b[33mDEACTIVE" + endTerminalCode + ", file security disabled.");
		Focus.log.debug("Focus config:");
		utilLog(Focus.config);
	}
	if (encryptionKey !== undefined) {
		encryptionKey = NeptuneCrypto.randomString(encryptionKey.length); // Don't need that, configuration manager has it now
	}

	Focus.sessionProvider = new SessionProvider();
	// Load users, shoots
	Focus.loadUsers();
	Focus.loadShoots();



	var { app, httpServer } = require('./ExpressApp.js');
	// Listener
	try {
		httpServer.listen(Focus.config.web.port, () => {
			Focus.webLog.info("Express server listening on port " + Focus.config.web.port);
		});
	} catch (error) {
		Focus.webLog.critical("!!!Express server error!!!");
		Focus.webLog.critical(error);
	}


}


if (debug) {
	main(); // I don't want that stupid crash report
} else {
	main().catch((err) => { // oh man

		var crashReportWritten = false;
		try {
			// Write crash report
			let dateTime = new Date();
			let date = dateTime.toISOString().split('T')[0];
			let time = dateTime.toISOString().split('T')[1].split('.')[0]; // very cool
			
			let crashReport = `He's dead, Jim.

Focus has crashed catastrophically, here's what we know:

DateTime: ${dateTime.toISOString()}\\
Focus version: ${Focus.version}\\
Debug: ${debug}
Platform: ${process.platform}


== Error info ==\\
Message: \`${err.message}\`\\
Stack: 
\`\`\`
${err.stack}
\`\`\`


== Process info ==\\
arch: ${process.arch}\\
platform: ${process.platform}
exitCode: ${process.exitCode}\\
env.NODE_ENV: "${process.env.NODE_ENV}"\\
debugPort: ${process.debugPort}


title: "${process.title}"\\
argv: "${process.argv.toString()}"\\
execArgv: ${process.execArgv}\\
pid: ${process.pid}\\
ppid: ${process.ppid}\\



versions:
\`\`\`JSON
{
	"node": "${process.versions.node}",
	"v8": "${process.versions.v8}",
	"uv": "${process.versions.uv}",
	"zlib": "${process.versions.zlib}",
	"brotli": "${process.versions.brotli}",
	"ares": "${process.versions.ares}",
	"modules": "${process.versions.modules}",
	"nghttp2": "${process.versions.nghttp2}",
	"napi": "${process.versions.napi}",
	"llhttp": "${process.versions.llhttp}",
	"openssl": "${process.versions.openssl}",
	"cldr": "${process.versions.cldr}",
	"icu": "${process.versions.icu}",
	"tz": "${process.versions.tz}",
	"unicode": "${process.versions.unicode}",
	"ngtcp2": "${process.versions.ngtcp2}",
	"nghttp3": "${process.versions.nghttp3}"
}
\`\`\`

process.features:
\`\`\`JSON
{
	"inspector": ${process.features.inspector},
	"debug": ${process.features.debug},
	"uv": ${process.features.uv},
	"ipv6": ${process.features.ipv6},
	"tls_alpn": ${process.features.tls_alpn},
	"tls_sni": ${process.features.tls_sni},
	"tls_ocsp": ${process.features.tls_ocsp},
	"tls": ${process.features.tls}
}
\`\`\``;

		fs.writeFileSync(__dirname + "/../crashReport-" + date + "T" + time.replace(/:/g,"_") + ".md", crashReport);
		crashReportWritten = true;
		Focus.logMan.open();
		Focus.log.critical(crashReport.replace(/`/g,'').replace(/\\$/g,'').replace(/JSON/g,''))
		console.log("");
		Focus.log.critical("Please send the crash report and Focus log to the team and we'll look into it.");
		Focus.log.info("The crash report was written to \"" + __dirname + "/../crashReport-" + date + "T" + time.replace(/:/g,"_") + ".md\" (and in the Focus log file ./Data/logs/Focus.log)");
		console.log("")
		Focus.log.info("Exiting now", false);
		global.shuttingDown = true;
		Focus.logMan.close();
	} catch(error) {
		Focus.log("\n\nGee billy, your mom lets you have TWO errors?");
		Focus.log.error(`Focus has crashed catastrophically, and then crashed trying to tell you it crashed. Go figure.

Please send any data over to the team and we'll look into it.
If the crash report was written, it'll be at ./crashReport-<date>.md (./ signifying the current running directory).
Crash report written: ${crashReportWritten}

---
First error: ${err.message}

First error stack: ${err.stack}

---

Second error: ${error.message}

Second error stack: ${error.stack}`);
		} finally {
			console.log("Exiting... (using abort, expect a bunch of junk below)");
			if (process.exitCode === undefined)
				process.exitCode = -9001;
			process.abort();
		}
	});
}