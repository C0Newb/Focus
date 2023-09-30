/**
 * 
 * Project Focus
 * 
 * 		FocusConfig is the main configuration file for the app.
 * 
 * 
 */

const ConfigItem = require('./ConfigItem.js');
const Version = require('./Version.js');


/**
 * Config item
 */
class FocusConfig extends ConfigItem {

	/**
	 * Configuration version, so if we introduce any configuration updates that break older versions we can convert them.
	 * @type {Version}
	 */
	configVersion = new Version(1,0,0);

	/**
	 * Encryption settings
	 * @typedef {object} EncryptionDescriptor
	 * @property {boolean} enabled - Whether or not encryption is enabled (and we'll encrypt files on save)
	 * @property {boolean} active - Unused reserved property.
	 * @property {number} newKeyLength - Length newly generated encryption keys should be (keys we create)
	 */

	/**
	 * Encryption settings
	 * @type {EncryptionDescriptor}
	 */
	encryption = {
		enabled: false,
		active: false,
		newKeyLength: 64,
	}

	/**
	 * Security settings
	 * @typedef {object} SecuritySettings
	 * @property {number} userPasswordHashCost - Cost passed to bcrypt when hashing a user's password.
	 */

	/**
	 * Security settings
	 * @type {SecuritySettings}
	 */
	security = {
		userPasswordHashCost: 12,

		// measured in minutes
		sessionAbsoluteLifetime: 1440,
		sessionLifetime: 120,
		sessionSecureLifetime: 15,
	}

	/**
	 * @typedef {object} WebDescriptor
	 * @property {number} port - Port the web server is listening on 
	 */

	/**
	 * Web (express) server settings
	 * @type {WebDescriptor}
	 */
	web = {
		port: 8080,
	}

	/**
	 * Array of tracked shoot ids
	 * @type {string[]}
	 */
	shoots = [];

	/**
	 * Array of tracked user accounts
	 * @type {string[]}
	 */
	users = [];


	/**
	 * @param {ConnectionManager} configManager ConfigurationManager instance
	 * @param {string} fileName The path to the config file
	 * @return {NeptuneConfig}
	 */
	constructor(configManager, fileName) {
		super(configManager, fileName);
		this.loadSync();
	}

	/**
	 * @inheritdoc
	 */
	toJSON() {
		let JSONObject = super.toJSON();
		JSONObject["version"] = this.version.toString();
		JSONObject["encryption"] = this.encryption;
		JSONObject["security"] = this.security;
		JSONObject["web"] = this.web;
		JSONObject["shoots"] = this.shoots;
		JSONObject["users"] = this.users;

		return JSONObject;
	}

	/**
	 * @inheritdoc
	 */
	fromJSON(JSONObject) {
		if (typeof JSONObject !== "string" && typeof JSONObject !== "object")
			throw new TypeError("JSONObject expected string or object got " + (typeof JSONObject).toString());
		
		if (typeof JSONObject === "string")
			JSONObject = JSON.parse(JSONObject);

		if (JSONObject["version"] !== undefined)
			this.version = new Version(JSONObject["version"]);

		if (JSONObject["encryption"] !== undefined)
			this.encryption = JSONObject["encryption"];
		if (JSONObject["security"] !== undefined)
			this.security = JSONObject["security"];
		
		if (JSONObject["web"] !== undefined)
			this.web = JSONObject["web"];

		if (JSONObject["shoots"] !== undefined)
			this.shoots = JSONObject["shoots"];
		if (JSONObject["users"] !== undefined)
			this.users = JSONObject["users"];
	}
}

module.exports = FocusConfig;