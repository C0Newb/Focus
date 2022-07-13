/*

	User class File


*/

const pbkdf2 = require('./pbkdf2.js');


const User = function(data) {
	if (data == null)
		data = {};

	if (data.username == null || (data.password == null && data.uCryptPassword == null) || data.firstName == null) {
		console.log(null)
		return;
	}

	this.username = data.username; // Set username
	if (data.uCryptPassword != null)
		hashPassword(data.uCryptPassword, (o_O) => { this.password = o_O; });
	else
		this.password = data.password;
	this.firstName = data.firstName;

	this.email = data.email || "";
	this.phoneNumber = data.phoneNumber || "";
	this.shoots = data.shoots || [];


	this.validatePassword = function(password) {
		return pbkdf2.verifyPassword(this.password, password);
	}
	this.toJSON = function() {
		return {
			username: this.username,
			password: this.password,
			firstName: this.firstName,
			lastName: this.lastName,
			email: this.email,
			phoneNumber: this.phoneNumber
		};
	}

	return this;
};

module.exports = User;