/**
	
	Project Focus

		Common Web Runtime

*/

/** @namespace Focus */
const Focus = {};

/**
 * The api root
 * @type {string}
 */
Focus.APILocation = "/api/v1/"


/**
 * Reduces data transferred by the client (lite mode / slow internet mode)
 * @type {boolean}
 */
Focus.ReduceData = false;

/**
 * Whether the site has access to the internet or not.
 * @type {boolean}
 */
Focus.IsOffline = false;


/**
 * Array of shoots
 * @type {Map<string, Shoot>}
 */
Focus.Shoots = new Map();

/**
 * Array of shoot *ids*
 * @type {string[]}
 */
Focus.ShootIds = [];


/**
 * Scroll position of pages
 * @typedef {object} FocusScrollPositions
 * @property {number} Dashboard - Dashboard page's scroll top
 * @property {number} ShootContainer - Shoot page's scroll top
 */

/**
 * Scroll position of pages when we were last on them.
 * Not the _best_ handling, but it works.
 * @type {FocusScrollPositions}
 */
Focus.ScrollPositions = {}


/**
 * Container of custom events
 * @typedef {object} FocusEvents
 * @property {CustomEvent<"cancel-image-loading">} CancelImageLoading - Cancels the loading of a shoot or image.
 */

/**
 * I'm not a fan of this either.
 * @type {FocusEvents}
 * 
 */
Focus.Events = {};
Focus.Events.CancelImageLoading = new CustomEvent('cancel-image-loading');


/**
 * Sets up Focus:
 * 1) Connectivity listeners, misc page setup
 * 2) Load shoots
 * 3) Navigate to url fragment/deep link
 * 4) Setup the main shoots container.
 * 5) Get account data
 */
Focus.initialize = async function() {
	window.addEventListener('online', () => {
		Focus.IsOffline = false;
		Focus.pushPageToastNotification("You're now back online.");
	});
	window.addEventListener('offline', () => {
		Focus.IsOffline = true;
		Focus.pushPageToastNotification("You're now offline!");
	});

	window.addEventListener('load', () => {
		if ((Date.now()-initalPageLoad) <= 500) {
			Focus.Elements.DashboardBackground.style.backgroundImage = "url('https://resources.cnewb.co/cnco.focus/Images/login.jpg')";
		} else {
			Focus.ReduceData = true;
			console.warn("Slow connection detected!");
		}

		let navigationDrawerObserver = new MutationObserver(() => {
			if (Focus.Elements.NavigationDrawer.classList.contains('is-visible')) {
				Focus.Elements.ContentHost.classList.add("ch-drawerOut");
			} else {
				Focus.Elements.ContentHost.classList.remove("ch-drawerOut");
			}
		});
		navigationDrawerObserver.observe(Focus.Elements.NavigationDrawer, {
			attributes: true,
			subtree: true,
			attributeFilter: ['class'],
		});

		// Unhide the notification
		document.getElementById("toast-notification").style.display = "";

	});

	window.addEventListener('popstate', () => {
		/**
		 * @type {FocusHistoryState}
		 */
		let state = history.state;
		if (state == undefined)
			return;

		// Cancel image loading
		window.dispatchEvent(Focus.Events.CancelImageLoading);
		Focus.setupHtmlElementReferences(); // Sometimes SectionTitle become undefined?..

		// ??
		if (typeof state.container === "string") {
			Focus.Elements.ContentHost.innerHTML = state.container;
		}

		// set the previous title
		if (typeof state.title === "string") {
			Focus.Elements.SectionTitle.innerHTML = state.title;
			document.title = state.title + " - Focus";
		}

		function scrollTo(pos) {
			Focus.Elements.ContentHost.scrollTo({
				top: pos,
				// behavior: "smooth"
			});
		}

		// set the nav bar contents
		if (typeof state.navDrawerHtml === "string") {
			Focus.Elements.NavigationDrawer.children[0].innerHTML = state.navDrawerHtml;
		}


		if (typeof state.pageName === "string") {
			Focus.Elements.ShootsContainer.hidden = true;
			Focus.Elements.ShootContainer.hidden = true;
			Focus.Elements.ImageContainer.hidden = true;

			// very, very likely
			Focus.Elements.BackButton.classList.remove("back-button-white");
			Focus.Elements.BackButton.hidden = false;


			switch (state.pageName) {
				case "shoots-container":
					Focus.Elements.ShootsContainer.hidden = false;
					Focus.Elements.BackButton.hidden = true;
					scrollTo(Focus.ScrollPositions.Dashboard);
					break;

				case "shoot-container":
					Focus.Elements.ShootContainer.hidden = false;
					scrollTo(Focus.ScrollPositions.ShootContainer);
					break;

				case "image-container":
					Focus.Elements.ImageContainer.hidden = false;
					Focus.Elements.BackButton.classList.add("back-button-white");
					break;
			}
		}

	});

	Focus.setupHtmlElementReferences();


	await Focus.getShoots(); 						// 2
	Focus.processPageLink(window.location.hash);	// 3
	Focus.resetDashboard();							// 4
	Focus.resetAccountDetails(); 					// 5
}


/**
 * Setups the main dashboard with accessible shoots.
 * @param {boolean} owned - Whether to only show shoots owned by the user
 * @return {void}
 */
Focus.resetDashboard = async function(owned) {
	$('#shoots-container').empty();
	let shoots = await Focus.getShoots(owned);
	console.log("Shoots: ");
	console.log(shoots);
	shoots.forEach(async (shootId) => {
		let shootCover = await Focus.getShootCoverImage(shootId);
		if (shootCover === undefined)
			return;

		let shootImage = Focus.getImage(shootId, shootCover);
		shootImage.addShootEntryPhoto();
	});
}

/**
 * Gets the current account data and sets the username and whether the user is logged in or not on the title bar.
 * @return {void}
 */
Focus.resetAccountDetails = function() {
	Focus.getAccountDetails().then((details) => {
		let btnMyShoots = document.getElementById("my-shoots-btn");
		let lblUsername = document.getElementById("username-label");
		let menuLoggedIn = document.getElementById("account-menu-loggedin");
		let menuLoggedOut = document.getElementById("account-menu-loggedout");

		if (details.username == undefined) {
			console.log("[User] User not logged in.");
			
			btnMyShoots.ariaDisabled = btnMyShoots.hidden = true;
			btnMyShoots.setAttribute("disabled", "disabled");
		} else {
			console.log("[User] User currently logged in: " + details.username);

			btnMyShoots.ariaDisabled = btnMyShoots.hidden = false;
			btnMyShoots.removeAttribute("disabled");

			lblUsername.textContent = details.username;
			
			menuLoggedIn.hidden = menuLoggedIn.ariaHidden = false;
			menuLoggedOut.hidden = menuLoggedOut.ariaHidden = false;
		}
	}).catch(console.log);
}

Focus.downloadImage = function(shootId, imageId) {
	window.open(Focus.getImageDownloadUrl(shootId, imageId, "original"))
}

/**
 * @typedef {object} pageToastNotificationReturn
 * @property {function} dismiss - Dismiss/hide to toast notification early.
 */

/**
 * Sends "toast" notification to the bottom of the page.
 * This is **not** a desktop/mobile notification.
 * 
 * @param {string} msg - Message to display.
 * @param {number} [duration=2000] - number of milliseconds for the toast to stay displayed.
 * @return {pageToastNotificationReturn} Ability to close/dismiss the notification early.
 */
Focus.pushPageToastNotification = function(msg, duration) {
	if (typeof duration !== "number")
		duration = 2000; // 2s
	if (duration < 250)
		duration = 250;
	if (duration > 10000) // there might be limits in place by Google, but meh
		duration = 10000;

	console.log(`[Toast-Notification] ${msg}`);
	var toastNotification = document.getElementById("toast-notification");
	toastNotification.MaterialSnackbar.showSnackbar({
		message: msg,
		timeout: duration
	});

	return { 
		dismiss: function() {
			toastNotification.MaterialSnackbar.cleanup_();
		}
	} // Hide function
}


function validatePasswordStrength(pass) {
	if (typeof pass !== "string"
		|| pass.length < 8
		|| pass.length > 255) {
		throw new Error("Password is invalid");
	}
}


/**
 * Sends a request via Fetch to the API.
 * @param {("get"|"post"|"patch"|"put")} method - Request method
 * @param {string} endpoint - Endpoint to hit, such as /user/shoots
 * @param {any} data - Data to become the json'd body. If the method is get and this is an array, we'll join the array with "/" and add it to the URL
 */
Focus.sendRequestRaw = function(method, endpoint, data, options) {
	options = (typeof options === "object")? options : {};
	options.method = method;
	options.mode = 'cors'
	options.redirect = "follow";
	options.headers = {
		"Accept": "application/json",
		"Content-Type": "application/json"
	}

	if (method !== "get") {
		options.body = JSON.stringify(data || {});
	} else {
		if (Array.isArray(data)) {
			// we can append this to the endpoint
			endpoint += "/" + data.join('/');
		}
	}

	return new Promise((resolve, reject) => {
		try {
		fetch(Focus.APILocation + endpoint, options)
			.then((response) => {
				if (response.headers.get('content-type') === "application/json") {
					response.json().then(resolve).catch(reject);
				} else {
					resolve(response);
				}
			})
			.catch((reason) => reject);
		} catch (e) {
			console.error(`Error on request ${method} for ${endpoint}.`);
			console.error(e);
		}
	});
}

/**
 * Focus specific request runner. Will ensure the response contains `{ "status": "success" }`.
 * @param {("get"|"post"|"patch"|"put")} method - Request method
 * @param {string} endpoint - Endpoint to hit, such as /user/shoots
 * @param {any} data - Data to JSONify and send. If the method is get and this is an array, the array will be joined with '/' and added to the URL.
 * @param {boolean} [doNotDeleteStatus = false] - Do not remove the "status" entry from the JSON data.
 * @return {Promise<object>} - Response JSON data.
 */
Focus.sendRequest = function(method, endpoint, data, doNotDeleteStatus) {
	return new Promise((resolve, reject) => {
		console.log(`[Focus - RR] ${method.toUpperCase()}-${endpoint}: sending...`);

		Focus.sendRequestRaw(method, endpoint, data).then((response) => {
				if (response.status == "success") {
					console.log(`[Focus - RR] ${method.toUpperCase()}-${endpoint}: successful`);
					if (doNotDeleteStatus !== false)
						delete response.status;
					resolve(response);
				} else {
					console.log(`[Focus - RR] ${method.toUpperCase()}-${endpoint}: failed (${response.error}: ${response.errorMessage})`);
					reject(response);
				}
			})
			.catch((e) => {
				console.log(`[Focus - RR] ${method.toUpperCase()}-${endpoint}: failed to send the request.`);
				console.log(e);
				reject(e);
			});
	});
}



/**
 * Takes a string and hashes it via sha256. Returns the hex hash.
 * @param {string} str - String to hash
 * @return {Promise<string>} Hashed string
 */
Focus.sha256 = function(str) {
	return new Promise(async (resolve, reject) => {
		const msgUint8 = new TextEncoder().encode(str); // encode as (utf-8) Uint8Array
		const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
		const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
		const hashHex = hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join(""); // convert bytes to hex string
		resolve(hashHex);
	});
}


/**
 * Gets a valid quality string given a string (or any other type).
 * @param {("original"|"high"|"medium"|"low"|"thumbnail")|object} [quality = "medium"] - The quality the image should be in.
 * @return {("original"|"high"|"medium"|"low"|"thumbnail")} Valid quality string
 */
Focus.getQualityFromString = function(quality) {
	quality = (typeof quality === "string")? quality.toLowerCase() : "high";
	if (!["original","high","medium","low","thumbnail"].includes(quality)) {
		quality = "high";
	}
	return quality;
}


/**
 * @typedef {object} FocusElements
 * 
 * @property {HTMLElement} ContentHost - Main page, holds all the views.
 * 
 * Pages:
 * @property {HTMLElement} ShootsContainer - The container holding all shoot cards (main screen).
 * @property {HTMLElement} ShootContainer - The container holding a shoot's images.
 * @property {HTMLElement} ImageContainer - The container holding a single image of a shoot.
 * 
 * Navigational items:
 * @property {HTMLElement} NavigationDrawerButton - Hamburger menu button
 * @property {HTMLElement} NavigationDrawer - Side navigation drawer
 * @property {HTMLElement} SectionTitle - Title shown in the top navigation header
 * @property {HTMLElement} BackButton - Back button.
 * 
 * Loading overlays:
 * @property {HTMLElement} ContentLoader - Primary overlay for loading
 * @property {HTMLElement} ContentLoaderLabel - Primary label (span) for displaying current "loading" task details.
 * 
 * Misc elements:
 * @property {HTMLElement} DashboardBackground - Div containing the page background.
 */

/**
 * Namespace of all page elements.
 * @type {FocusElements}
 */
Focus.Elements = {}

Focus.setupHtmlElementReferences = function() {
	Focus.Elements.ContentHost = document.getElementById("content-host");

	Focus.Elements.ShootsContainer = document.getElementById("shoots-container");
	Focus.Elements.ShootContainer = document.getElementById("shoot-container");
	Focus.Elements.ImageContainer = document.getElementById("image-container");

	Focus.Elements.NavigationDrawerButton = document.getElementsByClassName(".mdl-layout__drawer-button")[0];
	Focus.Elements.NavigationDrawer = document.getElementById("navDrawer");
	Focus.Elements.SectionTitle = document.getElementById("section-title");
	Focus.Elements.BackButton = document.getElementById("back-button");

	Focus.Elements.ContentLoader = document.getElementById("content-loader");
	Focus.Elements.ContentLoaderLabel = document.getElementById("content-loadingText");

	Focus.Elements.DashboardBackground = document.getElementById("dashboard-bg");
}



/**
 * 
 * Navigation
 * 
 */

/**
 * The "state" pushed/popped from history
 * @typedef {object} FocusHistoryState
 * 
 * @property {string} title - Title of the section
 * @property {("shoots-container"|"shoot-container"|"image-container")} pageName - Name of the section.
 * @property {number} scrollPosition - How far the user was scrolled.
 * @property {string} navDrawerHtml - HTML contents of the nav drawer.
 * @property {string} [shootId] - Shoot being viewed/used.
 * @property {string} [imageId] - Image id being viewed.
 * 
 * @property {string} [container] - Custom page HTML. Why?
 */



/**
 * Process a page (deep) link, the url fragment
 * @param {string} link - Url fragment, such as `#/shoot/abc/..`
 */
Focus.processPageLink = async function(link) {
	if (typeof link !== "string")
		throw new TypeError("link expected string got " + (typeof link).toString());

	link.replace(/^(#*)/g,''); // removes the "#" (and any extras) from the start of the link
	let segments = link.split('/');
	if (segments.length <= 0)
		return;

	// viewing a shoot ?
	if (segments[1] == "shoot" && segments.length >= 2 && Focus.Shoots.has(segments[2])) {
		// yeppir
		/** @type {Shoot} */
		let shoot = Focus.Shoots.get(segments[2]);
		let images = await shoot.getImages();
		
		Focus.displayShoot(shoot.id); // this *should* be in an else statement, but easiest way to fix history

		if (segments.length >= 3 && images.includes(segments[3])) { // viewing an image?
			// yep yep
			setTimeout(() => {
				return Focus.displayImage(shoot.getImage(segments[3]));
			}, 500);
		}

	} else if (segments[1] == "account") {

	} else {
		// nope, what are you viewing?
	}
}

/**
 * Redirect the browser to a different page with a particular name
 * @param {string} name - Page to redirect to (`./name`)
 * @return {void}
 */
Focus.redirectToPage = function(name) {
	window.location.href = './' + name;
}


Focus.getCurrentView = function() {
	if (!Focus.Elements.ShootsContainer.hidden) {
		console.log("Current view: shoots-container");
		return "shoots-container";

	} else if (!Focus.Elements.ShootContainer.hidden) {
		console.log("Current view: shoot-container");
		return "shoot-container";

	} else if (!Focus.Elements.ImageContainer.hidden) {
		console.log("Current view: image-container");
		return "image-container";
	}
}


/**
 * Displays a shoot.
 * @param {string|Shoot} shoot - Shoot (class) to display.
 * @return {void}
 */
Focus.displayShoot = async function(shoot) {
	if (typeof shoot == "string")
		shoot = Focus.Shoots.get(shoot);

	window.shoot = shoot;
	let shootImages = await shoot.getImages(true);

	// Change sidebar buttons
	var buttonLH = 'class="mdl-navigation__link mdl-button mdl-js-button mdl-js-ripple-effect"></button>';
	var linkLH = 'class="hide-link" href="#"></a>';

	Focus.Elements.ContentHost.scrollTo({
		top: 0,
		behavior: "smooth"
	});
	
	// Build nav drawer:
	$('.drawer-nav').empty();
	$('.drawer-nav').append('<div style="height: 25px;"></div>');
	
	$('.drawer-nav').append('<button id="download-button" ' + buttonLH);
	let downloadLink = Focus.getShootDownloadUrl(shoot.id, "high");
	$("#download-button").on('click', function() {
		downloadShoot(shoot.id);
	}).append(`<a id="download-button_link" class="hide-link" href="${downloadLink}"></a>`);
	$('#download-button_link').text("Download");
	
	$('.drawer-nav').append('<div style="height: 25px;"></div>');
	
	$('.drawer-nav').append('<button id="share-button" ' + buttonLH);
	$("#share-button").on('click', function() {
		shareShoot(shoot.id);
	}).append('<a id="share-button_link" ' + linkLH);
	$('#share-button_link').text("Share");
	
	$('.drawer-nav').append('<div style="height: 25px;"></div>');
	
	$('.drawer-nav').append('<button id="manage-button" ' + buttonLH);
	$("#manage-button").on('click', function() {
		manageShoot(shoot.id);
	}).append('<a id="manage-button_link" ' + linkLH);
	$('#manage-button_link').text("Manage");
	// </> Build nav drawer

	let title = await shoot.getTitle(true);
	Focus.ScrollPositions.Dashboard = Focus.Elements.ContentHost.scrollTop
	history.pushState({
		title: title,
		pageName:'shoot-container',
		navDrawerHtml: Focus.Elements.NavigationDrawer.children[0].innerHTML,
		shootId: shoot.id,
	}, "", `#/shoot/${shoot.id}`); // what we are going to be looking at


	// Set title
	Focus.Elements.SectionTitle.innerHTML = title;
	document.title = title + " - Focus";

	// Hide old elements
	Focus.Elements.ShootContainer.innerHTML = "";
	Focus.Elements.ShootsContainer.hidden = true;
	Focus.Elements.ImageContainer.hidden = true;

	// Add photos
	shootImages.forEach((imageId, index) => {
		let image = shoot.getImage(imageId);
		image.addEntryPhoto();
	});

	// Show it
	Focus.Elements.ShootContainer.hidden = false;
	Focus.Elements.BackButton.hidden = false;
}

/**
 * Display the large image
 * @param {FocusImage} image
 */
Focus.displayImage = async function(image) {
	// Change sidebar buttons
	var buttonLH = 'class="mdl-navigation__link mdl-button mdl-js-button mdl-js-ripple-effect"></button>';
	var linkLH = 'class="hide-link" href="#"></a>';

	Focus.Elements.BackButton.classList.add("back-button-white");

	// Nav drawer	
	$('.drawer-nav').empty();
	$('.drawer-nav').append('<div style="height: 25px;"></div>');
	
	$('.drawer-nav').append('<button id="download-button" ' + buttonLH);
	$("#download-button").on('click', function() {
		Focus.downloadImage(image.shootId, image.id);
	}).append('<a id="download-button_link" ' + linkLH);
	$('#download-button_link').text("Download image");
	
	$('.drawer-nav').append('<div style="height: 25px;"></div>');
	
	$('.drawer-nav').append('<button id="manage-button" ' + buttonLH);
	$("#share-button").on('click', function() {
		shareShoot(image.shootId);
	}).append('<a id="share-button_link" ' + linkLH);
	$('#share-button_link').text("Share");
	
	$('.drawer-nav').append('<div style="height: 25px;"></div>');
	
	$('.drawer-nav').append('<button id="manage-button" ' + buttonLH);
	$("#manage-button").on('click', function() {
		manageShoot(image.shootId);
	}).append('<a id="manage-button_link" ' + linkLH);
	$('#manage-button_link').text("Manage");
	// </> Nav drawer

	Focus.ScrollPositions.ShootContainer = Focus.Elements.ContentHost.scrollTop

	let imageName = await Focus.Shoots.get(image.shootId).getImageName(image.id, true);
	history.pushState({
		title: imageName,
		pageName:'image-container',
		navDrawerHtml: Focus.Elements.NavigationDrawer.children[0].innerHTML,
		shootId: image.shootId,
		imageId: image.id,
	}, '', `#/shoot/${image.shootId}/${image.id}`); // what we ARE looking at

	// Set title
	Focus.Elements.SectionTitle.innerHTML = imageName;
	document.title = imageName + " - Focus";
	// wait for shoot name (might already be there)
	if (Focus.Shoots.has(image.shootId)) {
		Focus.Shoots.get(image.shootId).getTitle(true).then((title) => {
			Focus.Elements.SectionTitle.innerHTML = `${imageName} - ${title}`;
		});
	}
	
	// Hide old elements
	Focus.Elements.ImageContainer.innerHTML = "";
	Focus.Elements.ShootsContainer.hidden = true;
	Focus.Elements.ShootContainer.hidden = true;

	
	var tN;

	let standardImage = new Image();
	standardImage.id = "image-container-image";
	if (Focus.ReduceData)
		standardImage.src = image.url + '/low';
	else
		standardImage.src = image.url + '/high';
	

	function cancelLoading() {
		standardImage.src = "";
	}
	window.addEventListener('cancel-image-loading', cancelLoading, {
		once: true
	});

	standardImage.onload = () => { // Image loaded
		window.removeEventListener('cancel-image-loading', cancelLoading, {
			once: true
		});

		console.log("[displayImage] Image view loaded.")
		$("#content-loadingText").text("Image loaded!");

		tN = Focus.pushPageToastNotification('Loading higher quality version...', 9999);

		// Now load a higher quality version of this image
		var highQualityImage = new Image();
		highQualityImage.id = "image-container-image";
		if (Focus.ReduceData)
			highQualityImage.src = image.url + '/high';
		else
			highQualityImage.src = image.url + '/original';

		function cancelLoadingHq() {
			highQualityImage.src = "";
		}
		window.addEventListener('cancel-image-loading', cancelLoadingHq, {
			once: true
		});

		highQualityImage.onload = function() {
			window.removeEventListener('cancel-image-loading', cancelLoadingHq, {
				once: true
			});

			// high quality version loaded. Display.
			Focus.Elements.ImageContainer.innerHTML = ""; // clear
			Focus.Elements.ImageContainer.appendChild(highQualityImage);

			if (tN != undefined)
				tN.dismiss();

			Focus.pushPageToastNotification("High quality image loaded.", 1250);
		}

		Focus.Elements.ImageContainer.hidden = false;
		Focus.Elements.BackButton.hidden = false;
	}

	Focus.Elements.ImageContainer.innerHTML = ""; // clear
	Focus.Elements.ImageContainer.appendChild(standardImage); // set
}





/**
 * 
 * User API
 * 
 */

/**
 * @typedef {object} newAccountOptions
 * @property {string} [givenName] - First name
 * @property {string} [familyName] - Last name
 */
/**
 * Registers a user account.
 * @param {string} username - New user account name
 * @param {string} password - Password in plain text
 * @param {string} email - Email address for the account
 * @param {newAccountOptions} options - Optional settings for the new account.
 * @return {Promise<object>}
 */
Focus.registerUser = async function(username, password, email, options) {
	if (typeof username !== "string")
		throw new TypeError("username expected string got " + (typeof username).toString());
	validatePasswordStrength(password);
	if (typeof email !== "string")
		throw new TypeError("email expected string got " + (typeof email).toString());

	let body = {
		username: username,
		passwordHash: await Focus.sha256(password),
		email: email,
		givenName: options?.familyName,
		familyName: options?.givenName
	};
	return Focus.sendRequest("post", "user/register", body);
}

/**
 * Checks if a username is available to be registered with.
 * @param {string} username - Username to check
 * @return {Promise<boolean>} 
 */
Focus.isUsernameAvailable = async function(username) {
	if (typeof username !== "string")
		throw new TypeError("username expected string got " + (typeof username).toString());

	let response = await Focus.sendRequest("post", "user/validateUsername", {
		username: username
	});
	return response.valid === true
}

/**
 * Logs in a user
 * @param {string} username - User to login as
 * @param {string} password - Plain text password
 * @return {Promise<object>} - Response from Focus
 */
Focus.loginUser = async function(username, password) {
	if (typeof username !== "string")
		throw new TypeError("username expected string got " + (typeof username).toString());
	if (typeof password !== "string")
		throw new TypeError("password expected string got " + (typeof password).toString());

	let body = {
		username: username,
		passwordHash: await Focus.sha256(password)
	};
	return Focus.sendRequest("post", "user/login", body);
}

/**
 * Logs out the user
 * @return {Promise<object>}
 */
Focus.logoutUser = function() {
	return Focus.sendRequest("post", "user/logout");
}
/**
 * Logs out the user a redirects them to the login page.
 * @return {void}
 */
Focus.logout = function() {
	Focus.sendRequest("post", "user/logout").then(() => {
		Focus.redirectToPage("login");
	});
}



/**
 * Get the shoots currently viewable by this client
 * @param {boolean} owned - Only show shoots owned by the user
 * @return {Promise<string[]>} Shoot ids this session can see
 */
Focus.getShoots = async function(owned) {
	let response = await Focus.sendRequest("get", `user/shoots?ownedOnly=${owned === true}`);
	Focus.ShootIds = response.shoots;
	
	// load
	Focus.ShootIds.forEach(async (shootId) => {
		await Focus.Shoots.set(shootId, new Shoot(shootId));
	});

	return response.shoots;
}

/**
 * @typedef {object} AccountDetails
 * @property {string} username - Account username
 * @property {string} email - Account email
 * @property {string} givenName - Account first name
 * @property {string} familyName - Account last name
 * @property {string} shoots - Shoots viewable by the user
 */

/**
 * Returns the user account details
 * @return {Promise<AccountDetails>}
 */
Focus.getAccountDetails = function() {
	return new Promise((resolve, reject) => {
		Focus.sendRequest("get", "user/accountDetails").then((details) => {
			Focus.User = details;
			resolve(details);
		}).catch(reject);
	});
}

/**
 * Updates the account details
 * @param {AccountDetails} accountDetails - Updated data. Note: only the name and email is modifiable.
 * @return {Promise<object>}
 */
Focus.setAccountDetails = function(accountDetails) {
	let body = {
		givenName: (typeof accountDetails.givenName === "string")? accountDetails.givenName : undefined,
		familyName: (typeof accountDetails.familyName === "string")? accountDetails.familyName : undefined,
		email: (typeof accountDetails.email === "string")? accountDetails.email : undefined
	};
	return Focus.sendRequest("patch", "user/accountDetails", body);
}


/**
 * Generates a confirmation code for 
 * @return {Promise<string>}
 */
Focus.getConfirmationCode = async function(password) {
	if (typeof password !== "string")
		throw new TypeError("password expected string got " + (typeof password).toString());

	let body = {
		passwordHash: await Focus.sha256(password)
	};
	let response = await Focus.sendRequest("post", "user/confirmationCode", body);
	return response.confirmationCode;
}

/**
 * Changes the user's password.
 * @param {string} oldPassword - Current plain text password
 * @param {string} newPassword - Plain text password
 * @return {Promise<boolean>} Successfully changed
 */
Focus.changePassword = async function(oldPassowrd, newPassword) {
	if (typeof oldPassowrd !== "string")
		throw new TypeError("oldPassowrd expected string got " + (typeof oldPassowrd).toString());
	validatePasswordStrength(newPassword);

	let response = await Focus.sendRequest("post", "user/password", {
		confirmationCode: await Focus.getConfirmationCode(oldPassowrd),
		passwordHash: await Focus.sha256(newPassword)
	}, true);
	return response.status === "success";
}

/**
 * Deletes the user account. Requires a confirmation code from `Focus.getConfirmationCode()`.
 * @param {string} confirmationCode - Confirmation code from `Focus.getConfirmationCode()`
 * @return {Promise<object>}
 */
Focus.deleteAccount = function(confirmationCode) {
	new Promise((resolve, reject) => {
		if (typeof confirmationCode !== "string")
			throw new TypeError("confirmationCode expected string got " + (typeof confirmationCode).toString());

		Focus.sendRequest("delete", "user/deleteAccount", {
			confirmationCode: confirmationCode,
		}).then((response) => {
			Focus.logout();
		}).catch(reject);
	});
}





/**
 * 
 * Shoots API
 * 
 */

/**
 * Creates a new shoot
 * @param {string} name - Shoot name. Must be between 1 and 255 characters.
 * @param {string} description - Friendly description. Must be under 1000 characters.
 * @return {Promise<string>} New shoot's id
 */
Focus.createShoot = async function(name, description) {
	let response = await Focus.sendRequest("post", "shoot/create", {
		name: name,
		description: description
	});
	return response.shootId;
}

/**
 * Uploads an image to a shoot
 * @param {string} shootId - Id of the shoot
 * @param {File|FileList} image - Image file to upload
 * @return {Promise<Map<string, string>>} A map of the original image name and the new image id in the shoot.
 */
Focus.uploadImage = function(shootId, image) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			reject(new TypeError("shootId expected string got " + (typeof shootId).toString()));
		if (!(image instanceof FileList) && !(image instanceof File))
			reject(new TypeError("image expects FileList or File."));

		function handleResponse(response) {
			console.log(response);
			// $("#upload-container").fadeOut(250);
			// $("#shoots-container").fadeIn(250);
			// Uploaded!
			if (response.status == "success") {
				toastNotification("Upload complete.");
				console.log("[Uploader] Upload was successful!");
				resolve(response.results);
			} else if (response.status == "error") {
				console.log(`[Uploader] Upload failed! Error:\n${response.error}: ${response.errorMessage || "No message."}`);

				switch (response.error) {
					case "unauthorized":
					case "invalidUsername":
						toastNotification("Upload failed, you must login before uploading.");
						break;

					case "invalidShoot":
						toastNotification("Upload failed, unknown shoot.");
						break;

					default:
						toastNotification("Upload failed, unknown error occurred.");
				}

				reject(response);
			}
		}


		window.test = image;
		let formData = new FormData();
		if (image instanceof FileList) {
			for (let i = 0; i<image.length; i++) {
				formData.append("images", image[i]);
			}
		} else {
			formData.append('images', image);
		}

		var xhr = new XMLHttpRequest();
		if (!(xhr && ('upload' in xhr) && ('onprogress' in xhr.upload)) || !window.FormData) {
				$.ajax({
					url: `api/v1/shoot/upload/${shootId}`,
					type: "POST",
					data: formData,
					processData: false,
					contentType: false,
					success: (data) => {
						handleResponse(JSON.parse(data || "{}"));
					},
					error: (err) => {
						console.warn("Failed to upload: ");
						console.error(err);
						reject(err);
					}
				});
		} else {
			xhr.upload.addEventListener('loadstart', function(event) {
				//initializing the progress indicator (here we're displaying an element that was hidden)
				// document.querySelector('#upload-progress').hidden = false;
			}, false);

			xhr.upload.addEventListener('progress', function(event) {
				//displaying the progress value as text percentage, may instead update some CSS to show a bar
				var percent = (100 * event.loaded / event.total);
				// progress.MaterialProgress.setProgress(percent);
				console.log("[Uploader] Upload progress: " + percent.toFixed(0) + "%");
			}, false);

			xhr.upload.addEventListener('load', function(event) {
				//this will be displayed while the server is handling the response (all upload data has been transmitted by now)
				// progress.classList.add("mdl-progress__indeterminate")
				console.log("[Uploader] Uploaded, awaiting response.");
			}, false);

			xhr.addEventListener('readystatechange', function(event) {
				if (event.target.readyState == 4 && event.target.responseText) {
					handleResponse(JSON.parse(event.target.responseText || "{}"));
				} else {
					let response = (event.target.responseText != undefined)? event.target.responseText : "{}";
					reject(JSON.parse(response));
				}
			}, false);

			//posting the form with the same method and action as specified by the HTML markup
			xhr.open("post", `api/v1/shoot/upload/${shootId}`, true);
			xhr.send(formData);
		}
	});
	
}

/**
 * Opens a file picker to select images and then calls `Focus.processImagesForUpload(FileList)`.
 * @return {Promise<Map<string, string>>} A map of the original image name and the new image id in the shoot.
 */
Focus.selectImagesForUpload = function(shootId) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			reject(new TypeError("shootId expected string got " + (typeof shootId).toString()));

		var input = document.getElementById('fileElement');
		input.type = 'file';
		input.multiple = "multiple";
		input.accept = ".png,.webp,.jpg,.jpeg";

		input.onchange = e => { 
			Focus.uploadImage(shootId, e.target.files).then(resolve).catch(reject);
		}

		input.click();
	});
}


/**
 * Deletes a shoot given the id and a confirmation code from `Focus.getConfirmationCode()`.
 * @param {string} shootId - Id of the shoot
 * @param {string} confirmationCode - Authentication code
 * @return {Promise<object>} Server response
 */
Focus.deleteShoot = function(shootId, confirmationCode) {
	if (typeof shootId !== "string")
		throw new TypeError("shootId expected string got " + (typeof shootId).toString());

	return Focus.sendRequest("delete", "shoot/delete", {
		confirmationCode: confirmationCode,
		shootId: shootId
	});
}

/**
 * Returns the name of the shoot
 * @param {string} shootId - Id of the shoot
 * @return {Promise<string>} Name of the shoot
 */
Focus.getShootTitle = function(shootId) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			throw new TypeError("shootId expected string got " + (typeof shootId).toString());

		Focus.sendRequest("get", `shoot/name/${shootId}`).then((response) => {
			resolve(response.name);
		}).catch(reject);
	});
}
/**
 * Sets the name of the shoot
 * @param {string} shootId - Id of the shoot
 * @param {string} name - New title/name of the shoot. Must be between 1 and 255 characters.
 * @return {Promise<boolean>} Successfully updated.
 */
Focus.setShootTitle = function(shootId, name) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			throw new TypeError("shootId expected string got " + (typeof shootId).toString());
		if (typeof name !== "string")
			throw new TypeError("name expected string got " + (typeof name).toString());

		Focus.sendRequest("put", `shoot/name/${shootId}`, { name: name }).then((result) => {
			resolve(result.name == name);
		}).catch(reject);
	});
}

/**
 * Returns the description of the shoot
 * @param {string} shootId - Id of the shoot
 * @param {[boolean=false]} useCache - Whether to get the shoot id from the cache first, only requesting it if not found.
 * @return {Promise<string>} Description of the shoot
 */
Focus.getShootDescription = function(shootId) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			reject(TypeError("shootId expected string got " + (typeof shootId).toString()));

		Focus.sendRequest("get", `shoot/description/${shootId}`).then((response) => {
			resolve(response.description);
		}).catch(reject);
	});

}
/**
 * Sets the description of the shoot
 * @param {string} shootId - Id of the shoot
 * @param {string} description - New description of the shoot. Must be under 1000 characters.
 * @return {Promise<boolean>} Description successfully updated.
 */
Focus.setShootDescription = function(shootId, description) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			throw new TypeError("shootId expected string got " + (typeof shootId).toString());
		if (typeof description !== "string")
			throw new TypeError("description expected string got " + (typeof description).toString());

		Focus.sendRequest("put", `shoot/description/${shootId}`, { description: description }).then((result) => {
			resolve(result.description == description);
		}).catch(reject);
	});
}

/**
 * Returns the owner's username of the shoot
 * @param {string} shootId - Id of the shoot
 * @return {Promise<string>} Owner of the shoot
 */
Focus.getShootOwner = function(shootId) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			throw new TypeError("shootId expected string got " + (typeof shootId).toString());

		Focus.sendRequest("get", `shoot/owner/${shootId}`).then((response) => {
			resolve(response.owner);
		}).catch(reject);
	});
}

/**
 * Returns the cover image id for the shoot
 * @param {string} shootId - Id of the shoot
 * @param {[boolean=false]} useCache - Whether to get the shoot id from the cache first, only requesting it if not found.
 * @return {Promise<string>} Image id for the cover of the shoot
 */
Focus.getShootCoverImage = function(shootId) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			throw new TypeError("shootId expected string got " + (typeof shootId).toString());

		Focus.sendRequest("get", `shoot/cover/${shootId}`).then((response) => {
			resolve(response.imageId);
		}).catch(reject);
	});
}
/**
 * Sets the cover image of the shoot
 * @param {string} shootId - Id of the shoot
 * @param {string} imageId - New cover image of the shoot.
 * @return {Promise<boolean>} Successfully updated.
 */
Focus.setShootCoverImage = function(shootId, imageId) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			throw new TypeError("shootId expected string got " + (typeof shootId).toString());
		if (typeof imageId !== "string")
			throw new TypeError("imageId expected string got " + (typeof imageId).toString());

		Focus.sendRequest("put", `shoot/cover/${shootId}`, { imageId: imageId }).then((result) => {
			resolve(result.imageId == imageId);
		}).catch(reject);
	});
}

/**
 * Returns the permission object of the shoot
 * @param {string} shootId - Id of the shoot
 * @return {Promise<object>} Shoot permissions object
 */
Focus.getShootPermissions = function(shootId) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			throw new TypeError("shootId expected string got " + (typeof shootId).toString());

		Focus.sendRequest("get", `shoot/permissions/${shootId}`).then((response) => {
			resolve(response.permissions);
		}).catch(reject);
	});
}

/**
 * Sets the permissions of a shoot to what you've specified.
 * Owner will always have full permissions.
 * 
 * Permissions are in this style:
 * ```javascript
 * {
 * 	"usernmae": {
 * 		"*": "v" // View access to all images
 * 		"3e8eb3a1-1134-4ae9-a861-e7facb0ea689": "b" // Block access to this image
 * 	}
 * }
 * ```
 * Use `*` for "everyone" or "every image".
 * 
 * @param {string} shootId - Id of the shoot
 * @param {object} permissions - Object containing the permissions.
 * @return {Promise<object>} Server response
 */
Focus.setShootPermissions = function(shootId, permissions) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			throw new TypeError("shootId expected string got " + (typeof shootId).toString());
		if (typeof permissions !== "object")
			throw new TypeError("permissions expected object got " + (typeof permissions).toString());

		Focus.sendRequest("post", `shoot/permissions/${shootId}`, { permissions: permissions })
			.then(resolve)
			.catch(reject);
	});
}
/**
 * **Does not set permissions, only changes**.
 * Appends and updates the current permissions with the permissions you submit.
 * What this means is these permissions will be added, not set to this.
 * Use `.setShootPermissions()` to set the permissions of a shoot to whatever and to clear any permissions not specified by you.
 * 
 * Permissions are in this style:
 * ```javascript
 * {
 * 	"usernmae": {
 * 		"*": "v" // View access to all images
 * 		"3e8eb3a1-1134-4ae9-a861-e7facb0ea689": "b" // Block access to this image
 * 	}
 * }
 * ```
 * Use `*` for "everyone" or "every image".
 * 
 * @param {string} shootId - Id of the shoot
 * @param {object} permissions - Object containing the permissions.
 * @return {Promise<object>} Server response
 */
Focus.updateShootPermissions = function(shootId, permissions) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			throw new TypeError("shootId expected string got " + (typeof shootId).toString());
		if (typeof permissions !== "object")
			throw new TypeError("permissions expected object got " + (typeof permissions).toString());

		Focus.sendRequest("put", `shoot/permissions/${shootId}`, { permissions: permissions })
			.then(resolve)
			.catch(reject);
	});
}


/**
 * Returns the image ids for the shoot
 * @param {string} shootId - Id of the shoot
 * @return {Promise<string[]>} Images in the shoot
 */
Focus.getShootImages = function(shootId) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			throw new TypeError("shootId expected string got " + (typeof shootId).toString());

		Focus.sendRequest("get", `shoot/images/${shootId}`).then((response) => {
			resolve(response.images);
		}).catch(reject);
	});
}

/**
 * Returns the download link for this shoot
 * @param {string} shootId - Id of the shoot
 * @param {("original"|"high"|"medium"|"low"|"thumbnail")} [quality = "medium"] - The quality the image should be in.
 * @return {string}
 */
Focus.getShootDownloadUrl = function(shootId, quality) {
	if (typeof shootId !== "string")
		throw new TypeError("shootId expected string got " + (typeof shootId).toString());
	quality = Focus.getQualityFromString(quality);

	return Focus.APILocation + `shoot/download/${shootId}/${quality}`;
}




// Images
/**
 * Returns a FocusImage object for a given shoot and image id.
 * @param {string} shootId - The shoot id
 * @param {string} imageId - The image id
 * @return {FocusImage} Image
 */
Focus.getImage = function(shootId, imageId) {
	if (typeof shootId !== "string")
		throw new TypeError("shootId expected string got " + (typeof shootId).toString());

	let key = shootId + "-image_" + imageId;
	if (Focus.CachedImages == undefined) {
		Focus.CachedImages = {};
	}

	if (Focus.CachedImages[key] == undefined) {
		Focus.CachedImages[key] = new FocusImage(shootId, imageId);
	}

	return Focus.CachedImages[key];
}


/**
 * Returns the URL to an image.
 * @param {string} shootId - The shoot id
 * @param {string} imageId - The image id
 * @param {("original"|"high"|"medium"|"low"|"thumbnail")} [quality = "medium"] - The quality the image should be in.
 */
Focus.getImageUrl = function(shootId, imageId, quality) {
	if (typeof shootId !== "string")
		throw new TypeError("shootId expected string got " + (typeof shootId).toString());

	if (typeof quality === "string")
		return Focus.APILocation + `shoot/image/${shootId}/${imageId}/${quality}`;
	else
		return Focus.APILocation + `shoot/image/${shootId}/${imageId}`;
}

/**
 * Returns the URL to download an image.
 * @param {string} shootId - The shoot id
 * @param {string} imageId - The image id
 * @param {("original"|"high"|"medium"|"low"|"thumbnail")} [quality = "medium"] - The quality the image should be in.
 */
Focus.getImageDownloadUrl = function(shootId, imageId, quality) {
	if (typeof shootId !== "string")
		throw new TypeError("shootId expected string got " + (typeof shootId).toString());

	if (typeof quality === "string")
		return Focus.APILocation + `shoot/imageDownload/${shootId}/${imageId}/${quality}`;
	else
		return Focus.APILocation + `shoot/imageDownload/${shootId}/${imageId}`;
}

/**
 * Gets the friendly names for all images in a shoot
 * @param {string} shootId - Shoot to get the names for the images
 * @return {Promise<Map<string, string>>} A map of the image id to the image name.
 */
Focus.getImageNames = function(shootId) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			reject(new TypeError("shootId expected string got " + (typeof shootId).toString()));

		Focus.sendRequest("get", `shoot/imageName/${shootId}`).then((response) => {
			resolve(response.names);
		}).catch(reject);
	});
}

/**
 * Gets the friendly name for an image
 * @param {string} shootId - Shoot the image belongs to
 * @param {string} imageId - Id of the image
 * @return {Promise<string|Map<string, string>>} Friendly name of the image. If iamgeId is undefined or not a string, returns a map of image ids to names.
 */
Focus.getImageName = function(shootId, imageId) {
	return new Promise((resolve, reject) => {
		if (typeof shootId !== "string")
			reject(new TypeError("shootId expected string got " + (typeof shootId).toString()));
		if (typeof imageId !== "string")
			return Focus.getImageNames(shootId).then(resolve).catch(reject);

		Focus.sendRequest("get", `shoot/imageName/${shootId}/${imageId}`).then((response) => {
			resolve(response.name);
		}).catch(reject);
	});
}




class FocusImage {
	/**
	 * Id of the shoot this belongs to
	 * @type {string}
	 */
	shootId;

	/**
	 * Id of the image
	 * @type {string}
	 */
	id;

	/**
	 * Friendly name of the image
	 * @type {string}
	 */
	name;

	/**
	 * Entry HTML tag for the image.
	 * This is an image displayed when viewing a shoot.
	 * @type {Image}
	 */
	entryPhoto;

	/**
	 * Path to the image (without the quality option)
	 * @type {string}
	 */
	url;


	constructor(shootId, imageId) {
		this.shootId = shootId;
		this.id = imageId;

		let me = this;
		/*if (Focus.ReduceData) {
			this.name = "Image";
			// attempt to defer the name request until after the image loads
		}
		else
			Focus.getImageName(shootId, imageId).then((name) => { me.name = name; });
		*/
		this.url = Focus.getImageUrl(shootId, imageId);
	}

	/**
	 * Returns the entry display item, generating it if need be.
	 * @param {boolean} [regenerate = false] - Regenerate the image even if it already exists.
	 * @return {Image}
	 */
	async getEntryPhoto(regenerate) {
		if (regenerate === true || this.entryPhoto === undefined) {
			this.entryPhoto = new Image();
			if (Focus.ReduceData)
				this.entryPhoto.src = this.url + "/thumbnail";
			else 
				this.entryPhoto.src = this.url + "/low";
			this.entryPhoto.loading = "lazy";
			this.entryPhoto.className = "entry-photo--no-title";

			this.entryPhoto.id = this.id;
			this.entryPhoto.alt = this.name;
			if (this.name == undefined)
				this.entryPhoto.title = await Focus.getImageName(this.shootId, this.id);
			else
				this.entryPhoto.title = this.name;

			let me = this;
			this.entryPhoto.onclick = (event) => {
				console.log(`[Image] ${event.currentTarget.id} clicked, opening large view.`);
				Focus.displayImage(me);
			}
		}

		return this.entryPhoto;
	}

	/**
	 * Adds the entry photo to the container
	 */
	async addEntryPhoto(customLocation) {
		customLocation = (typeof customLocation === "string")? customLocation : "#shoot-container";
		var key = this.shootId + "-image_" + this.id;
		$(customLocation).append('<li id="' + key + '" class="entry"></li>');
		$("#" + key).append(await this.getEntryPhoto());
	}

	/**
	 * Returns the shoot thumbnail item, generating it if need be.
	 * Meant to be displayed on the main dashboard and opens the shoot.
	 * @return {Promise<string>} HTML
	 */
	async getShootEntryPhoto() {
		let title = "Loading...";
		let quality = "low";
		if (Focus.ReduceData) {
			setTimeout(async () => {
				title = await Focus.getShootTitle(this.shootId);
				$(`#shootTitle-${this.shootId}`).text(title);
			}, 500);
			quality = "thumbnail";
		} else {
			title = await Focus.getShootTitle(this.shootId);
			quality = "low";
		}

		return `<li id="${this.id}" class="entry" onclick="
	console.log(\`[Image] ${this.id} (shoot entry) clicked, opening ${this.shootId}\`);
	Focus.displayShoot('${this.shootId}');
">
	<div class="entry-photo" style="background-image: url('${this.url}/${quality}');"/>
	<div class="entry-title">
		<span id="shootTitle-${this.shootId}">${title}</span>
	</div>
</li>`;
	}

	/**
	 * Adds the shoot entry photo to the shoots-container
	 */
	addShootEntryPhoto(customLocation) {
		return new Promise(async (resolve, reject) => {
			let html = await this.getShootEntryPhoto();
			customLocation = (typeof customLocation === "string")? customLocation : "#shoots-container";
			$(customLocation).append(html);
			resolve();
		});
	}
}