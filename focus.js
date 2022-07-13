/*

	 _____           _         _       ___                    
	|  _  |___ ___  |_|___ ___| |_    / __\__   ___ _   _ ___ 
	|   __|  _| . | | | -_|  _|  _|  / _\/ _ \ / __| | | / __|
	|__|  |_| |___|_| |___|___|_|   / / | (_) | (__| |_| \__ \
	              |___|             \/   \___/ \___|\__,_|___/

	Photo Showcase Site

*/


const InDebugMode = false;



const http = require('http');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bodyParser = require("body-parser");

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');


// Outdated, using Sharp
// const Jimp = require('jimp');
const sharp = require('sharp');



const pbkdf2 = require('./Support/pbkdf2.js');
let crypto = require('crypto');



const User = require('./Support/User.js');



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


const app = express();
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.json());
app.use(session({
	secret: "tMNAXs0lCvDTtgG6Sf2d1ZUOfQ8eo7qQQroRykAJnqHnnUKiPDXjg7AECLlBp7ZclexctwcS0SlUyrTXQSJeTEGGjPC6DKS5e0oimTa6ikNBg4jVbokqyHdZysNk2MTK5U9d7Lxyu8uPCRC0dveQ0LVAlSP89HD6POLoAx2VIeE7gyKzBigEn8SxIFeDxW837036m9Mw3ZFRmU44kQ5OntGTWvDuTHJIYOwRKBImisl8S5AtCE0wDuAxu3mNwMKm",
	saveUninitialized: true,
	resave: true
}))
var upload = multer({
	dest: './data/uploads/',
	limits: {
		fileSize: 40000000, // 40MB
	},
	fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname);
        if(ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') { // Only allow JPG's
            return callback(new Error('Only images are allowed'))
        }
        callback(null, true)
    },
}); // For uploads


const httpServer = http.createServer(app);





// fs.writeFile('./accountData.json', JSON.stringify(CleanAccounts), 'utf8', o_O=>{})


var Users; // data/users.json

// hash: hashObj
var RHashes = {}; // Not saved


var PHashes = {}; // data/phashes.json

var Shoots = require('./data/shoots.json'); // data/shoots.json


function loadUsers() {
	fs.readFile('./data/users.json', 'utf8', function readFileCallback(err, data){
		if (err){
			console.log("Error loading account data! The bot has halted until the error is solved. (Possible arroundData corruption?)\n\nError: " + err);
			process.exit(1);
		} else {
			var usersJSON = JSON.parse(data);
			Users = usersJSON.reduce((a,x) => ({...a, [x.username]: new User(x)}), {});

			// so like I couldn't figure out why all the users were the SAME with the following code:
			// for (var username in usersJSON)
			// {
			// 	// var obj = {}
			// 	// obj[username] = User(JSON.parse(usersJSON[username].trim()));
			// 	// Object.assign(Users, obj);
			// 	Users['' + username] = User(JSON.parse(usersJSON[username].trim()));
			// 	console.log(username);
			// 	console.log("User loaded: " + Users[username].username);
			// }
			/*
				I forgot to do `new User(data)`

				I was loading the user object (picture this as a "packet") like so ..thisUser = User(userData);
				User is a class, and the initializer User() converts a "packet" `{ data }` to something more usable or whatever

				anyways
				when I load that, it worked and everything, the data loaded, the object was created
				turns out tho, everytime I called User(data) it fucking overwrote the previous data BECAUSE it was all pointing to the same fucking object
				so I kept wacking this fucking variable multiple times changing it each time

				the solution: add `new` infront of User(data)

				tl;dr:
				I was doing: Users[username] = User(data);
				should have done: Users[username] = new User(data);

				fuck

			*/
		}
	});

}
function saveUsers() {
	var users = [];
	Object.keys(Users).forEach((username) => {
		users.push(Users[username].toJSON());
	});
	
	fs.writeFile('./data/users.json', JSON.stringify(users), 'utf8', o_O=>{ console.log("[Database] Users updated and saved."); });
}

function saveShoots() {
	fs.writeFile('./data/shoots.json', JSON.stringify(Shoots), 'utf8', o_O=>{ console.log("[Database] Shoots updated and saved."); });
}

function getUserObject(username) {
	return Users[username]; // yes.
}


function loadPHashes() {
	fs.readFile('./data/users.json', 'utf8', function readFileCallback(err, data) {
		if (err) {
			console.log("Error reading presistent hashes. I guess everyone just got logged out :)))))");
		} else {
			var PHashes = JSON.parse(data);
		}
	});
}
function savePHashes() {
	fs.writeFile('./data/phashes.json', JSON.stringify(PHashes), 'utf8', o_O={});
}





function randomString(len, minChar, maxChar) {
	var str = ""
	if (maxChar == undefined || maxChar > 220)
		maxChar = 220;
	if (minChar == undefined || minChar < 33)
		minChar = 33;

	if (minChar>maxChar) {
		minChar = minChar + maxChar;
		maxChar = minChar - maxChar;
		minChar = minChar - maxChar;
	}

	for (var i = 0; i<len; i++)
		str += String.fromCharCode((Math.random()* (maxChar - minChar) +minChar));
	return str;
}


/*
	Returns a new RHash assigned to a user. *** Valid for 2 hours ***
*/
function newRHash(username) {
	var rhash = {
		hash: randomString(256),
		key: randomString(512),
		time: Date.now(),
		username: username
	}
	rhash.sig = crypto.createHash('sha512').update(rhash.hash + rhash.key, 'utf-8').digest('hex'); // Who the hell designed this like so? Fucking web developers I swear

	if (RHashes[rhash.hash] == null)
		RHashes[rhash.hash] = rhash;
	else {
		// Hash exists...
		return newRHash(username); // try again
	}

	return rhash;
}
// RHash -> username
function rhashToUsername(rhash) {
	var hash = RHashes[rhash];
	if (hash == null)
		return null;
	else
		return RHashes[rhash].username
}

function validRHash(RHash) {
	if (RHash == undefined)
		return false; // Easy.
	if (RHash.hash == undefined
		|| RHash.time == undefined
		|| RHash.key == undefined
		|| RHash.sig == undefined
		|| RHash.username == undefined)
		return false; // Easy.

	if (RHash.hash.length != 256 || RHash.key.length != 512)
		return false; // Something is wrong.

	var ourVersion = RHashes[RHash.hash]; // Okay so pull what we know and compare?

	if (ourVersion.hash == RHash.hash
		&& ourVersion.time == RHash.time
		&& ourVersion.key == RHash.key
		&& ourVersion.sig == RHash.sig
		&& ourVersion.username == RHash.username) {
		// Simple compare, we match. 
		// Check the time, did this RHash expire? Expire time: 2 hours.
		var timeDifference = ((Date.now() - RHash.time)/1000)/60;
		if (timeDifference > 120) {
			console.log("RHash expired.");
			return false;
		}

		// Verify the signature (probably not needed.)
		if (ourVersion.sig == crypto.createHash('sha512').update(RHash.hash + RHash.key, 'utf-8').digest('hex')) {
			// Okay so the signature is correct. Everything looks good :)
			return true;
		}
	}

	return false;
}


/*
	Returns a new PHash assigned to a user.
*/
function newPHash(username) {

}

/*
	Returns whether or not the PHash is valid
	That is all.

*/
function validatePHash(username, phash, sig) {

}




function getShootObject(shootID) {
	for (var i = 0; i<Shoots.length; i++) {
		if (Shoots[i].id == shootID)
			return Shoots[i];
	}
}
function isValidShoot(shootID) {
	return (getShootObject(shootID) !== undefined);
}



/*
	Get the permissions for a shoot (from a username)
*/
function understandPermission(permString) {
	// Take something like "drs" to: download, remove, share etc
	var perm = {};
	for (var i = 0; i < permString.length; i++) {
		switch (permString.charAt(i)) {
			case "f":
				perm.full = true;
				break;
			case "d":
				perm.download = true;
				break;
			case "v":
				perm.view = true;
				break;
			case "r":
				perm.delete = true;
				break;
			case "s":
				perm.share = true;
				break;
		} 
	}
	return perm;
}

function getShootPermissions(shoot, username) {
	if (Shoots[shoot] == null)
		return null;

	if (Shoots[shoot].owner == username) {
		// console.log("Owns the shoot.");
		return { "*": "f" }; // They own the shoot.
	}

	var perms = Shoots[shoot].permissions[username];
	if (perms == null)
		perms = Shoots[shoot].permissions["everyone"];
	return perms;
}
function getImagePermissions(shootID, username, theImage) {
	var shoot = getShootObject(shootID);
	if (shoot == undefined)
		return null;

	// console.log("Permission? " + username + " for " + shootID + " image " + theImage + " .. owner: " + shoot.owner);
	if (shoot.owner == username) {
		// console.log("Owns the shoot");
		return true; // They own the shoot itself ...
	}

	if (shoot.permissions == undefined)
		return false; // No permission set, so owner only!

	function checkPermission(obj) {
		if (obj == undefined)
			return false;

		var allow = false;
		Object.keys(obj).forEach((key) => {
			var image = key;
			var perm = understandPermission(obj[key]);

			if (image == "*") { // All images
				if (perm.full == true || perm.view == true) {
					allow = true;
				}
			} else if (perm.full == true || perm.view == true) {
				if (theImage == image)
					allow = true;
			}
		});
		return allow;
	}
	// console.log(`Checking ${shootID} image ${theImage}`)
	return (checkPermission(shoot.permissions.everyone) || checkPermission(shoot.permissions[username]));
}


async function getZip(shootID, quality, res, rhash) {
	var path = "/data/shoots/" + shootID + "/";
	var rID = randomString(20, 65, 90);
	var zipName = path + shootID + " " + quality + "-quality." + rID + ".zip";


	if (quality == undefined || quality == "")
		quality == "original";

	// check if the zip exists
	if (fs.existsSync("." + zipName)) {
		// zip exists, return it
		console.log("[API - ZIP] Shoot zip cached, beginning download. ShootID> " + shootID);
		res.setHeader('Content-disposition', 'attachment; filename=' + shootID + " " + quality + "-quality.zip");
		res.setHeader('Content-type', 'application/zip');
		res.download(__dirname + zipName, shootID + " " + quality + "-quality.zip", function(err) {
			fs.unlinkSync("." + zipName);
			// console.log("Deleted: " + zipName);
		});
	} else {
		console.log("[API - ZIP] Generating shoot zip package. ShootID> " + shootID);
		var output = fs.createWriteStream("." + zipName);
		var archive = archiver("zip", { zlib: {level: 9 } });

		output.on('close', function() {
			console.log("[API - ZIP] Shoot zip generated, beginning download. ShootID> " + shootID);
			res.setHeader('Content-disposition', 'attachment; filename=' + shootID + " " + quality + "-quality.zip");
			res.setHeader('Content-type', 'application/zip');
			res.download(__dirname + zipName, shootID + " " + quality + "-quality.zip", function(err) {
				fs.unlinkSync("." + zipName);
				console.log("Deleted: " + zipName);
			});
		});

		archive.pipe(output);

		var packet = {
			end: function(shoots) {
				shoots = shoots.split('\n');
				shoots = JSON.parse(shoots[1]);
				for (var i = 0; i<shoots.length; i++) {
					if (shoots[i].id == shootID) {
						if (shoots[i].images.length==0) {
							console.log("[API - ZIP] Shoot zip access denied. (No viewable images available). ShootID> " + shootID);
							res.sendStatus(404);
							break;
						}
						// Downloading this shoot
						for (var a = 0; a<shoots[i].images.length; a++) {
							// For each image we have access to...
							// archive this
							var file = shoots[i].images[a];
							// archive.file("." + path + file, { name: file });
							var p = {
								setHeader: function() {}
							};
							p.end = function(buf) {
								archive.append(buf, { name: file + ".jpg" });
							}
							p.sendFile = function(f) {
								archive.file(f, { name: file + ".jpg" });
							}
							getImage(shootID, file, quality, p, rhash); // This will grab images at high quality AND that we are approved for
						}

						archive.finalize(); // generate
					}
				}	
			}
		}
		getShoots(rhash, null, packet);


		// fs.readdirSync("." + path).forEach(file => {
		// 	// console.log("File: " + file);
		// 	if (file.endsWith('jpg')) {
		// 		// archive this
		// 		// archive.file("." + path + file, { name: file });
		// 		var packet = {
		// 			setHeader: function() {}
		// 		};
		// 		packet.end = function(buf) {
		// 			archive.append(buf, { name: file });
		// 		}
		// 		packet.sendFile = function(f) {
		// 			archive.file(f, { name: file });
		// 		}
		// 		getImage(shootID, file.replace('\.jpg', ''), quality, packet, rhash); // This will grab images at high quality AND that we are approved for
		// 	}
		// })
		// // console.log("generating");
		
	}


}

async function getImage(shootID, imageName, quality, res, rhash, dl) {
	// console.time("getImage");
	try {
		var qualityExtension = '';
		var size = 0;
		var qua = 100;
		if (quality == "high") {
			qualityExtension = ".hq";
			qua = 85;
			size = 2560;
		}
		else if (quality == "medium") {
			qualityExtension = ".mq";
			qua = 85
			size = 1920
		}
		else if (quality == "low") {
			qualityExtension = ".lq";
			qua = 75;
			size = 1280;
		}
		else if (quality == "thumbnail") {
			qualityExtension = ".tN";
			qua = 100
			size = 250
		}
		

		var path = '/data/shoots/' + shootID + '/' + imageName + '.jpg';
		var cached = false;

		// Check permission
		var allowed = false;
		if (rhash != undefined) {
			allowed = getImagePermissions(shootID, rhash.username, imageName);
		} else {
			allowed = getImagePermissions(shootID, undefined, imageName);
		}
		res.setHeader('content-type', 'jpeg');

		if (!allowed) {
			console.log("[API - Image] Image request DENIED (q: " + quality + " || cached). ShootID> " + shootID + " || ImageName> " + imageName)
			if (dl) {
				res.setHeader('Content-disposition', 'attachment; filename=' + imageName + " " + quality + "-quality.jpg");
				res.download(__dirname + '/image-not-found.jpg');
			}
			else
				res.sendFile(__dirname + '/image-not-found.jpg');

			return;
		}


		if (!fs.existsSync('.' + path)) { // Image doesn't exist.
			cached = true; // sorta
			console.log("[API - Image] Attempt to grab non-existent image! ShootID> " + shootID + " || ImageName> " + imageName + " || Path (full): " + '.' + path + ((cached)? qualityExtension : ""));
			if (dl) {
				res.setHeader('Content-disposition', 'attachment; filename=' + imageName + " " + quality + "-quality.jpg");
				res.download(__dirname + '/image-not-found.jpg');
			}
			else
				res.sendFile(__dirname + '/image-not-found.jpg');

			return;

			// return res.sendFile(__dirname + '/image-not-found.jpg'); // Return a placeholder image

		} else if (fs.existsSync('.' + path + qualityExtension)) { 	// Is the pre-compressed version saved?
			// yes
			cached = true;
			console.log("[API - Image] Image request (q: " + quality + " || cached). ShootID> " + shootID + " || ImageName> " + imageName)
			if (dl) {
				res.setHeader('Content-disposition', 'attachment; filename=' + imageName + " " + quality + "-quality.jpg");
				res.download(__dirname + path + qualityExtension);
			} else
				res.sendFile(__dirname + path + qualityExtension);

		} else {
			console.log("[API - Image] Image request (q: " + quality + " || not cached). ShootID> " + shootID + " || ImageName> " + imageName);
			sharp('.' + path)
				.resize({ width: size })
				.jpeg({
					quality: qua,
					progressive: true,

				})
				.toBuffer((err, data, info) => {
					if (dl)
						res.setHeader('Content-disposition', 'attachment; filename=' + imageName + " " + quality + "-quality.jpg");

					res.end(data);
				})
				.toFile('.' + path + qualityExtension);

			// var img = await Jimp.read('.' + path);
			// if (size != 0)
			// 	img.scaleToFit(size, Jimp.AUTO, Jimp.RESIZE_BEZIER) // "Resize"
			// img.quality(qua) // set JPEG quality

			// // Return the image
			// img.getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
			// 	// console.timeEnd("getImage");
			// 	if (dl)
			// 		res.setHeader('Content-disposition', 'attachment; filename=' + imageName + " " + quality + "-quality.jpg");
			// 	res.end(buffer);
			// });
			// // Save for faster access next time
			// img.write('.' + path + qualityExtension);


		}
	} catch (err) {
		// console.timeEnd("getImage");
		if (dl) {
			res.setHeader('Content-disposition', 'attachment; filename=' + imageName + " " + quality + "-quality.jpg");
			res.download(__dirname + '/image-load-error.jpg');
		}
		else
			res.sendFile(__dirname + '/image-load-error.jpg'); // Return a placeholder image
		console.log("[API - Image] Error processing image request! Quality: " + quality + " || cached: " + cached + " || ShootID: " + shootID + " || ImageName: " + imageName + " || Path (full): " + '.' + path + ((cached)? qualityExtension : ""));

		console.log(err);
	}
	
}


function getShoots(rhash, data, res) {
	if (rhash == undefined)
		rhash = {};


	var loadOwnedOnly = false;
	if (data != undefined)
		loadOwnedOnly = data.ownedByMe || false;

	var username;
	if (RHashes[rhash.hash] != undefined)
		var username = RHashes[rhash.hash].username;
	
	if (getUserObject(username) == undefined)
		loadOwnedOnly = false; // can't, user doesn't exist.


	console.log('[API - Shoots] Shoots list request. UserID: ' + rhash.username + " (personal only? " + loadOwnedOnly + ").");
	
	var myShoots = [];
	var username;
	if (rhash.hash != undefined)
		if (RHashes[rhash.hash] != undefined)
			username = RHashes[rhash.hash].username;

	for (var i = 0; i<Shoots.length; i++) {
		if (loadOwnedOnly)
			if (Shoots[i].owner != username)
				continue;

		// First we check everyone's permissions
		// We then check the user's permissions
		var theShoot = {
			id: Shoots[i].id,
			title: Shoots[i].title,
			owner: Shoots[i].owner,
			images: []
		};

		function checkPermission(obj) {
			Object.keys(obj).forEach((key) => {
				var image = key;
				var perm = understandPermission(obj[key]);

				if (image == "*") { // All images
					if (perm.full == true || perm.view == true) {
						for (var b = 0; b<Shoots[i].images.length; b++) {
							if (Shoots[i].images[b] != "*")
								theShoot.images[b] = Shoots[i].images[b];
						}
					}
				} else if (perm.full == true || perm.view == true) {
					theShoot.images.push(key); // They can view this image, push it to the images
				}
			});
		}

		if (Shoots[i].owner == username) {
			theShoot.images = Shoots[i].images;
		} else if (Shoots[i].permissions != undefined) {
			checkPermission(Shoots[i].permissions.everyone);
			if (username != undefined)
				if (Shoots[i].permissions[username] != undefined)
					checkPermission(Shoots[i].permissions[username]); // Check their permissions
		} else {
			continue; // No permissions set.
		}

		if (theShoot.images.length>0)
			myShoots.push(theShoot); // we can view images in this shoot
	}

	res.end(":;BigDog;:\n" + JSON.stringify(myShoots));
}



/*

	Web server portion

	REMEMBER:
		POST: SEND DATA (login, delete, etc etc)
		GET: GRAB DATA (photo, account details, etc etc)

*/

// At some point combine login/register into one /user link
// So all user management takes place in one area? (one link that is)
//		probably a different function (method) for each action

app.use(express.static(__dirname + '/Web'));

loadUsers();

app.post('/user/login', (req, res) => {
	/*
		What to post:
			username,
			password
			rememberMe?
	*/

	var userPacket = {
		username: req.body.username,
		password: req.body.password,
		rememberMe: (req.body.rememberMe? true : false)
	};

	if (userPacket.username == "" || userPacket.password == "") {
		res.redirect('/login?failure=missing_fields');
		return;
	}

	if (Users[userPacket.username] == null) {
		res.redirect("/login?failure=invalid_credentials");
		return;
	}


	var userObject = Users[userPacket.username];
	userObject.validatePassword(userPacket.password).then((validPassword) => {
		if (validPassword) {
			// This is the correct user, generate a RHash
			req.session.rhash = newRHash(userPacket.username);
			req.session.username = userPacket.username;
			console.log("[User] " + userPacket.username + " has just logged in.");
			if (req.session.loginRedirect != undefined) {
				res.redirect(req.session.loginRedirect);
				return;
			}

			res.redirect("/dashboard");
			return;
		} else {
			res.redirect("/login?failure=invalid_credentials");
			return;
		}
	});
});

app.post('/user/logout', (req,res) => {
	res.redirect('/logout');
})
app.get('/user/logout', (req, res) => {
	res.redirect('/logout');
})
app.get('/logout', (req, res) => {
	if (req.session.rhash != undefined) {
		var hash = req.session.rhash.hash;
		// Delete the RHash.
		if (hash!=undefined) {
			RHashes[hash] = undefined;

			var newHashes = {};
			Object.keys(RHashes).forEach(key => {
				if (RHashes[key] != undefined)
					if (RHashes[key].hash != hash)
						newHashes[key] = RHashes[key];
			});
			RHashes = newHashes;
		}
	}


	// Remove PHash here or whatever


	// Destroy session
	req.session.destroy();

	console.log("[User] A logout was completed successfully.");
	res.sendFile(__dirname + "/Web/logout-successful.html");
});

app.post('/user/myInfo', (req, res) => {
	if (validRHash(req.session.rhash)) {
		var userObj = getUserObject(req.session.rhash.username);
		if (userObj == null) {
			res.end(`:;BigDog;:\n{ "loggedIn": false }`);
			return;
		}

		console.log("[User] Data lookup for: " + userObj.username);
		res.end(`:;BigDog;:\n{ "loggedIn": true, "username": "${userObj.username}", "firstName": "${userObj.firstName}", "lastName": "${userObj.lastName}", "phoneNumber":"${userObj.phoneNumber}" }`);
	} else {
		res.end(`:;BigDog;:\n{ "loggedIn": false }`);
	}
});

app.post("/user/validateUser", (req, res) => {
	// Use this to validate a user before registering
	// (if the username exists or something.)
	// rate limit this, for the love of god.

	setTimeout(function() {
		if (Users[req.body.username]!=null || req.body.username == "everyone") {
			res.end(':;BigDog;:\n{ "success": false, "reason":"userRegistered" }');

		} else if (req.body.username.length<3) {
			res.end(':;BigDog;:\n{ "success": false, "reason":"tooShort" }');

		} else if (req.body.username.length>25) {
			res.end(':;BigDog;:\n{ "success": false, "reason":"tooLong" }');

		} else {
			res.end(':;BigDog;:\n{ "success": true }');
		}
	}, 500); // "rate" limiting. Just slap a time delay on that mofo
	// Next step would to only allow ONE check at a time, so queue these.
	// This way it would be difficult to mine usernames from our system :)

});


app.post('/user/register', (req, res) => {
	/*
		What to post:
			username,
			password, (unencrypted)
			firstName

		Allowed:
			email,
			phoneNumber,
			lastName
	*/

	var userPacket = {
		username: req.body.username || "",
		password: req.body.password || "",
		passwordConf: req.body.passwordConf || "",
		firstName: req.body.firstName || "",
		lastName: req.body.lastName || "",
		email: req.body.email || "",
		phoneNumber: req.body.phoneNumber || "",
	}

	if (userPacket.username == "" || userPacket.password == "" || userPacket.passwordConf == "" || userPacket.firstName == "" || userPacket.phoneNumber == "") {
		res.redirect("/register?failure=missing_fields");
		return;
	}

	if (Users[userPacket.username] != null || userPacket.username == "everyone") {
		res.redirect("/register?failure=username_taken");
		return;
	}

	if (userPacket.username.length<3) {
		res.redirect("/register?failure=username_tooShort");
		return;
	}
	if (userPacket.username.length>25) {
		res.redirect("/register?failure=username_tooLong");
		return;
	}

	if (userPacket.password != userPacket.passwordConf) {
		res.redirect("/register?failure=password_noMatch");
		return;
	}

	pbkdf2.hashPassword(userPacket.password, function(password) {
		userPacket.password = password;
		var userObject = new User(userPacket);
		Users[userPacket.username] = userObject;
		console.log("[Users] New user registered! Username: " + userPacket.username);
		saveUsers();

		res.redirect("/login");
		// res.end('{ "success": true }');
	});
});
app.get('/user/login', (req, res) => {
	res.redirect('/login');
});
app.get('/user/myInfo', (req, res) => {
	res.redirect('/myaccount');
});
app.get('/user/register', (req, res) => {
	res.redirect('/register');
});




// Images
app.get("/images/lQ", async function(req, res) {
	// Returns a requested image, but in lower quality (download quicker)
	// We aim for 720, 75% quality.
	getImage(req.query.shoot, req.query.image, 'low', res, req.session.rhash);
});

app.get("/images/mQ", async function(req, res) {
	// Returns a requested image, but in lower quality (download quicker)
	// We aim for 1080p, 85% quality.
	getImage(req.query.shoot, req.query.image, 'medium', res, req.session.rhash);
});

app.get("/images/hQ", async function(req, res) {
	// Returns a requested image, but in lower quality (download quicker)
	// We aim for 1440p, 85% quality.
	getImage(req.query.shoot, req.query.image, 'high', res, req.session.rhash);
});

app.get("/images/tN", async function(req, res) {
	// Returns a requested image, but in lower quality (download quicker)
	// We aim for 250, 100% quality.
	getImage(req.query.shoot, req.query.image, 'thumbnail', res, req.session.rhash);
});

app.get("/images/original", async function(req, res) {
	getImage(req.query.shoot, req.query.image, 'original', res, req.session.rhash);
});

app.get("/images/:shootID/:imageID.:quality", async function(req, res) {
	if (isValidShoot(req.params.shootID))
		getImage(req.params.shootID, req.params.imageID, req.params.quality, res, req.session.rhash);
	else
		res.sendStatus(404);
});
app.get("/image-dl/:shootID/:imageID.:quality", async function(req, res) {
	if (isValidShoot(req.params.shootID))
		getImage(req.params.shootID, req.params.imageID, req.params.quality, res, req.session.rhash, true);
	else
		res.sendStatus(404);
});



// Zip downloading
app.get("/zip/:shootID/quality/:quality", async function(req, res) {
	if (isValidShoot(req.params.shootID))
		getZip(req.params.shootID, req.params.quality, res, req.session.rhash);
	else
		res.sendStatus(404); // Shoot doesn't exist
});



// File uploading
/*

	((-->> Uploads are restricted to one user at the moment. <<--))
	If they are not this user, just silently drop the request.

	Uploads are also limited to 100 photos, because why not? I shouldn't upload more than 100 images.

	First we check if that shootID exists:
		Exists: IFF the user owns that shoot, ask them if they want to append the shoot. Otherwise tell 'em to bugger off.

		!Exists: create a new shoot IFF shoot details were provided (the shoot name).
*/

app.post("/upload/validateShoot", (req, res) => {
	var shootID = req.body.shootID;
	console.log(shootID);
	setTimeout(function() {
		if (!validRHash(req.session.rhash)) {
			res.end(':;BigDog;:\n{ "success": false, "reason":"login_required" }');

		} else if (isValidShoot(shootID)) {
			res.end(':;BigDog;:\n{ "success": false, "reason":"shoot_exists" }');

		} else if (/^([a-z0-9A-Z]{1,100})$/.test(shootID) != true) {
			res.end(':;BigDog;:\n{ "success": false, "reason":"shootid_invalid" }');

		} else if (req.body.title == undefined || req.body.title == "") {
			res.end(':;BigDog;:\n{ "success": false, "reason":"invalid_title" }');

		} else if (req.session.rhash.username != "cnewb") {
			res.end(':;BigDog;:\n{ "success": false, "reason":"not_permitted" }');

		} else {
			res.end(':;BigDog;:\n{ "success": true }');
		}
	}, 500);

});

app.post('/upload/endpoint', upload.array('images', 100), async (req, res, next) => {
	function deleteFiles() {
		function deleteFile(i) {
			if (i<req.files.length-1) {
				if (fs.existsSync('./' + req.files[i].path)) {
					fs.unlink('./' + req.files[i].path, err => {
						deleteFile(i++);
					});
				}
			}
				
		}

		deleteFile(0);
	}

	if (!validRHash(req.session.rhash)) { // has to be logged in
		req.session.loginRedirect = "/upload";
		// res.redirect("/login?failure=login_required");
		res.end(':;BigDog;:\n{ "success": false, "reason": "login_required" }');
		deleteFiles();
		return;
	}

	var shootID = req.body.shootID;
	if (isValidShoot(req.body.shootID)) {
		// res.redirect("/upload?failure=upload-shoot_exists")
		res.end(':;BigDog;:\n{ "success": false, "reason": "shoot_exists" }');
		deleteFiles();
		return;
	}

	// Check the provided strings for sanitation issues
	if (/^([a-z0-9A-Z]{1,100})$/.test(shootID) != true) {
		// Invalid ID
		// res.redirect("/upload?failure=upload-shootid_invalid");
		res.end(':;BigDog;:\n{ "success": false, "reason": "shootid_invalid" }');
		deleteFiles();
		return;
	}
	if (req.body.title == undefined || req.body.title == "") {
		// res.redirect("/upload?failure=upload-shootTitle_invalid");
		res.end(':;BigDog;:\n{ "success": false, "reason": "shootTitle_invalid" }');
		deleteFiles();
		return;
	}


	// Generate shoot data
	// Create shoot folder
	// Move images over
	// Render low and medium image quality versions
	// Completed!


	var newShoot = {
		id: shootID,
		title: req.body.title,
		owner: req.session.rhash.username,
		images: [],
	}
	if (!fs.existsSync('./data/shoots/' + shootID)) {
		// Create folder
		fs.mkdirSync('./data/shoots/' + shootID);
	}

	fs.access('./data/shoots/' + shootID, (err) => {
		if (err && err.code === "ENOENT") {
			fs.mkdirSync('./data/shoots/' + shootID);
		}


		async function processImage(i) {
			if (i<req.files.length) {
				var imageID = req.files[i].originalname.replace(/\s+/g, '').match(/^([^.]+)/)[0]; // File name
				console.log("[Upload - " + shootID + "] Image " + imageID + " processing.");

				let path = './data/shoots/' + shootID + '/' + imageID + '.jpg';

				function doImage(data, size, quality, qE) {
					sharp(data)
						.resize({ width: size })
						.jpeg({
							quality: quality,
							progressive: true,
							chromaSubsampling: '4:4:4'	
						})
						.toFile(path + qE);
				}

				// Convert original
				sharp('./' + req.files[i].path)
					.withMetadata()
					.jpeg({
						quality: 100, // Original quality
						progressive: true, // Load better for the web
						chromaSubsampling: '4:4:4'
					})
					.toFile(path);

				sharp('./' + req.files[i].path)
					.toBuffer()
					.then(data => {
						newShoot.images.push(imageID); // Add the image

						doImage(data, 2560, 85, '.hq'); // High quality
						doImage(data, 1920, 75, '.mq'); // Medium quality
						doImage(data, 1280, 75, '.lq'); // Low quality
						doImage(data, 250, 100, '.tn'); // Thumbnail

						fs.unlink('./' + req.files[i].path, bruh => {
							if (bruh)
								console.log(bruh);
							processImage(i+1); // move on
						}); // image saved (and now deleted)
					})


				

				// // Open image, convert, save, shrink, save, shrink, save.
				// Jimp2.read('./' + req.files[i].path, (err, img) => {
				// 	img.writeAsync().then((a)=> {
				// 		// Open the image again (to make sure it's a jpg, because it converts based on file extension ...)
				// 		Jimp2.read('./data/shoots/' + shootID + '/' + imageID + '.jpg', (err, img) => {
				// 			// High quality.
				// 			img.scaleToFit(2560, Jimp2.AUTO, Jimp2.RESIZE_BEZIER); // "Resize"
				// 			img.quality(85); // set JPEG quality
				// 			img.write('./data/shoots/' + shootID + '/' + imageID + '.jpg.hq');
				// 			console.log("[Upload - " + shootID + "] Image " + imageID + " HIGH quality saved.");

				// 			// Medium quality.
				// 			img.scaleToFit(1920, Jimp2.AUTO, Jimp2.RESIZE_BEZIER); // "Resize"
				// 			img.write('./data/shoots/' + shootID + '/' + imageID + '.jpg.mq');
				// 			console.log("[Upload - " + shootID + "] Image " + imageID + " MED quality saved.");

				// 			// Low quality.
				// 			img.scaleToFit(1280, Jimp2.AUTO, Jimp2.RESIZE_BEZIER);
				// 			img.quality(75); // or is it 90?
				// 			img.write('./data/shoots/' + shootID + '/' + imageID + '.jpg.lq');
				// 			console.log("[Upload - " + shootID + "] Image " + imageID + " LOW quality saved.");


				// 			newShoot.images.push(imageID);
				// 			fs.unlinkSync('./' + req.files[i].path);

				// 			processImage(i+1);
				// 		}); // Re-open
				// 	}); // Save original
				// }); // Open the image
				
			} else {
				// Processing complete
				console.log("[Upload - " + shootID + "] Processing completed! Upload complete.");
				deleteFiles(); // just because
				Shoots.push(newShoot);
				saveShoots();
				Jimp2 = undefined;
			}
		}
		processImage(0); // Process the images.		
	});

	
	// res.redirect("/dashboard?message=upload_processing");
	res.end(':;BigDog;:\n{ "success": true }');
});



app.get('/upload', (req, res) => {
	res.sendFile(__dirname + "/Web/simpleUpload.html");
})



// Shoots
app.post("/shoots", (req, res) => {
	// Return the shoots I can view
	getShoots(req.session.rhash, req.body, res);
});




// I swear, do no leave this file or section of code in for production or so help me god
if (InDebugMode) {
	app.get('/logmein', (req, res) => {
		if (fs.existsSync('./login-dev-allowed-1234.bruh')) {
			req.session.rhash = newRHash("cnewb");
			res.end("Done.");
		} else {
			res.redirect('/dashboard');
		}
	});	
}




// Web page
app.get("/", (req, res) => {
	res.end(`<html>
	<head>
		<title>Project CNCO - Photos</title>
	</head>
	<body>
		<h1>API page</h1>
		<a herf="https://cnewb.co/Photos/">Visit here instead.</a>
	</body>
</html>`);
});


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
app.get('/css/bootstrap-4.3.1.css', (req, res) => {
	res.sendFile(__dirname + '/Web/css/bootstrap-4.3.1.css');
});
app.get('/css/login-style.css', (req, res) => {
	res.sendFile(__dirname + '/Web/css/login-style.css');
});

app.get('/js/focus.js', (req, res) => {
	res.sendFile(__dirname + '/Web/js/focus.js');
});
app.get('/js/bootstrap-4.3.1.js', (req, res) => {
	res.sendFile(__dirname + '/Web/js/bootstrap-4.3.1.js');
});
app.get('/js/jquery-3.3.1.min.js', (req, res) => {
	res.sendFile(__dirname + '/Web/js/jquery-3.3.1.min.js');
});
app.get('/js/popper.min.js', (req, res) => {
	res.sendFile(__dirname + '/Web/js/popper.min.js');
});
app.get('/js/random-image.js', (req, res) => {
	res.sendFile(__dirname + '/Web/js/random-image.js');
});



var port = 25560;
httpServer.listen(port, () => {
	console.log("[Web] Express server listening on port " + port);
});