var fs = require('fs');
var nodePath = require('path');

var tempDir = nodePath.join(__dirname, 'temp');

function copyFiles(dir) {
    var files = fs.readdirSync(dir);
    files.forEach((file) => {
        var src = fs.readFileSync(nodePath.join(dir, file));
        fs.writeFileSync(nodePath.join(tempDir, file), src);
    });
}

exports.check = function(marko, hotReload, expect) {
    try {
        fs.mkdirSync(nodePath.join(__dirname, 'temp'));
    } catch(e) {}

    var tempTemplatePath = nodePath.join(__dirname, 'temp/index.marko');

    copyFiles(nodePath.join(__dirname, 'a'));
    var component = require(tempTemplatePath);
    expect(component.renderSync().toString()).to.contain('<div class="a">Hello Frank</div>');

    hotReload.handleFileModified(tempTemplatePath);

    copyFiles(nodePath.join(__dirname, 'b'));
    expect(component.renderSync().toString()).to.contain('<div class="b">Hello Frank</div>');
};
