const { execute } = require('../api/shared/db');

async function createApprovalTokensTable() {
    console.log('Creating ApprovalTokens table...\n');
    
    const createTableSQL = `
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApprovalTokens')
        BEGIN
            CREATE TABLE dbo.ApprovalTokens (
                ID INT IDENTITY(1,1) PRIMARY KEY,
                Token NVARCHAR(255) NOT NULL UNIQUE,
                UserID INT NOT NULL,
                Action NVARCHAR(50) NOT NULL CHECK (Action IN ('FullAccess', 'ReadOnly', 'Deny')),
                CreatedAt DATETIME2 DEFAULT GETDATE(),
                ExpiresAt DATETIME2 NOT NULL,
                UsedAt DATETIME2 NULL,
                UsedBy NVARCHAR(255) NULL,
                
                FOREIGN KEY (UserID) REFERENCES dbo.Users(ID) ON DELETE CASCADE,
                INDEX IX_ApprovalTokens_Token (Token),
                INDEX IX_ApprovalTokens_ExpiresAt (ExpiresAt)
            );
            
            PRINT 'ApprovalTokens table created successfully';
        END
        ELSE
        BEGIN
            PRINT 'ApprovalTokens table already exists';
        END
    `;
    
    try {
        await execute(createTableSQL);
        console.log('✅ ApprovalTokens table is ready!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating table:', error.message);
        process.exit(1);
    }
}

createApprovalTokensTable();
