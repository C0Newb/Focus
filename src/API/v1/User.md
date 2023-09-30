# Focus API (v1): User route (/api/v1/user/)



---


## User
Route: `/api/v1/user/`

### Register
Registers a user account.\
Endpoint: `./register`

GET: redirects you to the `/register` web page.

POST: registers the account.
_Send:_
```json5
{
	"username": "oliver_the_cat",	// The username, [0-9A-Za-z_.\-]{1,25}
	"passwordHash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // SHA256 of the user's password ("password")
	"givenName": "Oliver",			// First name
	"familyName": "Cat",			// Last name
	"email": "meowsandwiskers@example.com", 	// Email, used for password resets
}
```

_Receive:_
```json5
{
	"status": "success",
	// "error": "..msg..", // Only if status is "error", will contain the error code.
	// "errorMessage": "..msg.." // Friendly error message to display to the user
}
```
Possible errors include:\
`missingFields`: you're missing required fields, such as the username and password. (There will be the "fields" property that will list the fields missing.)\
`invalidUsername`: username does not match the regex (1-25 characters, alphanumeric, underscores, periods and hyphens) or is taken.\
`invalidEmail`: not a valid email or is blocked.\
`invalidRequest`: generic error.\
`genericError`: generic error.



### Validate (check) username
Checks if a username is valid.\
Endpoint: `./validateUsername`

POST: returns whether the username is valid (`valid`). No reason is given.\
_Send (POST):_
```json5
{
	"username": "oliver_the_cat" // Username to validate
}
```
_or, for GET:_
`./validateUsername?username=oliver_the_cat`

_Receive_:
```json5
{
	"status": "success"
	"valid": true // True or false
	// "reasonMessage": "Username is too short" // Not used! Reserved for future use.
}
```


### Login
Logins the user. You'll receive the session id and token as a cookie.\
Endpoint: `./login`

GET: redirects you to the `/login` web page.

POST: logins you in and generates a unique session and puts the session id and token into your cookies.
```json5
{
	"username": "oliver_the_cat", 	// Username of the account to log into
	"passwordHash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8" // SHA256 of the user's password
}
```

_Receive:_
```json5
{
	"status": "success",
	"sessionId": ".." // Session id (also set as the cookie)
	// "error": "..msg..", // Only if status is "error", will contain the error code.
	// "errorMessage": "..msg.." // Friendly error message to display to the user
}
```
You'll also have the cookie `sessionId` and `sessionToken` set. These will be used to authenticate you.\
If you were previously logged in, that session will be destroyed.

Possible errors include:\
`missingFields`: you're missing required fields, such as the username and password. (There will be the "fields" property that will list the fields missing.)\
`invalidUsername`: username does not match the regex (1-25 characters, alphanumeric, underscores, periods and hyphens) or is unknown.\
`invalidPassword`: the password is wrong.\
`invalidSessionData`: unable to generate a valid session id or session token.\
`invalidRequest`: generic error.\
`genericError`: generic error.



### Logout
Logs out the user, destroying their session and removing the session data from the cookies.\
Endpoint: `./logout`

GET, POST: logs the user out, destroys the session and removes your session cookies.
```json5
{}
```

_Receive:_
```json5
{
	"status": "success",
}
```



### Account details
Gets data about the currently logged in user.\
Endpoint: `./accountDetails`

GET: returns the current details of the logged in user.
```json5
{}
```

_Receive:_
```json5
{
	"status": "success",
	"username": "oliver_the_cat", 	// Your username
	"email": "meowsandwiskers@example.com", 	// Email, used for password resets
	"givenName": "Oliver",			// First name
	"familyName": "Cat",			// Last name
	"shoots": [ 					// Array of shoot ids owned by this user (you)
		"5c32a692-2cf7-412f-b28d-6cd66848dcd2"
	]
}
```
You'll also have the cookie `sessionId` and `sessionToken` set. These will be used to authenticate you.

Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`invalidUsername`: unknown user account. Was you user account deleted but not the session?\



### Shoots
Retrieves an array of shoots the user is either the owner of or has access to.\
Endpoint: `./shoots`

GET: returns a list of shoots accessible by the user.
```json5
{
	"onlyOwned": false // Only show shoots owned by this user
}
```

_Receive:_
```json5
{
	"status": "success",
	"shoots": [ 					// Array of shoot ids owned by or otherwise shared to this user (you)
		"5c32a692-2cf7-412f-b28d-6cd66848dcd2"
	]
}
```
You'll also have the cookie `sessionId` and `sessionToken` set. These will be used to authenticate you.

Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`invalidUsername`: unknown user account. Was you user account deleted but not the session?\



### Confirmation code
Retrieves a confirmation code used for highly privileged actions. Requires the user's password.\
Endpoint: `./shoots`

GET: returns a code that can be used to authenticate for privileged actions.
```json5
{
	passwordHash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8" // SHA256 of the user's password
}
```

_Receive:_
```json5
{
	"status": "success",
	"code": "4rQVcI4wufo80jtvu8VLVIDW6XIJt6nnhnxo0CmQetl2nqBlfm2mxQgh5W3WUWI1" // 64 random characters
}
```
This code can be used for privileged actions, such as deleting the account.

Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`invalidPassword`: unknown user account. Was you user account deleted but not the session?\
`forbidden`: user's password was not valid.



### Delete account
Deletes the user account and related information.\
Endpoint: `./deleteAccount`

DELETE: removes the user's account and related information.
```json5
{
	"confirmationCode": "4rQVcI4wufo80jtvu8VLVIDW6XIJt6nnhnxo0CmQetl2nqBlfm2mxQgh5W3WUWI1" // Confirmation code from /confirmationCode
}
```

```json5
{
	"status": "success" // Can be "unauthorized"
}
```
Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`forbidden`: user's password was not valid.


### Update password
Updates the current user's password. This will destroy all sessions for the user\
Endpoint: `./deleteAccount`

PUT: updates the account password. Requires confirmation code (and therefore current password).
```json5
{
	"confirmationCode": "4rQVcI4wufo80jtvu8VLVIDW6XIJt6nnhnxo0CmQetl2nqBlfm2mxQgh5W3WUWI1",	// Confirmation code from /confirmationCode
	"passwordHash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8" 		// New password
}
```

```json5
{
	"status": "success"
}
```
Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`forbidden`: user's password was not valid.