const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + path.extname(file.originalname)); //Appending extension
    },
});

// Check File Type
function checkFileType(file) {
    // Allowed extensions
    const allowedExtensions = /jpeg|jpg|png|gif/;
    // Check extension
    const extname = allowedExtensions.test(
        path.extname(file.originalname).toLowerCase()
    );
    // Check mime
    const mimetype = allowedExtensions.test(file.mimetype);

    if (extname && mimetype) return true;
    return false;
}
module.exports = {
    upload: multer({ storage: storage }),
    checkFileType: checkFileType,
};
// module.exports = multer({ storage: storage });
// module.exports = checkFileType;
