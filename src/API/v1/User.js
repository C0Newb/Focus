/**
	
	Project Focus

		User API

*/

const express = require('express');
const router = express.Router();

const User = require('../../User.js');

router.get('/register', (req, res) => { res.redirect(303, '/register'); });


router.post('/register', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	/*
		{
			username,
			passwordHash, (sha256)
			givenName, (first name)
			familyName, (last name)
			email
		}
	*/

	let userPacket = {
		username: (typeof req.body.username === "string")? req.body.username : undefined,
		password: (typeof req.body.passwordHash === "string")? req.body.passwordHash : undefined,
		givenName: (typeof req.body.givenName === "string" && req.body.givenName.Length < 255)? req.body.givenName : "",
		familyName: (typeof req.body.familyName === "string" && req.body.familyName.Length < 255)? req.body.familyName : "",
		email: (typeof req.body.email === "string")? req.body.email.toLowerCase() : "",
	}

	let missingFields = [];
	if (userPacket.username === undefined)
		missingFields.push("username");
	if (userPacket.password === undefined)
		missingFields.push("password");
	if (userPacket.email === "")
		missingFields.push("email");


	if (missingFields.length > 0) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "missingFields",
				fields: missingFields.join(',')
			})
		);
		return;
	}

	if (userPacket.username == undefined
			|| !userPacket.username.match(/[a-zA-Z0-9_.\-]{1,25}/g) // valid name
			|| Focus.Users.has(userPacket.username) // registered
			|| userPacket.username == "*") { // everyone (covered by the matching, but always want to check)
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidUsername",
				errorMessage: "The provided username is invalid and cannot be used to register an account. Be sure the username only contains 1-25 alphanumeric characters, underscores, periods or hyphens."
			})
		);
		return;
	}

	if (userPacket.email.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g) == undefined) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidEmail",
				errorMessage: "The provided email is invalid and cannot be used to register an account."
			})
		);
		return;
	}

	Focus.webLog.verbose(`Creating user: ${userPacket.username}`);

	let newUser = Focus.configurationManager.loadConfig(userPacket.username, User);
	newUser.username = userPacket.username;
	newUser.givenName = userPacket.givenName;
	newUser.familyName = userPacket.familyName;
	newUser.emailAddress = userPacket.email;
	newUser.setPassword(userPacket.password).then((saved) => {
		if (!saved) {
			newUser.delete();
			res.end(
				JSON.stringify({
					status: "error",
					error: "genericError",
					errorMessage: "Unable to register your account at this time."
				})
			);
			return;
		}
		Focus.Users.set(userPacket.username, newUser);
		Focus.saveUsers(false);
		res.end(
			JSON.stringify({
				status: "success"
			})
		);
	});
});

router.post("/validateUsername", (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	// Use this to validate a user before registering
	// (if the username exists or something.)
	// rate limit this, for the love of god.

	// setTimeout(function() {
		let username = req.body.username;
		if (username == undefined
			|| typeof username !== "string"
			|| !req.body.username.match(/[a-zA-Z0-9_.]{1,25}/g)
			|| Focus.Users.has(username)
			|| username == "*") {
			res.end(`{ "status": "success", "valid": false }`);
			return;
		} else {
			res.end(`{ "status": "success", "valid": true }`);
			return;
		}
	// }, 500); // "rate" limiting. Just slap a time delay on that mofo
	// Next step would to only allow ONE check at a time, so queue these.
	// This way it would be difficult to mine usernames from our system :)

});


/**
 * Login/logout, access control
 */
router.get('/login', (req, res) => { res.redirect(303, '/login'); });

router.post('/login', (req, res) => { // login via API
	res.setHeader('Content-Type', 'application/json');
	/*
	 	username
	 	passwordHash
	 */

	let userPacket = {
		username: (typeof req.body.username === "string")? req.body.username : undefined,
		password: (typeof req.body.passwordHash === "string")? req.body.passwordHash : undefined,
	}

	let missingFields = [];
	if (userPacket.username === undefined)
		missingFields.push("username");
	if (userPacket.password === undefined)
		missingFields.push("passwordHash");


	if (missingFields.length > 0) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "missingFields",
				errorMessage: "You are missing a few required fields.",
				fields: missingFields.join(',')
			})
		);
		return;
	}

	if (userPacket.username == undefined
			|| !userPacket.username.match(/[a-zA-Z0-9_.\-]{1,25}/g) // valid name
			|| !Focus.Users.has(userPacket.username) // not registered
			|| userPacket.username == "*") { // everyone (covered by the matching, but always want to check)
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidUsername",
				errorMessage: "The provided username is invalid and cannot be used to login an account. Be sure the username only contains 1-25 alphanumeric characters, underscores, periods or hyphens."
			})
		);
		return;
	}

	try {
		try {
			let previousSession = Focus.sessionProvider.getRequestSession(req);
			if (previousSession != undefined) {
				// destroy it
				Focus.sessionProvider.destroySession(previousSession);
			}
		} catch (e) {
			Focus.webLog.error(e);
		}

		// this will validate the password
		let session = Focus.sessionProvider.newSession(userPacket.username, userPacket.password);

		if (session.sessionId == undefined || session.sessionToken == undefined) {
			res.end(
				JSON.stringify({
					status: "error",
					error: "invalidSessionData",
					errorMessage: "Unable to generate session data."
				})
			);
		}
		res.cookie('sessionId', session.sessionId, {
			sameSite: true,
			httpOnly: false,
		});
		res.cookie('sessionToken', session.sessionToken, {
			sameSite: true,
			secure: true,
			signed: true,
			httpOnly: true,
			maxAge: Focus.config.security.sessionAbsoluteLifetime*1000*60 || 86400000 // one day
		});

		session.userAgent = req.headers["user-agent"];
		Focus.webLog.debug(`User agent: ${session.userAgent}`, false);

		res.end(
			JSON.stringify({
				status: "success",
				sessionId: session.sessionId
			})
		);
	} catch (e) {
		let errorMessage = "Generic error.";
		if (e.message === "invalidPassword")
			errorMessage = "Incorrect password provided.";
		else if (e.message === "invalidUsername")
			errorMessage = "The user does not exist.";
		else if (e.message === "invalidSessionData")
			errorMessage = "Unable to generate session data.";
		else {
			Focus.webLog.error(e);
			e.message = "genericError";
		}

		Focus.webLog.warn(`Unable to login user ${userPacket.username} because: ${e}`);
		res.end(
			JSON.stringify({
				status: "error",
				error: e.message,
				errorMessage: errorMessage
			})
		);
	}
});



router.all('/logout', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	// logout
	/*
		// take sessionId, destroy it
	*/
	if (req.cookies === undefined) {
		Focus.webLog.debug("Attempt to destroy session despite user having no cookies.");
		res.end(
			JSON.stringify({
				status: "success",
			})
		);
		return;
	}

	let sessionId = req.cookies["sessionId"];
	let sessionToken = req.signedCookies["sessionToken"];
	let session = Focus.sessionProvider.getSession(sessionId, sessionToken, false);
	if (session !== undefined) {
		session.destroy();
	}

	res.clearCookie("sessionId");
	res.clearCookie("sessionToken");
	res.end(
		JSON.stringify({
			status: "success",
		})
	);
});




router.get('/accountDetails', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	res.end(
		JSON.stringify({
			status: "success",
			username: user.username,
			emailAddress: user.emailAddress,
			givenName: user.givenName,
			familyName: user.familyName,
			shoots: user.getShoots(true),
		})
	);
});

router.patch('/accountDetails', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	let userPacket = {
		// username: (typeof req.body.username === "string")? req.body.username : user.username,
		givenName: (typeof req.body.givenName === "string")? req.body.givenName : user.givenName,
		familyName: (typeof req.body.familyName === "string")? req.body.familyName : user.familyName,
		email: (typeof req.body.email === "string")? req.body.email.toLowerCase() : user.email,
	}

	// if (userPacket.username == undefined
	// 		|| !userPacket.username.match(/[a-zA-Z0-9_.\-]{1,25}/g) // valid name
	// 		|| Focus.Users.has(userPacket.username) // registered
	// 		|| userPacket.username == "*") { // everyone (covered by the matching, but always want to check)
	// 	res.end(
	// 		JSON.stringify({
	// 			status: "error",
	// 			error: "invalidUsername",
	// 			errorMessage: "The provided username is invalid and cannot be used to register an account. Be sure the username only contains 1-25 alphanumeric characters, underscores, periods or hyphens."
	// 		})
	// 	);
	// 	return;
	// }

	if (userPacket.email !== undefined) {
		if (userPacket.email.match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g) == undefined) {
			res.end(
				JSON.stringify({
					status: "error",
					error: "invalidEmail",
					errorMessage: "The provided email is invalid and cannot be used to register an account."
				})
			);
			return;
		}
	}

	Focus.webLog.debug(`Updating ${user.username}'s account details.`);

	if (typeof userPacket.givenName === "string" && userPacket.givenName != undefined && userPacket.givenName.length < 255)
		user.givenName = userPacket.givenName;
	if (typeof userPacket.familyName === "string" && userPacket.familyName != undefined && userPacket.familyName.length < 255)
		user.familyName = userPacket.familyName;
	if (typeof userPacket.givenName === "string" && userPacket.email !== undefined)
		user.email = userPacket.email;
	user.save();

	res.end(
		JSON.stringify({
			status: "success",
		})
	);
});


router.get('/shoots', (req, res) => {
	let shoots = [];
	let user = Focus.sessionProvider.getRequestUser(req, res, true);
	let owned = req.body.ownedOnly == true
				|| req.body.ownedOnly == "true" // doesn't js do type conversion? I thought it did
				|| req.query.ownedOnly == true
				|| req.query.ownedOnly == "true";

	if (!user) {
		if (!owned) {
			Focus.Shoots.forEach((shoot, shootId) => {
				let coverImage = shoot.getCoverImage();
				if (!coverImage)
					return; // skip, no images

				if (shoot.checkUserCanViewImage("*", coverImage, false)) {
					Focus.webLog.silly(`User can access ${shootId}`);
					shoots.push(shootId);
				}
			});
		}
	} else {
		if (owned)
			Focus.webLog.debug(`Looking up shoots owned by ${user.username}`);
		else
			Focus.webLog.debug(`Looking up shoots viewable by ${user.username}`);
		shoots = user.getShoots(owned);
	}


	res.end(JSON.stringify({ status: "success", shoots: shoots }));
});


router.post('/confirmationCode', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	// validate the user's password
	let passwordHash = (typeof req.body.passwordHash === "string")? req.body.passwordHash : "";
	if (!user.verifyPassword(passwordHash)) {
		res.statusCode = 403;
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidPassword",
				errorMessage: "Incorrect password provided."
			})
		);
		return;
	}

	let code = user.createConfirmationCode();
	res.end(
		JSON.stringify({
			status: "success",
			confirmationCode: code
		})
	);
});


router.delete('/deleteAccount', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	let code = (typeof req.body.confirmationCode === "string")? req.body.confirmationCode : "";

	if (user.verifyConfirmationCode(code)) {
		Focus.webLog.debug(`Deleting user ${user.username}`);
		Focus.Users.delete(user.username);
		user.delete();
		Focus.saveUsers(false);
		Focus.webLog.debug(`Deleted`);

		//  destroy session:
		let sessionId = req.cookies["sessionId"];
		let sessionToken = req.signedCookies["sessionToken"];
		let session = Focus.sessionProvider.getSession(sessionId, sessionToken, false);
		if (session !== undefined) {
			session.destroy();
		}

		res.clearCookie("sessionId");
		res.clearCookie("sessionToken");

		res.end(
			JSON.stringify({
				status: "success",
			})
		);
	} else {
		res.statusCode = 403;
		res.end(
			JSON.stringify({
				status: "error",
				error: "unauthorized",
				errorMessage: "A valid confirmation code is required for this request."
			})
		);
	}
});

router.post('/password', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	let code = (typeof req.body.confirmationCode === "string")? req.body.confirmationCode : "";
	let passwordHash = (typeof req.body.passwordHash === "string")? req.body.passwordHash : undefined;

	if (passwordHash == undefined || passwordHash == "") {
		res.end(
			JSON.stringify({
				status: "error",
				error: "missingFields",
				fields: "passwordHash"
			})
		);
		return;
	}

	if (user.verifyConfirmationCode(code)) {
		Focus.webLog.debug(`Updating the password for ${user.username}`);
		//  destroy sessions:
		user.setPassword(passwordHash)
		Focus.sessionProvider.destroyUserSessions(user.username);

		res.clearCookie("sessionId");
		res.clearCookie("sessionToken");

		res.end(
			JSON.stringify({
				status: "success",
			})
		);
	} else {
		res.statusCode = 403;
		res.end(
			JSON.stringify({
				status: "error",
				error: "unauthorized",
				errorMessage: "A valid confirmation code is required for this request."
			})
		);
	}
});



module.exports = router;