# Simple migration script using sqlcmd
# Fill in your database details below:

$server = "YOUR-SERVER.database.windows.net"
$database = "YOUR-DATABASE-NAME"
$username = "YOUR-USERNAME"
$password = "YOUR-PASSWORD"

Write-Output "Connecting to: $server"
Write-Output "Database: $database"
Write-Output ""

$sql = @"
ALTER TABLE dbo.UnindexedFiles ADD uiMonth INT NULL;
ALTER TABLE dbo.UnindexedFiles ADD uiYear INT NULL;
SELECT 'Migration complete!' as Result;
"@

$sql | sqlcmd -S $server -d $database -U $username -P $password

if ($LASTEXITCODE -eq 0) {
    Write-Output ""
    Write-Output "SUCCESS! Date columns added to UnindexedFiles table"
} else {
    Write-Output ""
    Write-Output "ERROR: Migration failed with exit code $LASTEXITCODE"
}
