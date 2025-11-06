-- Add table to store Azure Face API Person IDs
-- This maps our internal PersonID (from NameEvent) to Azure's Person IDs

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AzureFacePersons')
BEGIN
    CREATE TABLE AzureFacePersons (
        PersonID INT NOT NULL,  -- References NameEvent.ID
        AzurePersonID NVARCHAR(36) NOT NULL,  -- UUID from Azure Face API
        PersonGroupID NVARCHAR(50) NOT NULL DEFAULT 'family-album',
        CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        PRIMARY KEY (PersonID, PersonGroupID),
        FOREIGN KEY (PersonID) REFERENCES NameEvent(ID) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_AzureFacePersons_AzurePersonID ON AzureFacePersons(AzurePersonID);
    
    PRINT 'Created AzureFacePersons table';
END
GO
