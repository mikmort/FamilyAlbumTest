/**
 * Database Migration: Add Face Recognition Tables
 * Run this script to add the face recognition feature to your database
 * 
 * Usage:
 *   node scripts/migrate-face-recognition.js
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function migrate() {
  console.log('🔄 Starting face recognition database migration...\n');

  let pool;
  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Connected successfully\n');

    // Check if tables already exist
    console.log('🔍 Checking if migration is needed...');
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'FaceEncodings'
    `;
    const checkResult = await pool.request().query(checkQuery);
    
    if (checkResult.recordset[0].count > 0) {
      console.log('⚠️  FaceEncodings table already exists. Migration may have been run before.');
      console.log('   Continuing anyway to ensure all objects are created...\n');
    }

    // Create FaceEncodings table
    console.log('📋 Creating FaceEncodings table...');
    try {
      await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FaceEncodings')
      BEGIN
        CREATE TABLE dbo.FaceEncodings (
            FaceID INT IDENTITY(1,1) PRIMARY KEY,
            PFileName NVARCHAR(500) NOT NULL,
            PersonID INT NULL,
            Encoding VARBINARY(MAX) NOT NULL,
            BoundingBox NVARCHAR(MAX) NULL,
            Confidence FLOAT NULL,
            Distance FLOAT NULL,
            IsConfirmed BIT DEFAULT 0,
            IsRejected BIT DEFAULT 0,
            CreatedDate DATETIME2 DEFAULT GETDATE(),
            UpdatedDate DATETIME2 DEFAULT GETDATE(),
            
            CONSTRAINT FK_FaceEncodings_Pictures FOREIGN KEY (PFileName) 
                REFERENCES dbo.Pictures(PFileName) ON DELETE CASCADE,
            CONSTRAINT FK_FaceEncodings_People FOREIGN KEY (PersonID) 
                REFERENCES dbo.NameEvent(NameID) ON DELETE SET NULL
        );
        PRINT 'Created FaceEncodings table';
      END
      ELSE
      BEGIN
        PRINT 'FaceEncodings table already exists';
      END
    `);
    console.log('✅ FaceEncodings table ready\n');

    // Create indexes for FaceEncodings
    console.log('📋 Creating indexes on FaceEncodings...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_FaceEncodings_PFileName')
      BEGIN
        CREATE INDEX IDX_FaceEncodings_PFileName ON dbo.FaceEncodings(PFileName);
        PRINT 'Created index IDX_FaceEncodings_PFileName';
      END
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_FaceEncodings_PersonID')
      BEGIN
        CREATE INDEX IDX_FaceEncodings_PersonID ON dbo.FaceEncodings(PersonID);
        PRINT 'Created index IDX_FaceEncodings_PersonID';
      END
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_FaceEncodings_IsConfirmed')
      BEGIN
        CREATE INDEX IDX_FaceEncodings_IsConfirmed ON dbo.FaceEncodings(IsConfirmed, PersonID);
        PRINT 'Created index IDX_FaceEncodings_IsConfirmed';
      END
    `);
    console.log('✅ Indexes created\n');

    // Create PersonEncodings table
    console.log('📋 Creating PersonEncodings table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PersonEncodings')
      BEGIN
        CREATE TABLE dbo.PersonEncodings (
            EncodingID INT IDENTITY(1,1) PRIMARY KEY,
            PersonID INT NOT NULL,
            AggregateEncoding VARBINARY(MAX) NOT NULL,
            EncodingCount INT DEFAULT 0,
            LastUpdated DATETIME2 DEFAULT GETDATE(),
            
            CONSTRAINT FK_PersonEncodings_People FOREIGN KEY (PersonID) 
                REFERENCES dbo.NameEvent(NameID) ON DELETE CASCADE,
            CONSTRAINT UQ_PersonEncodings_PersonID UNIQUE (PersonID)
        );
        PRINT 'Created PersonEncodings table';
      END
      ELSE
      BEGIN
        PRINT 'PersonEncodings table already exists';
      END
    `);
    console.log('✅ PersonEncodings table ready\n');

    // Create view
    console.log('📋 Creating vw_FaceDetectionStats view...');
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_FaceDetectionStats')
      BEGIN
        DROP VIEW dbo.vw_FaceDetectionStats;
      END
      
      EXEC('
        CREATE VIEW dbo.vw_FaceDetectionStats AS
        SELECT 
            p.PFileName,
            p.PDescription,
            p.PDate,
            COUNT(f.FaceID) as TotalFaces,
            SUM(CASE WHEN f.PersonID IS NOT NULL AND f.IsConfirmed = 1 THEN 1 ELSE 0 END) as ConfirmedFaces,
            SUM(CASE WHEN f.PersonID IS NOT NULL AND f.IsConfirmed = 0 THEN 1 ELSE 0 END) as SuggestedFaces,
            SUM(CASE WHEN f.PersonID IS NULL THEN 1 ELSE 0 END) as UnidentifiedFaces
        FROM dbo.Pictures p
        LEFT JOIN dbo.FaceEncodings f ON p.PFileName = f.PFileName
        GROUP BY p.PFileName, p.PDescription, p.PDate
      ');
      PRINT 'Created view vw_FaceDetectionStats';
    `);
    console.log('✅ View created\n');

    // Create stored procedures
    console.log('📋 Creating stored procedures...');
    
    // sp_ConfirmFaceMatch
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_ConfirmFaceMatch')
      BEGIN
        DROP PROCEDURE dbo.sp_ConfirmFaceMatch;
      END
      
      EXEC('
        CREATE PROCEDURE dbo.sp_ConfirmFaceMatch
            @FaceID INT,
            @PersonID INT
        AS
        BEGIN
            SET NOCOUNT ON;
            
            BEGIN TRANSACTION;
            
            -- Update the face encoding
            UPDATE dbo.FaceEncodings
            SET PersonID = @PersonID,
                IsConfirmed = 1,
                IsRejected = 0,
                UpdatedDate = GETDATE()
            WHERE FaceID = @FaceID;
            
            -- Add to NamePhoto if not already exists
            DECLARE @PFileName NVARCHAR(255);
            SELECT @PFileName = PFileName FROM dbo.FaceEncodings WHERE FaceID = @FaceID;
            
            IF NOT EXISTS (SELECT 1 FROM dbo.NamePhoto WHERE NameID = @PersonID AND PFileName = @PFileName)
            BEGIN
                INSERT INTO dbo.NamePhoto (NameID, PFileName)
                VALUES (@PersonID, @PFileName);
            END
            
            -- Update pNameCount in Pictures table
            UPDATE dbo.Pictures
            SET pNameCount = (
                SELECT COUNT(DISTINCT NameID)
                FROM dbo.NamePhoto
                WHERE PFileName = @PFileName
            )
            WHERE PFileName = @PFileName;
            
            COMMIT TRANSACTION;
        END
      ');
      PRINT 'Created procedure sp_ConfirmFaceMatch';
    `);

    // sp_RejectFaceMatch
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_RejectFaceMatch')
      BEGIN
        DROP PROCEDURE dbo.sp_RejectFaceMatch;
      END
      
      EXEC('
        CREATE PROCEDURE dbo.sp_RejectFaceMatch
            @FaceID INT
        AS
        BEGIN
            SET NOCOUNT ON;
            
            UPDATE dbo.FaceEncodings
            SET PersonID = NULL,
                IsConfirmed = 0,
                IsRejected = 1,
                UpdatedDate = GETDATE()
            WHERE FaceID = @FaceID;
        END
      ');
      PRINT 'Created procedure sp_RejectFaceMatch';
    `);

    // sp_GetFacesForReview
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetFacesForReview')
      BEGIN
        DROP PROCEDURE dbo.sp_GetFacesForReview;
      END
      
      EXEC('
        CREATE PROCEDURE dbo.sp_GetFacesForReview
            @Limit INT = 50
        AS
        BEGIN
            SET NOCOUNT ON;
            
            SELECT TOP (@Limit)
                f.FaceID,
                f.PFileName,
                f.PersonID,
                ne.NName as SuggestedPersonName,
                f.BoundingBox,
                f.Confidence,
                f.Distance,
                f.CreatedDate
            FROM dbo.FaceEncodings f
            LEFT JOIN dbo.NameEvent ne ON f.PersonID = ne.NameID
            WHERE f.IsConfirmed = 0 
                AND f.IsRejected = 0
                AND f.PersonID IS NOT NULL
            ORDER BY f.Confidence DESC, f.CreatedDate DESC;
        END
      ');
      PRINT 'Created procedure sp_GetFacesForReview';
    `);
    
    console.log('✅ Stored procedures created\n');

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   - FaceEncodings table created');
    console.log('   - PersonEncodings table created');
    console.log('   - 3 indexes created');
    console.log('   - 1 view created');
    console.log('   - 3 stored procedures created\n');
    console.log('🎉 Face recognition database setup is complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n📡 Database connection closed');
    }
  }
}

// Run migration
migrate().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
