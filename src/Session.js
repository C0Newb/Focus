/**
	
	Project Focus

		Session strut (class)

*/

const NeptuneCrypto = require("./NeptuneCrypto");
const randomUUID = require("node:crypto").randomUUID;

class Session {
	 /**
     * Unique identifier for this session.
     * @type {string}
     */
    sessionId = randomUUID();

    /**
     * Whether this session has been marked as destroyed by the session provider.
     * @type {boolean}
     */
    isDestroyed = false;

    /**
     * Random 256 character string used to authenticate the user.
     * @type {string}
     */
    sessionToken = NeptuneCrypto.randomString(256);

    /**
     * Used to access more sensitive pages.
     * Has a lifespan of only 15 minutes.
     */
    privilegeToken = NeptuneCrypto.randomString(512);

    /**
     * When the session was originally created.
     * @type {Date}
     */
    creationTime = Date.now();

    /**
     * Last time the session was refreshed or re-authenticated.
     * @type {Date}
     */
    lastRefreshTime = Date.now();

    /**
     * User agent string from the browser.
     * @type {string}
     */
    userAgent;

    /**
     * Current user logged in for this session.
     * @type {string}
     */
    username;

    /**
     * Creates a new instance of the Session class.
     * @param {string} username - Username of the user this session is for.
     * @param {string} sessionId - Optional session id to set this session to rather than the generated one.
     */
    constructor(username, sessionId) {
    	if (typeof username !== "string")
    		throw new TypeError("username expected string got " + (typeof username).toString());

    	if (typeof sessionId === "string")
    		this.sessionId = sessionId;
        this.username = username;
    }

    /**
     * Returns if the session is either `valid` or `validSecure`.
     * @return {boolean} Session can be used.
     */
    isValid() {
    	return Focus.sessionProvider.isValidSession(this.sessionId, this.username);
    }

    /**
     * Gets the current state of the session. Returns `SessionProvider.SessionState`.
     * @return {SessionProvider.SessionState} 
     */
    getState() {
    	return Focus.sessionProvider.getSessionState(this.sessionId, this.sessionToken, this.username, this.privilegeToken);
    }

    /**
     * Destroys the session marking it as invalid.
     @return {void}
     */
    destroy() {
    	return Focus.sessionProvider.destroySession(this);
    }
}

module.exports = Session;