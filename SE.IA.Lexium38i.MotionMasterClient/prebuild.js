/** ***********************************/
/*  Copyright Schneider Electric 2021 */
/** ***********************************/
const fs = require('fs');

// eslint-disable-next-line no-undef

createFolder('./dist');

function createFolder(path) {
    if (fs.existsSync(path)) {
        fs.rmdirSync(path, { recursive: true });
    }
    fs.mkdirSync(path);
}