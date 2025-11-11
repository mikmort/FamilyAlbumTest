// Type definitions for the Family Album application

export interface Person {
  ID: number;
  neName: string;
  neRelation: string;
  neDateLastModified: Date;
  neCount: number;
  Birthday?: string | null; // ISO date string (YYYY-MM-DD)
  IsFamilyMember?: boolean; // True for family members, false for acquaintances
}

export interface Event {
  ID: number;
  neName: string;
  neRelation: string;
  neDateLastModified: Date;
  neCount: number;
  EventDate?: string | null; // ISO date string (YYYY-MM-DD)
}

export interface MediaItem {
  PFileName: string;
  PFileDirectory: string;
  PDescription: string;
  PHeight: number;
  PWidth: number;
  PMonth: number;
  PYear: number;
  PPeopleList: string;
  PNameCount: number;
  PThumbnailUrl: string;
  PType: number; // 1=image, 2=video
  PTime: number;
  PDateEntered: Date;
  PLastModifiedDate: Date;
  PReviewed: boolean;
  PSoundFile?: string;
  PBlobUrl: string;
  TaggedPeople?: Array<{ ID: number; neName: string; neRelation?: string }>;
  // Optional Event information attached by the media API
  Event?: { ID: number; neName: string } | null;
}

export interface UnindexedFile {
  uiID: number;
  uiFileName: string;
  uiDirectory: string;
  uiThumbUrl: string;
  uiType: number; // 1=image, 2=video
  uiWidth: number;
  uiHeight: number;
  uiVtime: number;
  uiStatus: string; // 'N' or 'P'
  uiBlobUrl: string;
  uiDateAdded: Date;
}

export interface PersonWithRelation {
  ID: number;
  Name: string;
  Relationship: string;
  Position?: number;
}

export interface MediaMetadata {
  EventName?: string;
  EventDetails?: string;
  imMonth: number;
  imYear: number;
  Description: string;
  People: Array<{
    Name: string;
    Relationship: string;
  }>;
}

export interface FilterOptions {
  peopleIds?: number[];
  eventId?: number;
  noPeople?: boolean;
  sortOrder?: 'asc' | 'desc';
  type?: number; // 1=images, 2=videos, undefined=both
  exclusiveFilter?: boolean; // AND logic for people
}

export interface UploadResult {
  fileName: string;
  blobUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  duration?: number;
  type: number;
}
