const { execSync } = require('child_process');

try {
  execSync('which func', { stdio: 'pipe' });
  process.exit(0); // func is available
} catch (error) {
  process.exit(1); // func is not available
}
