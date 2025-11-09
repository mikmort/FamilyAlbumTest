Connected to database

=== DATABASE SCHEMA ===


Table: ApprovalTokens
============================================================
  ID                             int           NOT NULL
  Token                          nvarchar(255)      NOT NULL
  UserID                         int           NOT NULL
  Action                         nvarchar(50)       NOT NULL
  CreatedAt                      datetime2           NULL DEFAULT (getdate())
  ExpiresAt                      datetime2           NOT NULL
  UsedAt                         datetime2           NULL
  UsedBy                         nvarchar(255)      NULL

  Indexes:
    IX_ApprovalTokens_ExpiresAt: ExpiresAt (NONCLUSTERED)
    IX_ApprovalTokens_Token: Token (NONCLUSTERED)
    UQ__Approval__1EB4F817A4495BC0: Token (NONCLUSTERED)

  Foreign Keys:
    FK__ApprovalT__UserI__3F115E1A: UserID -> Users(ID)

Table: AzureFacePersons
============================================================
  PersonID                       int           NOT NULL
  AzurePersonID                  nvarchar(36)       NOT NULL
  PersonGroupID                  nvarchar(50)       NOT NULL DEFAULT ('family-album')
  CreatedDate                    datetime2           NOT NULL DEFAULT (getdate())
  UpdatedDate                    datetime2           NOT NULL DEFAULT (getdate())

  Indexes:
    IX_AzureFacePersons_AzurePersonID: AzurePersonID (NONCLUSTERED)

  Foreign Keys:
    FK__AzureFace__Perso__0B5CAFEA: PersonID -> NameEvent(ID)

Table: FaceEmbeddings
============================================================
  ID                             int           NOT NULL
  PersonID                       int           NOT NULL
  PhotoFileName                  nvarchar(500)      NOT NULL
  Embedding                      nvarchar(MAX)      NOT NULL
  CreatedDate                    datetime2           NOT NULL DEFAULT (getdate())
  UpdatedDate                    datetime2           NOT NULL DEFAULT (getdate())

  Indexes:
    IX_FaceEmbeddings_PersonID: PersonID (NONCLUSTERED)
    IX_FaceEmbeddings_PhotoFileName: PhotoFileName (NONCLUSTERED)

  Foreign Keys:
    FK_FaceEmbeddings_Person: PersonID -> NameEvent(ID)
    FK_FaceEmbeddings_Photo: PhotoFileName -> Pictures(PFileName)

Table: FaceEncodings
============================================================
  FaceID                         int           NOT NULL
  PFileName                      nvarchar(500)      NOT NULL
  PersonID                       int           NULL
  Encoding                       varbinary(MAX)      NOT NULL
  BoundingBox                    nvarchar(MAX)      NULL
  Confidence                     float           NULL
  Distance                       float           NULL
  IsConfirmed                    bit           NULL DEFAULT ((0))
  IsRejected                     bit           NULL DEFAULT ((0))
  CreatedDate                    datetime2           NULL DEFAULT (getdate())
  UpdatedDate                    datetime2           NULL DEFAULT (getdate())

  Indexes:
    IDX_FaceEncodings_IsConfirmed: IsConfirmed, PersonID (NONCLUSTERED)
    IDX_FaceEncodings_PersonID: PersonID (NONCLUSTERED)
    IDX_FaceEncodings_PFileName: PFileName (NONCLUSTERED)

  Foreign Keys:
    FK_FaceEncodings_People: PersonID -> NameEvent(ID)
    FK_FaceEncodings_Pictures: PFileName -> Pictures(PFileName)

Table: FaceTrainingPhotoProgress
============================================================
  ID                             int           NOT NULL
  SessionID                      int           NOT NULL
  PersonID                       int           NOT NULL
  PersonName                     nvarchar(100)      NOT NULL
  PFileName                      varchar(255)      NOT NULL
  ProcessedAt                    datetime2           NOT NULL DEFAULT (getdate())
  Success                        bit           NOT NULL
  ErrorMessage                   nvarchar(MAX)      NULL

  Indexes:
    IX_FaceTrainingPhotoProgress_Session: SessionID, PersonID (NONCLUSTERED)

  Foreign Keys:
    FK__FaceTrain__Sessi__382F5661: SessionID -> FaceTrainingProgress(SessionID)

Table: FaceTrainingProgress
============================================================
  SessionID                      int           NOT NULL
  StartedAt                      datetime2           NOT NULL DEFAULT (getdate())
  CompletedAt                    datetime2           NULL
  Status                         varchar(20)       NOT NULL DEFAULT ('InProgress')
  TrainingType                   varchar(20)       NOT NULL
  TotalPersons                   int           NOT NULL DEFAULT ((0))
  ProcessedPersons               int           NOT NULL DEFAULT ((0))
  TotalPhotos                    int           NOT NULL DEFAULT ((0))
  ProcessedPhotos                int           NOT NULL DEFAULT ((0))
  SuccessfulFaces                int           NOT NULL DEFAULT ((0))
  FailedFaces                    int           NOT NULL DEFAULT ((0))
  MaxPerPerson                   int           NULL
  LastProcessedPerson            int           NULL
  LastProcessedPhoto             varchar(255)      NULL
  ErrorMessage                   nvarchar(MAX)      NULL
  UpdatedAt                      datetime2           NOT NULL DEFAULT (getdate())

  Indexes:
    IX_FaceTrainingProgress_StartedAt: StartedAt (NONCLUSTERED)
    IX_FaceTrainingProgress_Status: Status (NONCLUSTERED)

Table: NameEvent
============================================================
  ID                             int           NOT NULL
  neName                         nvarchar(255)      NOT NULL
  neRelation                     nvarchar(500)      NULL
  neType                         char(1)        NOT NULL
  neDateLastModified             datetime2           NULL DEFAULT (getdate())
  neCount                        int           NULL DEFAULT ((0))

  Indexes:
    IX_NameEvent_Name: neName (NONCLUSTERED)
    IX_NameEvent_Type: neType (NONCLUSTERED)

Table: NamePhoto
============================================================
  npID                           int           NOT NULL
  npFileName                     nvarchar(500)      NOT NULL
  npPosition                     int           NULL DEFAULT ((0))

  Indexes:
    IX_NamePhoto_FileName: npFileName (NONCLUSTERED)
    IX_NamePhoto_ID: npID (NONCLUSTERED)

  Foreign Keys:
    FK__NamePhoto__npID__7F2BE32F: npID -> NameEvent(ID)
    FK__NamePhoto__npFil__00200768: npFileName -> Pictures(PFileName)

Table: PersonEncodings
============================================================
  EncodingID                     int           NOT NULL
  PersonID                       int           NOT NULL
  AggregateEncoding              varbinary(MAX)      NOT NULL
  EncodingCount                  int           NULL DEFAULT ((0))
  LastUpdated                    datetime2           NULL DEFAULT (getdate())

  Indexes:
    UQ_PersonEncodings_PersonID: PersonID (NONCLUSTERED)

  Foreign Keys:
    FK_PersonEncodings_People: PersonID -> NameEvent(ID)

Table: Pictures
============================================================
  PFileName                      nvarchar(500)      NOT NULL
  PFileDirectory                 nvarchar(1000)     NULL
  PDescription                   nvarchar(MAX)      NULL
  PHeight                        int           NULL
  PWidth                         int           NULL
  PMonth                         int           NULL
  PYear                          int           NULL
  PPeopleList                    nvarchar(MAX)      NULL
  PNameCount                     int           NULL DEFAULT ((0))
  PThumbnailUrl                  nvarchar(1000)     NULL
  PType                          int           NOT NULL
  PTime                          int           NULL DEFAULT ((0))
  PDateEntered                   datetime2           NULL DEFAULT (getdate())
  PLastModifiedDate              datetime2           NULL DEFAULT (getdate())
  PReviewed                      bit           NULL DEFAULT ((0))
  PSoundFile                     nvarchar(500)      NULL
  PBlobUrl                       nvarchar(1000)     NULL

  Indexes:
    IX_Pictures_DateEntered: PDateEntered (NONCLUSTERED)
    IX_Pictures_Type: PType (NONCLUSTERED)
    IX_Pictures_YearMonth: PYear, PMonth (NONCLUSTERED)

Table: UnindexedFiles
============================================================
  uiID                           int           NOT NULL
  uiFileName                     nvarchar(1000)     NOT NULL
  uiDirectory                    nvarchar(1000)     NULL
  uiThumbUrl                     nvarchar(1000)     NULL
  uiType                         int           NOT NULL
  uiWidth                        int           NULL
  uiHeight                       int           NULL
  uiVtime                        int           NULL DEFAULT ((0))
  uiStatus                       char(1)        NULL DEFAULT ('N')
  uiBlobUrl                      nvarchar(1000)     NULL
  uiDateAdded                    datetime2           NULL DEFAULT (getdate())
  uiMonth                        int           NULL
  uiYear                         int           NULL
  uiUploadedBy                   nvarchar(255)      NULL

  Indexes:
    IX_UnindexedFiles_Status: uiStatus (NONCLUSTERED)
    IX_UnindexedFiles_UploadedBy: uiUploadedBy (NONCLUSTERED)

Table: UserLastViewed
============================================================
  userId                         int           NOT NULL
  userEmail                      nvarchar(255)      NOT NULL
  lastViewedTime                 datetime2           NOT NULL DEFAULT (getutcdate())
  createdAt                      datetime2           NOT NULL DEFAULT (getutcdate())
  updatedAt                      datetime2           NOT NULL DEFAULT (getutcdate())

  Indexes:
    IX_UserLastViewed_Email: userEmail (NONCLUSTERED)
    UQ__UserLast__D54ADF55C9B17BEE: userEmail (NONCLUSTERED)

Table: Users
============================================================
  ID                             int           NOT NULL
  Email                          nvarchar(255)      NOT NULL
  Role                           nvarchar(50)       NOT NULL
  Status                         nvarchar(50)       NOT NULL DEFAULT ('Active')
  RequestedAt                    datetime2           NULL DEFAULT (getdate())
  ApprovedAt                     datetime2           NULL
  ApprovedBy                     nvarchar(255)      NULL
  LastLoginAt                    datetime2           NULL
  Notes                          nvarchar(MAX)      NULL
  CreatedAt                      datetime2           NULL DEFAULT (getdate())
  UpdatedAt                      datetime2           NULL DEFAULT (getdate())

  Indexes:
    IX_Users_Email: Email (NONCLUSTERED)
    IX_Users_Role: Role (NONCLUSTERED)
    IX_Users_Status: Status (NONCLUSTERED)
    UQ__Users__A9D10534CE1B6F31: Email (NONCLUSTERED)


=== SCHEMA EXPORT COMPLETE ===

