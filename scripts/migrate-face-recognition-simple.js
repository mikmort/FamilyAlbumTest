/**
 * Database Migration: Add Face Recognition Tables (Simplified)
 * Run this script to add the face recognition feature to your database
 * 
 * Usage:
 *   node scripts/migrate-face-recognition-simple.js
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

    // Create FaceEncodings table (without foreign keys first)
    console.log('📋 Step 1: Creating FaceEncodings table...');
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
            UpdatedDate DATETIME2 DEFAULT GETDATE()
        );
      END
    `);
    console.log('✅ FaceEncodings table created\n');

    // Create PersonEncodings table (without foreign keys first)
    console.log('📋 Step 2: Creating PersonEncodings table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PersonEncodings')
      BEGIN
        CREATE TABLE dbo.PersonEncodings (
            EncodingID INT IDENTITY(1,1) PRIMARY KEY,
            PersonID INT NOT NULL,
            AggregateEncoding VARBINARY(MAX) NOT NULL,
            EncodingCount INT DEFAULT 0,
            LastUpdated DATETIME2 DEFAULT GETDATE()
        );
      END
    `);
    console.log('✅ PersonEncodings table created\n');

    // Add foreign key constraints
    console.log('📋 Step 3: Adding foreign key constraints...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_FaceEncodings_Pictures')
      BEGIN
        ALTER TABLE dbo.FaceEncodings
        ADD CONSTRAINT FK_FaceEncodings_Pictures 
        FOREIGN KEY (PFileName) REFERENCES dbo.Pictures(PFileName);
      END
    `);
    console.log('✅ FK_FaceEncodings_Pictures added');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_FaceEncodings_People')
      BEGIN
        ALTER TABLE dbo.FaceEncodings
        ADD CONSTRAINT FK_FaceEncodings_People 
        FOREIGN KEY (PersonID) REFERENCES dbo.NameEvent(ID);
      END
    `);
    console.log('✅ FK_FaceEncodings_People added');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_PersonEncodings_People')
      BEGIN
        ALTER TABLE dbo.PersonEncodings
        ADD CONSTRAINT FK_PersonEncodings_People 
        FOREIGN KEY (PersonID) REFERENCES dbo.NameEvent(ID);
      END
    `);
    console.log('✅ FK_PersonEncodings_People added\n');

    // Add unique constraint
    console.log('📋 Step 4: Adding unique constraint...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_PersonEncodings_PersonID')
      BEGIN
        ALTER TABLE dbo.PersonEncodings
        ADD CONSTRAINT UQ_PersonEncodings_PersonID UNIQUE (PersonID);
      END
    `);
    console.log('✅ Unique constraint added\n');

    // Create indexes
    console.log('📋 Step 5: Creating indexes...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_FaceEncodings_PFileName')
      BEGIN
        CREATE INDEX IDX_FaceEncodings_PFileName ON dbo.FaceEncodings(PFileName);
      END
    `);
    console.log('✅ IDX_FaceEncodings_PFileName created');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_FaceEncodings_PersonID')
      BEGIN
        CREATE INDEX IDX_FaceEncodings_PersonID ON dbo.FaceEncodings(PersonID);
      END
    `);
    console.log('✅ IDX_FaceEncodings_PersonID created');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_FaceEncodings_IsConfirmed')
      BEGIN
        CREATE INDEX IDX_FaceEncodings_IsConfirmed ON dbo.FaceEncodings(IsConfirmed, PersonID);
      END
    `);
    console.log('✅ IDX_FaceEncodings_IsConfirmed created\n');

    // Create view
    console.log('📋 Step 6: Creating vw_FaceDetectionStats view...');
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_FaceDetectionStats')
      BEGIN
        DROP VIEW dbo.vw_FaceDetectionStats;
      END
    `);
    await pool.request().query(`
      CREATE VIEW dbo.vw_FaceDetectionStats AS
      SELECT 
          p.PFileName,
          p.PDescription,
          p.PDateEntered as PDate,
          COUNT(f.FaceID) as TotalFaces,
          SUM(CASE WHEN f.PersonID IS NOT NULL AND f.IsConfirmed = 1 THEN 1 ELSE 0 END) as ConfirmedFaces,
          SUM(CASE WHEN f.PersonID IS NOT NULL AND f.IsConfirmed = 0 THEN 1 ELSE 0 END) as SuggestedFaces,
          SUM(CASE WHEN f.PersonID IS NULL THEN 1 ELSE 0 END) as UnidentifiedFaces
      FROM dbo.Pictures p
      LEFT JOIN dbo.FaceEncodings f ON p.PFileName = f.PFileName
      GROUP BY p.PFileName, p.PDescription, p.PDateEntered
    `);
    console.log('✅ View created\n');

    // Create stored procedures
    console.log('📋 Step 7: Creating stored procedures...');
    
    // sp_ConfirmFaceMatch
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_ConfirmFaceMatch')
      BEGIN
        DROP PROCEDURE dbo.sp_ConfirmFaceMatch;
      END
    `);
    await pool.request().query(`
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
          DECLARE @PFileName NVARCHAR(500);
          SELECT @PFileName = PFileName FROM dbo.FaceEncodings WHERE FaceID = @FaceID;
          
          IF NOT EXISTS (SELECT 1 FROM dbo.NamePhoto WHERE npID = @PersonID AND npFileName = @PFileName)
          BEGIN
              INSERT INTO dbo.NamePhoto (npID, npFileName)
              VALUES (@PersonID, @PFileName);
          END
          
          -- Update pNameCount in Pictures table
          UPDATE dbo.Pictures
          SET pNameCount = (
              SELECT COUNT(DISTINCT npID)
              FROM dbo.NamePhoto
              WHERE npFileName = @PFileName
          )
          WHERE PFileName = @PFileName;
          
          COMMIT TRANSACTION;
      END
    `);
    console.log('✅ sp_ConfirmFaceMatch created');

    // sp_RejectFaceMatch
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_RejectFaceMatch')
      BEGIN
        DROP PROCEDURE dbo.sp_RejectFaceMatch;
      END
    `);
    await pool.request().query(`
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
    `);
    console.log('✅ sp_RejectFaceMatch created');

    // sp_GetFacesForReview
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetFacesForReview')
      BEGIN
        DROP PROCEDURE dbo.sp_GetFacesForReview;
      END
    `);
    await pool.request().query(`
      CREATE PROCEDURE dbo.sp_GetFacesForReview
          @Limit INT = 50
      AS
      BEGIN
          SET NOCOUNT ON;
          
          SELECT TOP (@Limit)
              f.FaceID,
              f.PFileName,
              f.PersonID,
              ne.neName as SuggestedPersonName,
              f.BoundingBox,
              f.Confidence,
              f.Distance,
              f.CreatedDate
          FROM dbo.FaceEncodings f
          LEFT JOIN dbo.NameEvent ne ON f.PersonID = ne.ID
          WHERE f.IsConfirmed = 0 
              AND f.IsRejected = 0
              AND f.PersonID IS NOT NULL
          ORDER BY f.Confidence DESC, f.CreatedDate DESC;
      END
    `);
    console.log('✅ sp_GetFacesForReview created\n');

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   - FaceEncodings table created');
    console.log('   - PersonEncodings table created');
    console.log('   - 3 foreign key constraints added');
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
