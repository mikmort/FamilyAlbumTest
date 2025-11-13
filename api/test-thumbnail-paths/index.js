const { blobExists } = require('../shared/storage');

/**
 * Azure Function: Test Thumbnail Path Resolution
 * 
 * Diagnostic endpoint to test different blob path variations
 * GET /api/test-thumbnail-paths?path=<urlEncodedPath>
 */
module.exports = async function (context, req) {
    context.log('Test thumbnail paths endpoint called');
    
    const testPath = req.query.path;
    
    if (!testPath) {
        context.res = {
            status: 400,
            body: { error: 'Missing path query parameter' }
        };
        return;
    }
    
    // Decode the path
    const decodedPath = decodeURIComponent(testPath);
    context.log(`Testing path: ${decodedPath}`);
    
    // Try all the variations that the media endpoint tries
    const pathsToTry = [
        decodedPath,
        `media/${decodedPath}`,
    ];
    
    // Split path into directory and filename
    const pathParts = decodedPath.split('/');
    const directory = pathParts.slice(0, -1).join('/');
    const filenamePart = pathParts[pathParts.length - 1];
    
    // Try with spaces encoded in directory
    if (directory && directory.includes(' ')) {
        const dirWithEncodedSpaces = directory.replace(/ /g, '%20');
        const pathWithEncodedDirSpaces = dirWithEncodedSpaces + '/' + filenamePart;
        if (!pathsToTry.includes(pathWithEncodedDirSpaces)) {
            pathsToTry.push(pathWithEncodedDirSpaces);
        }
    }
    
    // Try with entire path encoded
    const fullyEncodedPath = pathParts.map(part => 
        encodeURIComponent(part).replace(/'/g, '%27')
    ).join('/');
    if (fullyEncodedPath !== decodedPath) {
        pathsToTry.push(fullyEncodedPath);
    }
    
    // Try with spaces encoded only in filename
    if (filenamePart.includes(' ') && !filenamePart.includes('%20')) {
        const spacesEncoded = directory + (directory ? '/' : '') + filenamePart.replace(/ /g, '%20');
        pathsToTry.push(spacesEncoded);
    }
    
    // Try with full encoding in filename only
    const fullyEncoded = directory + (directory ? '/' : '') + 
        encodeURIComponent(filenamePart)
            .replace(/%2F/g, '/')
            .replace(/'/g, '%27');
    if (fullyEncoded !== decodedPath && !pathsToTry.includes(fullyEncoded)) {
        pathsToTry.push(fullyEncoded);
    }
    
    // Test each variation
    const results = [];
    for (const tryPath of pathsToTry) {
        let exists = false;
        let error = null;
        
        try {
            exists = await blobExists(tryPath);
        } catch (err) {
            error = err.message;
        }
        
        results.push({
            path: tryPath,
            exists,
            error
        });
    }
    
    context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
            original: testPath,
            decoded: decodedPath,
            results
        }
    };
};
