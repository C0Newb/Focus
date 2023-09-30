/**
	
	Project Focus

		Session manager

*/

const Session = require('./Session.js');
const randomUUID = require('node:crypto').randomUUID;

class SessionProvider {
	/**
	 * Currently loaded session
	 * @type {Map<string, Session>}
	 */
	#sessions = new Map();


	/**
	 * States a session can be in
	 * @readonly
	 * @enum {number}
	 */
	SessionState = Object.freeze({
		/** Unknown session, treat the state as not existing. */
		uninitalized: 0,
		/** Invalid session, expired or otherwise not active */
		invalid: 1,
		/** Valid session, can be used but not fully trusted. Use ValidSecure for that. */
		valid: 2,
		/** Session was recently re-authenticated and can access more sensitive areas. */
		validSecure: 3,
		/** Session is not valid, but can be revalidated with a refresh */
		requiresRefresh: 4,
		/** Session has expired and cannot be revalidated */
		expired: 5,
		/** User agent or other session properties do not match */
		tampered: 10
	});

	#log;


	constructor() {
		this.#log = Focus.logMan.getLogger("SessionProvider");
		// do something?
	}


	/**
	 * Returns the session. If validating, returns null if the session is invalid.
	 * @param {string} sessionId - Session id to get.
	 * @param {string} sessionToken - Session secret token.
	 * @param {boolean} [validateSession = true] - Whether to check if the session is valid before returning.
	 * @return {Session}
	 */
	getSession(sessionId, sessionToken, validateSession) {
		validateSession = validateSession !== false;
		if (typeof sessionId !== "string" || typeof sessionToken !== "string")
			return undefined;

		if (!validateSession || this.isValidSession(sessionId, sessionToken))
			return this.#sessions.get(sessionId);
		else
			return undefined;
	}

	/**
	 * Gets the session (if valid) from a web request. This should be used for all requests requiring authentication.
	 * @param {Request} req - The request, should contain `.cookies`.
	 * @return {string|undefined} If undefined is return, the request is not authenticated!
	 */
	getRequestSession(req) {
		if (req.cookies === undefined)
			return undefined;

		let sessionId = req.cookies["sessionId"] || req.signedCookies["sessionId"];
		let sessionToken = req.cookies["sessionToken"] || req.signedCookies["sessionToken"];
		if (sessionId == undefined || sessionToken == undefined)
			return undefined;

		let session = this.getSession(sessionId, sessionToken, true);
		if (session == undefined)
			return undefined;

		if (req.headers["user-agent"] != session.userAgent) {
			// Tampered
			session.tampered = true;
			this.#log.warn(`Session ${sessionId} has been tampered, user-agent has changed. Invaliding.`);
			this.destroySession(session);
			session = undefined;
			return undefined;
		}
		return session;
	}


	/**
	 * Checks if the current user (request) is authenticated (validates session data).
	 * This will send either the "unauthorized" or "invalidUsername" message if needed!
	 * @param {Request} req Incoming request to check
	 * @param {Response} res Response to send unauthorized message on
	 * @param {boolean} [allowAnonymous = false] - Whether visitors that are not logged are allowed.
	 * @returns {User|undefined} If undefined, user is not authenticated!
	 */
	getRequestUser(req, res, allowAnonymous) {
		res.setHeader('Content-Type', 'application/json');
		let session = Focus.sessionProvider.getRequestSession(req);
		if (session == undefined) {
			if (allowAnonymous)
				return undefined;

			res.statusCode = 401;
			res.end(JSON.stringify({ status: "error", error: "unauthorized", errorMessage: "You are not authorized to view this data." }));
			return undefined;
		}

		if (!Focus.Users.has(session.username)) {
			res.end(JSON.stringify({ "status": "error", "error": "invalidUsername", "errorMessage": "Unable to retrieve your user data." }));
			return undefined;
		}

		let user = Focus.Users.get(session.username);
		return user;
	}


	/**
	 * Returns if a session is either `valid` or `validSecure`.
	 * @param {string} sessionId - Unique identifier for the session.
	 * @param {string} sessionId - Session secret token.
	 * @return {boolean} Session is `valid` or `validSecure`.
	 */
	isValidSession(sessionId, sessionToken) {
		if (typeof sessionId !== "string")
			throw new TypeError("sessionId expected string got " + (typeof sessionId).toString());
		if (typeof sessionToken !== "string")
			throw new TypeError("sessionToken expected string got " + (typeof sessionToken).toString());

		let sessionState = this.getSessionState(sessionId, sessionToken);
		if (sessionState == this.SessionState.valid
			|| sessionState == this.SessionState.validSecure)
			return true;

		return false;
	}

	/**
	 * Gets the current state of a session. Returns `SessionState.Invalid` if the session does not exist.
	 * @param {string} sessionId - Unique identifier for the session.
	 * @param {string} sessionToken - Token for the session.
	 * @param {string} username - Username to verify the session belongs to.
	 * @param {string} [privilegeToken] - Token used for more sensitive areas. If not provided, session cannot be `ValidSecure`
	 * @return {SessionProvider.SessionState}
	 */
	getSessionState(sessionId, sessionToken, privilegeToken) {
		if (typeof sessionId !== "string")
			throw new TypeError("sessionId expected string got " + (typeof sessionId).toString());
		if (typeof sessionToken !== "string")
			throw new TypeError("sessionToken expected string got " + (typeof sessionToken).toString());

		this.#log.debug(`Looking up session state for session id: ${sessionId}`);
		if (!this.#sessions.has(sessionId)) {
			this.#log.debug("Unknown session id");
			return this.SessionState.uninitalized;
		}

		let session = this.#sessions.get(sessionId);

		if (sessionToken !== session.sessionToken) {
			this.#log.debug(`Session token does not match (${sessionToken} (provided) !== (known) ${session.sessionToken})`);
			return this.SessionState.invalid;
		}

		// How old the session is in minutes
		let lifeSpan = ((Date.now() - session.creationTime)/1000)/60;
		if (lifeSpan >= Focus.config.security.sessionAbsoluteLifetime) { // a day
			this.#log.debug(`Session lifespan has expired (${lifeSpan}>=config.security.sessionAbsoluteLifetime (${Focus.config.security.sessionAbsoluteLifetime}))`);
			return this.SessionState.expired;
		}

		let refreshAge = ((Date.now() - session.lastRefreshTime)/1000)/60;
		if (refreshAge >= Focus.config.security.sessionLifetime) {
			this.#log.debug(`Session needs to be refreshed, (${refreshAge}>=config.security.sessionLifetime (${Focus.config.security.sessionLifetime})`);
			return this.SessionState.requiresRefresh;
		} else if (refreshAge <= Focus.config.security.sessionSecureLifetime
					&& privilegeToken === session.privilegeToken) {
			this.#log.debug(`Session is considered "secure", (${refreshAge}<=config.security.sessionSecureLifetime (${Focus.config.security.sessionSecureLifetime})`);
			return this.SessionState.validSecure;
		}


		this.#log.debug("Session is valid");
		return this.SessionState.valid;
	}

	/**
	 * Creates a new session for the user by first validating their password.
	 * @param {string} username - User to create a session for.
	 * @param {string} password - Password (hash, sha256) of the user.
	 * @param {string} [userAgent] - User (browser) agent the user connected and is logging in with.
	 * @return {Session} New session for the user. 
	 */
	newSession(username, password) {
		if (typeof username !== "string")
			throw new TypeError("username expected string got " + (typeof username).toString());
		if (typeof password !== "string")
			throw new TypeError("password expected string got " + (typeof password).toString());

		this.#log.debug(`Creating a new session for ${username}`);

		if (Focus.Users === undefined) {
			// ????
			this.#log.debug(`Failed to create a session, the 'Focus.Users' map is undefined.`)
			throw new ReferenceError("invalidUsername");
		}

		if (!Focus.Users.has(username)) {
			this.#log.debug(`Failed to create a session, the user is undefined (not inside 'Focus.Users')`)
			throw new ReferenceError("invalidUsername");
		}
		let user = Focus.Users.get(username);

		// verify the password
		if (!user.verifyPassword(password)) {
			this.#log.debug(`Invalid password!`);
			throw new Error("invalidPassword");
		}


		let sessionId = randomUUID();
		if (!this.#sessions.has(sessionId)) {
			let attempt = 0;
			while (attempt < 50 && this.#sessions.has(sessionId)) {
				sessionId = randomUUID();
			}
			if (this.#sessions.has(sessionId)) {
				this.#log.debug(`Unable to create a unique session id after ${attempt} attempts.`);
				throw new Error("invalidSessionData");
			}
		}
		let session = new Session(username, sessionId);
		this.#sessions.set(session.sessionId, session);
		this.#log.debug(`Session ${session.sessionId} created`);
		return session;
	}


	/**
	 * Destroys a session, making it invalid.
	 * @param {Session|string} session - Session to remove. Can be the Session object or sessionId.
	 * @return {void}
	 */
	destroySession(session) {
		if (typeof session === "string") {
			session = this.#sessions.get(session);
		}
		if (!(session instanceof Session) || session == undefined)
			return;

		this.#log.debug(`Destroying session ${session.sessionId}`)
		session.creationTime = 0;
		session.privilegeToken = "";
		this.#sessions.delete(session.sessionId);
	}


	/**
	 * Destroys all sessions for a user.
	 * @param {string} username - The username of the user to destroy all sessions for
	 * @return {void}
	 */
	destroyUserSessions(username) {
		this.#sessions.forEach((session, sessionId) => {
			if (session !== undefined && session.username == username) {
				try {
					session.destroy();
				} catch (e) {
					Focus.log.error(`Failed to destroy session ${sessionId} for ${username}!`);
					Focus.log.error(e);
				}
			}
		});
	}
}

module.exports = SessionProvider;