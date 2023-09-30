/**
	
	Project Focus

		Shoot abstraction class

*/

/**
 * Represents the local "copy" of a shoot
 */
class Shoot {
	/**
	 * The id of the shoot (UUID)
	 * @type {string} 
	 */
	id = "00000000-0000-0000-0000-000000000000";

	/**
	 * Friendly name of the shoot (album), such as "Oliver the cat!"
	 * @type {string}
	 */
	title;


	/**
	 * Description of the shoot.
	 * @type {string} 
	 */
	description;

	/**
	 * User's username that owns this shoot (full permissions).
	 * @type {string}
	 */
	owner;


	/**
	 * @typedef {Map<string, string> imagePermission
	 * Image name: permission
	 * Permission is as follows:
	 * ```
	 *  -------
	 *  f------: full permissions (everything)
	 *  -d-----: download permissions (download the shoot, requires view)
	 *  --v----: view permissions (view the shoot)
	 *  ---r---: remove permissions (remove an image from the shoot)
	 *  ----s--: share permissions (set permissions for others)
	 *  -----e-: edit the image (name/description)
	 * ```
	 */

	/**
	 * User permissions for the shoot.
	 * @type {Map<string, imagePermission>}
	 */
	permissions;

	/**
	 * List of image ids contained in this shoot
	 * @type {string[]}
	 */
	images;

	/**
	 * The main image to display as the cover for this shoot
	 * @type {string}
	 */
	coverImage;


	/**
	 * A map of image ids to the image friendly name
	 * @type {Map<string, string>}
	 */
	imageNames = new Map();


	constructor(id) {
		this.id = id;
		//this.getTitle();

		// if (!Focus.ReduceData) {
		// 	this.getDescription();
		// 	this.getOwner();
		// 	this.getCoverImage();
		// }
	}

	/**
	 * Deletes the shoot.
	 * Confirmation code is required from `Focus.getConfirmationCode()` and requires the current user's password.
	 * 
	 * Wrapper for `Focus.deleteShoot`.
	 * @param {string} confirmationCode - Authentication code.
	 * @return {Promise<object>} Server response
	 */
	deleteShoot(confirmationCode) {
		return Focus.deleteShoot(this.id, confirmationCode);
	}

	// Title
	/**
	 * Returns the title of the shoot.
	 * Wrapper for `Focus.getShootTitle()`.
	 * @param {boolean} [useCache=false] - If true, returns the value from the class's property (and retrieves it from the server if that is undefined).
	 * @return {Promise<string>} Title of the shoot
	 */
	getTitle(useCache) {
		return new Promise(async (resolve, reject) => {
			if (useCache === true && typeof this.title === "string")
				return resolve(this.title);

			Focus.getShootTitle(this.id).then((title) => {
				this.title = title;
				resolve(title);
			}).catch(reject);
		});
	}
	/**
	 * Sets the title of the shoot
	 * @param {string} name - New title/name of the shoot. Must be between 1 and 255 characters.
	 * @return {Promise<boolean>} Successfully updated.
	 */
	setTitle(name) {
		return new Promise((resolve, reject) => {
			Focus.setShootTitle(this.id, name).then((successful) => {
				if (successful)
					this.title = name;
				resolve(successful);
			}).catch(reject);
		});
	}


	// Description
	/**
	 * Returns the description of the shoot.
	 * Wrapper for `Focus.getShootDescription()`.
	 * @param {boolean} [useCache=false] - If true, returns the value from the class's property (and retrieves it from the server if that is undefined).
	 * @return {Promise<string>} Description of the shoot
	 */
	getDescription(useCache) {
		return new Promise((resolve, reject) => {
			if (useCache === true && typeof this.description === "string")
				return resolve(this.description);

			Focus.getShootDescription(this.id).then((description) => {
				this.description = description;
				resolve(description);
			}).catch(reject);
		});
	}
	/**
	 * Sets the description of the shoot.
	 * Wrapper of `Focus.setShootDescription()`.
	 * @param {string} description - New description of the shoot. Must be under 1000 characters.
	 * @return {Promise<boolean>} Successfully updated.
	 */
	setDescription(description) {
		return new Promise((resolve, reject) => {
			Focus.setShootDescription(this.id, description).then((successful) => {
				if (successful)
					this.description = description;
				resolve(successful);
			}).catch(reject);
		});
	}


	// Owner
	/**
	 * Returns the owner's username of the shoot.
	 * Wrapper of `Focus.getShootOwner()`.
	 * @param {boolean} [useCache=false] - If true, returns the value from the class's property (and retrieves it from the server if that is undefined).
	 * @return {Promise<string>} Owner of the shoot
	 */
	getOwner(useCache) {
		return new Promise((resolve, reject) => {
			if (useCache === true && typeof this.owner === "string")
				return resolve(this.owner);
			
			Focus.getShootOwner(this.id).then((owner) => {
				this.owner = owner;
				resolve(owner);
			}).catch(reject);
		});
	}


	// Cover image
	/**
	 * Gets the cover image id of this shoot.
	 * Wrapper of `Focus.getShootCoverImage()`.
	 * @param {boolean} [useCache=false] - If true, returns the value from the class's property (and retrieves it from the server if that is undefined).
	 * @return {Promise<string>} Image id for the cover of this shoot.
	 */
	getCoverImage(useCache) {
		return new Promise((resolve, reject) => {
			if (useCache === true && typeof this.coverImage === "string")
				return resolve(this.coverImage);
			
			Focus.getShootCoverImage(this.id).then((coverImage) => {
				this.coverImage = coverImage;
				resolve(coverImage);
			}).catch(reject);
		});
	}

	/**
	 * Sets the cover image of the shoot.
	 * Wrapper of `Focus.setShootCoverImage()`.
	 * @param {string} imageId - New cover image of this shoot.
	 * @return {Promise<boolean>} Successfully updated.
	 */
	setCoverImage(imageId) {
		return new Promise((resolve, reject) => {
			Focus.setShootCoverImage(this.id, imageId).then((successful) => {
				if (successful)
					this.coverImage = imageId;
				resolve(successful);
			}).catch(reject);
		});
	}


	/**
	 * Returns the (zip) download link for this shoot.
	 * Wrapper of `Focus.getShootDownloadUrl()`.
	 * @param {("original"|"high"|"medium"|"low"|"thumbnail")} [quality="high"] - The quality the images should be in.
	 * @return {string}
	 */
	getDownloadUrl() {
		return Focus.getShootDownloadUrl(this.id);
	}


	// Permissions
	/**
	 * Returns the permissions object of the shoot. Cache use highly discouraged, and therefore is not supported here.
	 * Wrapper of `Focus.getShootPermissions`.
	 * @return {Promise<Map<string, imagePermission>}
	 */
	getShootPermissions() {
		return new Promise((resolve, reject) => {
			Focus.getShootPermissions(this.id).then((permissions) => {
				this.permissions = permissions; // this is used for modifying permissions!
				resolve(permissions);
			}).catch(reject);
		});
	}
	/**
	 * Sets the current permissions of the shoot on the server to those in this class.
	 * Wrapper of `Focus.setShootPermissions()`. This will override permissions, so be careful.
	 * @return {Promise<object>} Server response (too lazy to write it out).
	 */
	setShootPermissions() {
		return Focus.setShootPermissions(this.shootId, this.permissions);
	}


	// Images
	/**
	 * Returns a FocusImage object for the image id.
	 * Wrapper of `Focus.getImage()`.
	 * @param {string} imageId - The image to get.
	 * @return {FocusImage} Image
	 */
	getImage(imageId) {
		return Focus.getImage(this.id, imageId);
	}

	/**
	 * Returns the image ids for the shoot.
	 * Wrapper of `Focus.getShootImages()`.
	 * @param {boolean} [useCache=false] - If true, returns the value from the class's property (and retrieves it from the server if that is undefined).
	 * @return {Promise<string[]>} Images in the shoot
	 */
	getImages(useCache) {
		return new Promise((resolve, reject) => {
			if (useCache === true && typeof this.coverImage === "string")
				return resolve(this.coverImage);

			Focus.getShootImages(this.id).then((images) => {
				this.images = images;
				resolve(images);
			}).catch(reject);
		});
	}

	/**
	 * Gets the name of one or more images.
	 * Wrapper of `Focus.getImageName()`.
	 * @param {string} [imageId] - Image id to get the name of. If undefined, returns a map of all image ids to image names.
	 * @param {boolean} [useCache=false] - If true, returns the value from the class's property (and retrieves it from the server if that is undefined).
	 * @return {Promise<string|Map<string, string>>} Either the friendly name of an image, or a map of all image friendly names.
	 */
	getImageName(imageId, useCache) {
		if (typeof imageId !== "string") { // one or all?
			return new Promise((resolve, reject) => {
				if (useCache === true && this.imageNames != undefined)
					return resolve(this.imageNames);

			// request
				Focus.getImageNames(this.id).then((names) => {
					this.imageNames = names;
					resolve(names);
				}).catch(reject);
			});
		} else {
			return new Promise((resolve, reject) => {
				if (useCache === true && this.imageNames.has(imageId))
					return resolve(this.imageNames.get(imageId));

			// request
				Focus.getImageName(this.id, imageId).then((name) => {
					if (!(name instanceof Map))
						this.imageNames.set(imageId, name);
					resolve(name);
				}).catch(reject);
			});
		}
	}

	/**
	 * Uploads a `File` or `FileList` to this shoot.
	 * Wrapper for `Focus.uploadImage()`
	 * @param {File|FileList} image - Image file(s) to upload.
	 * @return {Promise<Map<string, string>>} A map of the original image name and the new image id.
	 */
	uploadImage(image) {
		return Focus.uploadImage(this.id, image);
	}

	/**
	 * Opens the browser's file dialog for the user to select images to upload.
	 * Wrapper for `Focus.selectImagesForUpload()`
	 * @return {Promise<Map<string, string>>} Response from `uploadImage()`, a map of the original image name to the new image id.
	 */
	uploadImageUsingFileDialog() {
		return Focus.selectImagesForUpload(this.id);
	}
}