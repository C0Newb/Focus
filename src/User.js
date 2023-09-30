/**
	
	Project Focus

		User class file

*/

const ConfigItem = require("./ConfigItem");
const NeptuneCrypto = require("./NeptuneCrypto");

class User extends ConfigItem {
	/**
	* The username of the user.
	* @type {string}
	*/
	username;

	/**
	* The hashed password (token) of the user.
	* @type {string}
	*/
	password;

	/**
	* The first name of the user.
	* @type {string}
	*/
	givenName;

	/**
	* The last name of the user.
	* @type {string}
	*/
	familyName;

	/**
	* The email address of the user for password resets.
	* @type {string}
	*/
	emailAddress;


	/**
	 * Confirmation codes are used to verify a request really wants to be done, such as account deletion.
	 * The key is the confirmation code, the value is the time it was created.
	 * Confirmation codes have a one minute lifetime.
	 * @type {Map<string, number>}
	 */
	#confirmationCodes = new Map();

	constructor(configurationManager, fileName) {
		super(configurationManager, fileName);
		this.loadSync();
	}


	/**
	* Add a shoot ID to the user's list of owned shoots.
	* @param {string} shootId - The ID of the shoot to add.
	*/
	addShoot(shootId) {
		this.shoots.push(shootId);
	}

	/**
	* Remove a shoot ID from the user's list of owned shoots.
	* @param {string} shootId - The ID of the shoot to remove.
	*/
	removeShoot(shootId) {
		const index = this.shoots.indexOf(shootId);
		if (index !== -1) {
			this.shoots.splice(index, 1);
		}
	}

	/**
	 * Returns an array of shoot ids the user has access to (full or view)
	 * @param {boolean} [owned = false] - Show only shoots that the user owns
	 * @return {string[]}
	 */
	getShoots(owned) {
		owned = owned === true;
		let shoots = [];
		Focus.Shoots.forEach((shoot, shootId) => {
			if (owned) {
				if (shoot.owner === this.username) {
					shoots.push(shootId);
				}
			} else {
				if (shoot.checkUserCanViewImage(this.username, "*", false)) {
					// shoot is visible
					shoots.push(shootId);
				}
			}
		});
		
		return shoots;
	}


	/**
	 * Updates the current user's password.
	 * @param {string|Buffer}
	 * @return {Promise<boolean>} Returns true once the password was updated.
	 */
	setPassword(password) {
		return new Promise((resolve, reject) => {
			NeptuneCrypto.bcrypt.hash(password, Focus.config.security.userPasswordHashCost).then((hash) => {
				this.password = hash;
				this.save().then(resolve).catch(reject);
			}).catch(reject);
		});
	}

	/**
	 * Checks to see if the password is the user's current password.
	 * @param {string|Buffer} password - Password to verify
	 * @return {Promise<boolean>} Whether the password matches the current user's password
	 */
	verifyPassword(password) {
		return NeptuneCrypto.bcrypt.verify(password, this.password);
	}


	/**
	 * Creates a confirmation code that can be used to verify requests really want to be done.
	 * Codes are auto deleted after 1.25 minutes and only last for a minute.
	 * @return {string}
	 */
	createConfirmationCode() {
		let code = NeptuneCrypto.randomString(64, 48, 90); // do not update this unless you update the other
		this.#confirmationCodes.set(code, Date.now());
		setTimeout(() => {
			this.#confirmationCodes.delete(code);
		}, 75000); // auto delete <-- I'm sure this is ok for performance, right?
		return code;
	}

	/**
	 * Checks if a confirmation code is valid.
	 * @param {string} code - Code the check
	 * @return {boolean} - Code is valid 
	 */
	verifyConfirmationCode(code) {
		if (typeof code !== "string" || code.length !== 64)
			return false;

		let now = Date.now();
		if (this.#confirmationCodes.has(code)) {
			if ((now - this.#confirmationCodes.get(code)) <= 75000) {
				// valid
				this.#confirmationCodes.delete(code);
				return true;
			}
		}
		return false;
	}



	/**
	 * @inheritdoc
	 */
	toJSON() {
		let jsonObject = {};
		jsonObject["version"] = this.version.toString();
		jsonObject["username"] = this.username;
		jsonObject["password"] = this.password;
		jsonObject["givenName"] = this.givenName;
		jsonObject["familyName"] = this.familyName;
		jsonObject["emailAddress"] = this.emailAddress;
		jsonObject["shoots"] = this.shoots;

		return jsonObject;
	}

	/**
	 * @inheritdoc
	 */
	fromJSON(JSONObject) {
		if (typeof JSONObject !== "string" && typeof JSONObject !== "object")
			throw new TypeError("JSONObject expected string or object got " + (typeof JSONObject).toString());

		// if (typeof JSONObject.username !== "string")
			// throw new TypeError("JSONObject's username field expected string not " + (typeof JSONObject.username).toString());

		this.username = JSONObject.username || '';
		this.password = JSONObject.password || '';
		this.givenName = JSONObject.givenName || '';
		this.familyName = JSONObject.familyName || '';
		this.emailAddress = JSONObject.emailAddress || '';
		this.shoots = JSONObject.shoots || [];
	}


	/**
	 * Deletes the user account, all their owned shoots, and their permissions on other shoots
	 */
	delete() {
		Focus.log.warn(`Deleting user ${this.username}`);
		try {
			let shootsToProcess = this.getShoots();
			shootsToProcess.forEach((shootId) => {
				if (!Focus.Shoots.has(shootId))
					return;

				let shoot = Focus.Shoots.get(shootId);
				if (shoot.owner === this.username) {
					shoot.delete(); // bye-bye shoot
				} else if (typeof shoot.permissions === "object") {
					if (shoot.permissions[this.username] !== undefined) {
						delete shoot.permissions[this.username] // remove my permissions
					}
				}
			});
		} catch (e) {
			Focus.log.error(e);
		}

		super.delete();
	}
}


module.exports = User;